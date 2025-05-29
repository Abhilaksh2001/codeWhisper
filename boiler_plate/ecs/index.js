const { google } = require('googleapis');
const AWS = require('aws-sdk');
const winston = require('winston');

// Configure AWS SDK
const region = process.env.AWS_REGION || 'us-east-1';
AWS.config.update({ region });
const sqs = new AWS.SQS();
const dynamodb = new AWS.DynamoDB.DocumentClient();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'sheets-monitor' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Configuration
const POLLING_INTERVAL = parseInt(process.env.POLLING_INTERVAL || '300000', 10); // 5 minutes in ms
const SHEETS_TABLE = process.env.SHEETS_TABLE || 'sheets-data-dev';
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL || '';
const SHEETS_TO_MONITOR = process.env.SHEETS_TO_MONITOR 
  ? process.env.SHEETS_TO_MONITOR.split(',') 
  : [];

// Google Sheets API client
let sheetsApi;

/**
 * Initialize Google Sheets API client
 */
async function initializeSheetsApi() {
  try {
    // This would typically use a service account or OAuth2 credentials
    // For this boilerplate, we'll assume the auth is set up via environment variables
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const authClient = await auth.getClient();
    sheetsApi = google.sheets({ version: 'v4', auth: authClient });
    logger.info('Google Sheets API client initialized');
  } catch (error) {
    logger.error('Failed to initialize Google Sheets API client', { error: error.message });
    throw error;
  }
}

/**
 * Fetch data from a Google Sheet
 * @param {string} sheetId - The ID of the Google Sheet
 * @param {string} range - The range to fetch (e.g., 'Sheet1!A1:Z1000')
 * @returns {Promise<Array>} - The sheet data
 */
async function fetchSheetData(sheetId, range) {
  try {
    const response = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range,
    });
    return response.data.values || [];
  } catch (error) {
    logger.error('Error fetching sheet data', { 
      sheetId, 
      range, 
      error: error.message 
    });
    throw error;
  }
}

/**
 * Get the last known state of a sheet from DynamoDB
 * @param {string} sheetId - The ID of the Google Sheet
 * @returns {Promise<Object>} - The last known state
 */
async function getLastKnownState(sheetId) {
  try {
    const params = {
      TableName: SHEETS_TABLE,
      IndexName: 'SheetIdIndex',
      KeyConditionExpression: 'sheetId = :sheetId',
      ExpressionAttributeValues: {
        ':sheetId': sheetId,
      },
      Limit: 1,
      ScanIndexForward: false, // descending order by sort key (lastUpdated)
    };
    
    const result = await dynamodb.query(params).promise();
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  } catch (error) {
    logger.error('Error getting last known state', { sheetId, error: error.message });
    throw error;
  }
}

/**
 * Save the current state of a sheet to DynamoDB
 * @param {string} sheetId - The ID of the Google Sheet
 * @param {Array} data - The sheet data
 * @returns {Promise<void>}
 */
async function saveCurrentState(sheetId, data) {
  try {
    const timestamp = new Date().toISOString();
    const params = {
      TableName: SHEETS_TABLE,
      Item: {
        id: `${sheetId}-${timestamp}`,
        sheetId,
        lastUpdated: timestamp,
        data: JSON.stringify(data),
      },
    };
    
    await dynamodb.put(params).promise();
    logger.info('Saved current state', { sheetId, timestamp });
  } catch (error) {
    logger.error('Error saving current state', { sheetId, error: error.message });
    throw error;
  }
}

/**
 * Detect changes between current and previous sheet data
 * @param {Array} currentData - Current sheet data
 * @param {Array} previousData - Previous sheet data
 * @returns {Object|null} - Changes detected or null if no changes
 */
function detectChanges(currentData, previousData) {
  if (!previousData) {
    return { type: 'initial', data: currentData };
  }
  
  // Parse previous data if it's stored as a string
  const prevData = typeof previousData === 'string' 
    ? JSON.parse(previousData) 
    : previousData;
  
  // Simple change detection - in a real implementation, this would be more sophisticated
  // to detect specific cell changes, additions, deletions, etc.
  if (JSON.stringify(currentData) !== JSON.stringify(prevData)) {
    return {
      type: 'update',
      data: currentData,
      // In a real implementation, you would include specific changes here
    };
  }
  
  return null;
}

/**
 * Send change notification to SQS
 * @param {string} sheetId - The ID of the Google Sheet
 * @param {Object} changes - The detected changes
 * @returns {Promise<void>}
 */
async function sendChangeNotification(sheetId, changes) {
  try {
    const params = {
      QueueUrl: SQS_QUEUE_URL,
      MessageBody: JSON.stringify({
        sheetId,
        timestamp: new Date().toISOString(),
        changes,
      }),
    };
    
    await sqs.sendMessage(params).promise();
    logger.info('Change notification sent to SQS', { sheetId });
  } catch (error) {
    logger.error('Error sending change notification', { sheetId, error: error.message });
    throw error;
  }
}

/**
 * Monitor a single sheet for changes
 * @param {string} sheetId - The ID of the Google Sheet
 * @param {string} range - The range to monitor
 * @returns {Promise<void>}
 */
async function monitorSheet(sheetId, range = 'Sheet1!A1:Z1000') {
  try {
    logger.info('Checking for changes', { sheetId, range });
    
    // Fetch current data
    const currentData = await fetchSheetData(sheetId, range);
    
    // Get last known state
    const lastState = await getLastKnownState(sheetId);
    const previousData = lastState ? lastState.data : null;
    
    // Detect changes
    const changes = detectChanges(currentData, previousData);
    
    if (changes) {
      logger.info('Changes detected', { sheetId, changeType: changes.type });
      
      // Save current state
      await saveCurrentState(sheetId, currentData);
      
      // Send notification
      await sendChangeNotification(sheetId, changes);
    } else {
      logger.info('No changes detected', { sheetId });
    }
  } catch (error) {
    logger.error('Error monitoring sheet', { sheetId, error: error.message });
    // Don't throw here to prevent the monitoring loop from breaking
  }
}

/**
 * Main monitoring loop
 */
async function monitoringLoop() {
  try {
    for (const sheetId of SHEETS_TO_MONITOR) {
      await monitorSheet(sheetId);
    }
  } catch (error) {
    logger.error('Error in monitoring loop', { error: error.message });
  } finally {
    // Schedule next run
    setTimeout(monitoringLoop, POLLING_INTERVAL);
  }
}

/**
 * Start the monitoring service
 */
async function start() {
  try {
    logger.info('Starting Google Sheets monitoring service');
    
    // Initialize Google Sheets API
    await initializeSheetsApi();
    
    // Validate configuration
    if (!SQS_QUEUE_URL) {
      throw new Error('SQS_QUEUE_URL environment variable is required');
    }
    
    if (SHEETS_TO_MONITOR.length === 0) {
      logger.warn('No sheets configured for monitoring. Set SHEETS_TO_MONITOR environment variable.');
    }
    
    // Start monitoring loop
    monitoringLoop();
    
    logger.info('Monitoring service started', { 
      pollingInterval: POLLING_INTERVAL,
      sheetsToMonitor: SHEETS_TO_MONITOR.length,
    });
  } catch (error) {
    logger.error('Failed to start monitoring service', { error: error.message });
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down');
  process.exit(0);
});

// Start the service
start();