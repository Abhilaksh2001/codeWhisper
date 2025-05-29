const AWS = require('aws-sdk');
const axios = require('axios');
const xml2js = require('xml2js');
const winston = require('winston');

// Configure AWS SDK
const region = process.env.AWS_REGION || 'us-east-1';
AWS.config.update({ region });
const sqs = new AWS.SQS();
const dynamodb = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();

// Configure logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  defaultMeta: { service: 'external-source-monitor' },
  transports: [
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// Configuration
const POLLING_INTERVAL = parseInt(process.env.POLLING_INTERVAL || '300000', 10); // 5 minutes in ms
const DATA_TABLE = process.env.DATA_TABLE || 'sheets-data-dev';
const DATA_SOURCES_TABLE = process.env.DATA_SOURCES_TABLE || 'data-sources-dev';
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL || '';

/**
 * Fetch data sources from DynamoDB
 * @returns {Promise<Array>} - List of external data sources to monitor
 */
async function fetchDataSources() {
  try {
    const params = {
      TableName: DATA_SOURCES_TABLE,
      IndexName: 'TypeIndex',
      KeyConditionExpression: '#type = :type',
      ExpressionAttributeNames: {
        '#type': 'type'
      },
      ExpressionAttributeValues: {
        ':type': 'external'
      }
    };
    
    const result = await dynamodb.query(params).promise();
    return result.Items || [];
  } catch (error) {
    logger.error('Error fetching data sources', { error: error.message });
    return [];
  }
}

/**
 * Get API key from Secrets Manager
 * @param {string} secretId - Secret ID
 * @returns {Promise<string>} - API key
 */
async function getApiKey(secretId) {
  try {
    const result = await secretsManager.getSecretValue({ SecretId: secretId }).promise();
    const secret = JSON.parse(result.SecretString);
    return secret.apiKey;
  } catch (error) {
    logger.error('Error getting API key', { secretId, error: error.message });
    return null;
  }
}

/**
 * Fetch data from an external source
 * @param {Object} source - The source configuration
 * @returns {Promise<Object>} - The fetched data
 */
async function fetchExternalData(source) {
  try {
    logger.info(`Fetching data from ${source.url}`);
    
    // Prepare headers
    const headers = { ...source.headers };
    
    // Add API key to headers if available
    if (source.apiKeySecretId) {
      const apiKey = await getApiKey(source.apiKeySecretId);
      if (apiKey) {
        // Check if there's an Authorization header that needs the API key
        Object.keys(headers).forEach(key => {
          if (key.toLowerCase() === 'authorization' && headers[key].includes('{apiKey}')) {
            headers[key] = headers[key].replace('{apiKey}', apiKey);
          }
        });
        
        // If no Authorization header uses the API key, add it as X-API-Key
        if (!Object.keys(headers).some(key => 
          key.toLowerCase() === 'authorization' && headers[key].includes(apiKey)
        )) {
          headers['X-API-Key'] = apiKey;
        }
      }
    }
    
    const response = await axios.get(source.url, {
      headers,
      timeout: 10000, // 10 seconds timeout
    });
    
    // Process based on content type
    if (source.dataFormat === 'xml') {
      const parser = new xml2js.Parser({ explicitArray: false });
      const result = await parser.parseStringPromise(response.data);
      return result;
    } else {
      // Assume JSON if not XML
      return response.data;
    }
  } catch (error) {
    logger.error(`Error fetching data from ${source.url}`, { 
      error: error.message,
      source: source.id
    });
    throw error;
  }
}

/**
 * Get the last known state from DynamoDB
 * @param {string} sourceId - The source ID
 * @returns {Promise<Object>} - The last known state
 */
async function getLastKnownState(sourceId) {
  try {
    const params = {
      TableName: DATA_TABLE,
      IndexName: 'SheetIdIndex',
      KeyConditionExpression: 'sheetId = :sourceId',
      ExpressionAttributeValues: {
        ':sourceId': sourceId,
      },
      Limit: 1,
      ScanIndexForward: false, // descending order by sort key (lastUpdated)
    };
    
    const result = await dynamodb.query(params).promise();
    return result.Items && result.Items.length > 0 ? result.Items[0] : null;
  } catch (error) {
    logger.error('Error getting last known state', { sourceId, error: error.message });
    throw error;
  }
}

/**
 * Save the current state to DynamoDB
 * @param {string} sourceId - The source ID
 * @param {Object} data - The source data
 * @returns {Promise<void>}
 */
async function saveCurrentState(sourceId, data) {
  try {
    const timestamp = new Date().toISOString();
    const params = {
      TableName: DATA_TABLE,
      Item: {
        id: `${sourceId}-${timestamp}`,
        sheetId: sourceId, // Reusing sheetId field for sourceId
        lastUpdated: timestamp,
        data: JSON.stringify(data),
        sourceType: 'external', // To distinguish from Google Sheets data
      },
    };
    
    await dynamodb.put(params).promise();
    logger.info('Saved current state', { sourceId, timestamp });
  } catch (error) {
    logger.error('Error saving current state', { sourceId, error: error.message });
    throw error;
  }
}

/**
 * Detect changes between current and previous data
 * @param {Object} currentData - Current data
 * @param {Object} previousData - Previous data
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
  if (JSON.stringify(currentData) !== JSON.stringify(prevData)) {
    return {
      type: 'update',
      data: currentData,
    };
  }
  
  return null;
}

/**
 * Send change notification to SQS
 * @param {string} sourceId - The source ID
 * @param {Object} changes - The detected changes
 * @returns {Promise<void>}
 */
async function sendChangeNotification(sourceId, changes) {
  try {
    const params = {
      QueueUrl: SQS_QUEUE_URL,
      MessageBody: JSON.stringify({
        sourceId,
        sourceType: 'external',
        timestamp: new Date().toISOString(),
        changes,
      }),
    };
    
    await sqs.sendMessage(params).promise();
    logger.info('Change notification sent to SQS', { sourceId });
  } catch (error) {
    logger.error('Error sending change notification', { sourceId, error: error.message });
    throw error;
  }
}

/**
 * Monitor a single external source for changes
 * @param {Object} source - The source configuration
 * @returns {Promise<void>}
 */
async function monitorSource(source) {
  try {
    logger.info('Checking for changes', { sourceId: source.id, url: source.url });
    
    // Fetch current data
    const currentData = await fetchExternalData(source);
    
    // Get last known state
    const lastState = await getLastKnownState(source.id);
    const previousData = lastState ? lastState.data : null;
    
    // Detect changes
    const changes = detectChanges(currentData, previousData);
    
    if (changes) {
      logger.info('Changes detected', { sourceId: source.id, changeType: changes.type });
      
      // Save current state
      await saveCurrentState(source.id, currentData);
      
      // Send notification
      await sendChangeNotification(source.id, changes);
      
      // Update last updated timestamp in data source record
      await dynamodb.update({
        TableName: DATA_SOURCES_TABLE,
        Key: { id: source.id },
        UpdateExpression: 'SET lastUpdated = :timestamp',
        ExpressionAttributeValues: {
          ':timestamp': new Date().toISOString()
        }
      }).promise();
    } else {
      logger.info('No changes detected', { sourceId: source.id });
    }
  } catch (error) {
    logger.error('Error monitoring source', { sourceId: source.id, error: error.message });
    // Don't throw here to prevent the monitoring loop from breaking
  }
}

/**
 * Main monitoring loop
 */
async function monitoringLoop() {
  try {
    // Fetch all external data sources
    const sources = await fetchDataSources();
    logger.info(`Found ${sources.length} external sources to monitor`);
    
    // Monitor each source
    for (const source of sources) {
      // Skip sources with missing URL
      if (!source.url) {
        logger.warn(`Skipping source ${source.id} - missing URL`);
        continue;
      }
      
      // Use source-specific polling interval or default
      const pollingInterval = source.pollingInterval || POLLING_INTERVAL;
      
      // Check if it's time to poll this source
      const now = Date.now();
      const lastChecked = source.lastChecked ? new Date(source.lastChecked).getTime() : 0;
      
      if (now - lastChecked >= pollingInterval * 1000) {
        await monitorSource(source);
        
        // Update last checked timestamp
        await dynamodb.update({
          TableName: DATA_SOURCES_TABLE,
          Key: { id: source.id },
          UpdateExpression: 'SET lastChecked = :timestamp',
          ExpressionAttributeValues: {
            ':timestamp': new Date().toISOString()
          }
        }).promise();
      } else {
        logger.debug(`Skipping source ${source.id} - not time to check yet`);
      }
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
    logger.info('Starting external source monitoring service');
    
    // Validate configuration
    if (!SQS_QUEUE_URL) {
      throw new Error('SQS_QUEUE_URL environment variable is required');
    }
    
    // Start monitoring loop
    monitoringLoop();
    
    logger.info('Monitoring service started', { 
      pollingInterval: POLLING_INTERVAL
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

// Export functions for testing
module.exports = {
  fetchDataSources,
  fetchExternalData,
  getLastKnownState,
  saveCurrentState,
  detectChanges,
  sendChangeNotification,
  monitorSource,
  monitoringLoop,
  start
};

// Start the service if this is the main module
if (require.main === module) {
  start();
}