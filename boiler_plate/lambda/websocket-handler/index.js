const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Initialize AWS clients
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const apiGateway = new AWS.ApiGatewayManagementApi({
  endpoint: process.env.WEBSOCKET_API_ENDPOINT
});
const sqs = new AWS.SQS();

// Table and queue names from environment variables
const CONNECTIONS_TABLE = process.env.CONNECTIONS_TABLE || 'websocket-connections-dev';
const SHEETS_DATA_TABLE = process.env.SHEETS_DATA_TABLE || 'sheets-data-dev';
const DATA_SOURCES_TABLE = process.env.DATA_SOURCES_TABLE || 'data-sources-dev';
const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL || '';

/**
 * Handle WebSocket connect event
 * @param {Object} event - API Gateway WebSocket event
 * @returns {Object} - API Gateway response
 */
async function handleConnect(event) {
  const connectionId = event.requestContext.connectionId;
  
  try {
    // Store connection in DynamoDB
    await dynamoDB.put({
      TableName: CONNECTIONS_TABLE,
      Item: {
        connectionId,
        connectedAt: new Date().toISOString(),
        ttl: Math.floor(Date.now() / 1000) + 24 * 60 * 60, // 24 hour TTL
      }
    }).promise();
    
    console.log(`Connection ${connectionId} connected`);
    return { statusCode: 200, body: 'Connected' };
  } catch (error) {
    console.error('Error handling connect:', error);
    return { statusCode: 500, body: 'Failed to connect: ' + error.message };
  }
}

/**
 * Handle WebSocket disconnect event
 * @param {Object} event - API Gateway WebSocket event
 * @returns {Object} - API Gateway response
 */
async function handleDisconnect(event) {
  const connectionId = event.requestContext.connectionId;
  
  try {
    // Remove connection from DynamoDB
    await dynamoDB.delete({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId }
    }).promise();
    
    console.log(`Connection ${connectionId} disconnected`);
    return { statusCode: 200, body: 'Disconnected' };
  } catch (error) {
    console.error('Error handling disconnect:', error);
    return { statusCode: 500, body: 'Failed to disconnect: ' + error.message };
  }
}

/**
 * Handle subscription request
 * @param {Object} event - API Gateway WebSocket event
 * @returns {Object} - API Gateway response
 */
async function handleSubscribe(event) {
  const connectionId = event.requestContext.connectionId;
  let body;
  
  try {
    body = JSON.parse(event.body);
  } catch (error) {
    return { statusCode: 400, body: 'Invalid request body' };
  }
  
  const { sheetId, sourceId, sourceType } = body;
  
  // Determine what type of source we're subscribing to
  const dataId = sourceType === 'external' ? sourceId : sheetId;
  
  if (!dataId) {
    return { statusCode: 400, body: 'Missing ID parameter (sheetId or sourceId)' };
  }
  
  try {
    // Verify the data source exists if it's an external source
    if (sourceType === 'external') {
      const dataSourceResult = await dynamoDB.get({
        TableName: DATA_SOURCES_TABLE,
        Key: { id: dataId }
      }).promise();
      
      if (!dataSourceResult.Item) {
        return { statusCode: 404, body: 'Data source not found' };
      }
      
      // Increment subscriber count
      await dynamoDB.update({
        TableName: DATA_SOURCES_TABLE,
        Key: { id: dataId },
        UpdateExpression: 'SET subscriberCount = if_not_exists(subscriberCount, :zero) + :one',
        ExpressionAttributeValues: {
          ':zero': 0,
          ':one': 1
        }
      }).promise();
    }
    
    // Update connection with subscription info
    await dynamoDB.update({
      TableName: CONNECTIONS_TABLE,
      Key: { connectionId },
      UpdateExpression: 'SET sheetId = :dataId, sourceType = :sourceType',
      ExpressionAttributeValues: {
        ':dataId': dataId,
        ':sourceType': sourceType || 'sheet'
      }
    }).promise();
    
    // Send the latest data to the client
    const latestData = await getLatestData(dataId);
    if (latestData) {
      await sendToConnection(connectionId, {
        type: sourceType === 'external' ? 'EXTERNAL_INITIAL_DATA' : 'INITIAL_DATA',
        id: dataId,
        sourceType: sourceType || 'sheet',
        data: latestData
      });
    }
    
    console.log(`Connection ${connectionId} subscribed to ${sourceType || 'sheet'} ${dataId}`);
    return { statusCode: 200, body: 'Subscribed' };
  } catch (error) {
    console.error('Error handling subscribe:', error);
    return { statusCode: 500, body: 'Failed to subscribe: ' + error.message };
  }
}

