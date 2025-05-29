const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Initialize AWS clients
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();

// Table name from environment variables
const DATA_SOURCES_TABLE = process.env.DATA_SOURCES_TABLE || 'data-sources-dev';
const SECRETS_PREFIX = process.env.SECRETS_PREFIX || 'datasource/';

/**
 * Register a new data source
 * @param {Object} body - Request body
 * @returns {Promise<Object>} - Response with new data source ID
 */
async function registerDataSource(body) {
  try {
    // Validate required fields
    if (!body.name || !body.type || !body.dataFormat) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'Missing required fields' })
      };
    }
    
    // For external sources, URL is required
    if (body.type === 'external' && !body.url) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'URL is required for external data sources' })
      };
    }
    
    // Generate a unique ID
    const sourceId = `${body.type}-${uuidv4().substring(0, 8)}`;
    const timestamp = new Date().toISOString();
    
    // Store API key in Secrets Manager if provided
    let apiKeySecretId = null;
    if (body.apiKey) {
      apiKeySecretId = `${SECRETS_PREFIX}${sourceId}`;
      await secretsManager.createSecret({
        Name: apiKeySecretId,
        SecretString: JSON.stringify({ apiKey: body.apiKey })
      }).promise();
    }
    
    // Create data source record
    const dataSource = {
      id: sourceId,
      name: body.name,
      description: body.description || '',
      type: body.type,
      dataFormat: body.dataFormat,
      url: body.url,
      pollingInterval: body.pollingInterval || 300,
      headers: body.headers || {},
      apiKeySecretId: apiKeySecretId,
      createdAt: timestamp,
      lastUpdated: timestamp,
      owner: body.owner || 'system',
      subscriberCount: 0
    };
    
    // Save to DynamoDB
    await dynamoDB.put({
      TableName: DATA_SOURCES_TABLE,
      Item: dataSource
    }).promise();
    
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: sourceId,
        name: body.name,
        type: body.type,
        message: 'Data source registered successfully'
      })
    };
  } catch (error) {
    console.error('Error registering data source:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Failed to register data source' })
    };
  }
}

/**
 * Lambda handler for registering a data source
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  
  // Parse request body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (error) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Invalid request body' })
    };
  }
  
  return await registerDataSource(body);
};