/**
 * Get the latest data for a source
 * @param {string} sourceId - The source ID
 * @returns {Object|null} - The latest data or null
 */
async function getLatestData(sourceId) {
  try {
    const result = await dynamoDB.query({
      TableName: SHEETS_DATA_TABLE,
      IndexName: 'SheetIdIndex',
      KeyConditionExpression: 'sheetId = :sourceId',
      ExpressionAttributeValues: {
        ':sourceId': sourceId
      },
      Limit: 1,
      ScanIndexForward: false // descending order by sort key (lastUpdated)
    }).promise();
    
    if (result.Items && result.Items.length > 0) {
      const item = result.Items[0];
      return typeof item.data === 'string' ? JSON.parse(item.data) : item.data;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting latest data:', error);
    return null;
  }
}

/**
 * Send a message to a WebSocket connection
 * @param {string} connectionId - The connection ID
 * @param {Object} data - The data to send
 * @returns {Promise<void>}
 */
async function sendToConnection(connectionId, data) {
  try {
    await apiGateway.postToConnection({
      ConnectionId: connectionId,
      Data: JSON.stringify(data)
    }).promise();
  } catch (error) {
    // Handle stale connections
    if (error.statusCode === 410) {
      console.log(`Connection ${connectionId} is stale, removing`);
      await dynamoDB.delete({
        TableName: CONNECTIONS_TABLE,
        Key: { connectionId }
      }).promise();
    } else {
      throw error;
    }
  }
}

/**
 * Process SQS messages with external source changes
 * @param {Object} message - The SQS message
 * @returns {Promise<void>}
 */
async function processExternalSourceMessage(message) {
  try {
    const { sourceId, changes } = message;
    
    // Find all connections subscribed to this source
    const connections = await dynamoDB.query({
      TableName: CONNECTIONS_TABLE,
      IndexName: 'SheetSubscriptions',
      KeyConditionExpression: 'sheetId = :sourceId',
      ExpressionAttributeValues: {
        ':sourceId': sourceId
      }
    }).promise();
    
    // Send updates to all subscribed connections
    const sendPromises = connections.Items.map(connection => 
      sendToConnection(connection.connectionId, {
        type: 'EXTERNAL_UPDATE',
        sourceId,
        sourceType: 'external',
        data: changes.data,
        timestamp: new Date().toISOString()
      })
    );
    
    await Promise.allSettled(sendPromises);
    console.log(`Sent external updates to ${sendPromises.length} connections for source ${sourceId}`);
  } catch (error) {
    console.error('Error processing external source message:', error);
    throw error;
  }
}

/**
 * Process SQS messages with Google Sheets changes
 * @param {Object} event - SQS event
 * @returns {Promise<void>}
 */
async function processSQSMessages(event) {
  try {
    for (const record of event.Records) {
      const message = JSON.parse(record.body);
      
      // Determine message type and process accordingly
      if (message.sourceType === 'external') {
        await processExternalSourceMessage(message);
      } else {
        // Process Google Sheets message
        const { sheetId, changes } = message;
        
        // Find all connections subscribed to this sheet
        const connections = await dynamoDB.query({
          TableName: CONNECTIONS_TABLE,
          IndexName: 'SheetSubscriptions',
          KeyConditionExpression: 'sheetId = :sheetId',
          ExpressionAttributeValues: {
            ':sheetId': sheetId
          }
        }).promise();
        
        // Send updates to all subscribed connections
        const sendPromises = connections.Items.map(connection => 
          sendToConnection(connection.connectionId, {
            type: 'UPDATE',
            sheetId,
            data: changes.data,
            timestamp: new Date().toISOString()
          })
        );
        
        await Promise.allSettled(sendPromises);
        console.log(`Sent updates to ${sendPromises.length} connections for sheet ${sheetId}`);
      }
    }
    
    return { statusCode: 200, body: 'Processed' };
  } catch (error) {
    console.error('Error processing SQS messages:', error);
    return { statusCode: 500, body: 'Error processing messages: ' + error.message };
  }
}

/**
 * Main handler function
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Object} - Response
 */
exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event));
  
  // Handle SQS events
  if (event.Records && event.Records[0].eventSource === 'aws:sqs') {
    return await processSQSMessages(event);
  }
  
  // Handle WebSocket events
  const routeKey = event.requestContext.routeKey;
  
  switch (routeKey) {
    case '$connect':
      return await handleConnect(event);
    case '$disconnect':
      return await handleDisconnect(event);
    case 'subscribe':
      return await handleSubscribe(event);
    default:
      return { statusCode: 400, body: `Unsupported route: ${routeKey}` };
  }
};