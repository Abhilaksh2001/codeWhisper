const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');

// Initialize AWS clients
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();

// Table name from environment variables
const DATA_SOURCES_TABLE = process.env.DATA_SOURCES_TABLE || 'data-sources-dev';
const SECRETS_PREFIX = process.env.SECRETS_PREFIX || 'datasource/';

/**
 * List all data sources
 * @returns {Promise<Object>} - Response with list of data sources
 */
async function listDataSources() {
  try {
    const params = {
      TableName: DATA_SOURCES_TABLE
    };
    
    const result = await dynamoDB.scan(params).promise();
    
    // Map items to summary view (exclude sensitive information)
    const sources = result.Items.map(item => ({
      id: item.id,
      name: item.name,
      type: item.type,
      dataFormat: item.dataFormat,
      lastUpdated: item.lastUpdated
    }));
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sources })
    };
  } catch (error) {
    console.error('Error listing data sources:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Failed to list data sources' })
    };
  }
}

/**
 * Get a specific data source
 * @param {string} sourceId - ID of the data source
 * @returns {Promise<Object>} - Response with data source details
 */
async function getDataSource(sourceId) {
  try {
    const params = {
      TableName: DATA_SOURCES_TABLE,
      Key: { id: sourceId }
    };
    
    const result = await dynamoDB.get(params).promise();
    
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'Data source not found' })
      };
    }
    
    // Remove sensitive information
    const dataSource = { ...result.Item };
    delete dataSource.apiKeySecretId;
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(dataSource)
    };
  } catch (error) {
    console.error(`Error getting data source ${sourceId}:`, error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Failed to get data source' })
    };
  }
}

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
    
    // Remove apiKey from the object (it's stored in Secrets Manager)
    delete body.apiKey;
    
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
 * Update an existing data source
 * @param {string} sourceId - ID of the data source
 * @param {Object} body - Request body with updates
 * @returns {Promise<Object>} - Response with updated data source
 */
async function updateDataSource(sourceId, body) {
  try {
    // Check if data source exists
    const getParams = {
      TableName: DATA_SOURCES_TABLE,
      Key: { id: sourceId }
    };
    
    const result = await dynamoDB.get(getParams).promise();
    
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'Data source not found' })
      };
    }
    
    const dataSource = result.Item;
    const timestamp = new Date().toISOString();
    
    // Update API key in Secrets Manager if provided
    if (body.apiKey) {
      let apiKeySecretId = dataSource.apiKeySecretId;
      
      if (!apiKeySecretId) {
        // Create new secret if it doesn't exist
        apiKeySecretId = `${SECRETS_PREFIX}${sourceId}`;
        dataSource.apiKeySecretId = apiKeySecretId;
        
        await secretsManager.createSecret({
          Name: apiKeySecretId,
          SecretString: JSON.stringify({ apiKey: body.apiKey })
        }).promise();
      } else {
        // Update existing secret
        await secretsManager.updateSecret({
          SecretId: apiKeySecretId,
          SecretString: JSON.stringify({ apiKey: body.apiKey })
        }).promise();
      }
    }
    
    // Remove apiKey from the object (it's stored in Secrets Manager)
    delete body.apiKey;
    
    // Update fields
    const updateExpressions = [];
    const expressionAttributeNames = {};
    const expressionAttributeValues = {};
    
    // Process each field in the body
    Object.keys(body).forEach(key => {
      if (key !== 'id' && body[key] !== undefined) {
        updateExpressions.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = body[key];
      }
    });
    
    // Always update lastUpdated
    updateExpressions.push('#lastUpdated = :lastUpdated');
    expressionAttributeNames['#lastUpdated'] = 'lastUpdated';
    expressionAttributeValues[':lastUpdated'] = timestamp;
    
    // Update in DynamoDB
    const updateParams = {
      TableName: DATA_SOURCES_TABLE,
      Key: { id: sourceId },
      UpdateExpression: `SET ${updateExpressions.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: 'ALL_NEW'
    };
    
    const updateResult = await dynamoDB.update(updateParams).promise();
    
    // Remove sensitive information
    const updatedDataSource = { ...updateResult.Attributes };
    delete updatedDataSource.apiKeySecretId;
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedDataSource)
    };
  } catch (error) {
    console.error(`Error updating data source ${sourceId}:`, error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Failed to update data source' })
    };
  }
}

/**
 * Delete a data source
 * @param {string} sourceId - ID of the data source
 * @returns {Promise<Object>} - Response
 */
async function deleteDataSource(sourceId) {
  try {
    // Check if data source exists
    const getParams = {
      TableName: DATA_SOURCES_TABLE,
      Key: { id: sourceId }
    };
    
    const result = await dynamoDB.get(getParams).promise();
    
    if (!result.Item) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: 'Data source not found' })
      };
    }
    
    // Delete API key from Secrets Manager if it exists
    if (result.Item.apiKeySecretId) {
      await secretsManager.deleteSecret({
        SecretId: result.Item.apiKeySecretId,
        ForceDeleteWithoutRecovery: true
      }).promise();
    }
    
    // Delete from DynamoDB
    await dynamoDB.delete({
      TableName: DATA_SOURCES_TABLE,
      Key: { id: sourceId }
    }).promise();
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Data source deleted successfully' })
    };
  } catch (error) {
    console.error(`Error deleting data source ${sourceId}:`, error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Failed to delete data source' })
    };
  }
}

/**
 * Main handler function
 * @param {Object} event - Lambda event
 * @param {Object} context - Lambda context
 * @returns {Promise<Object>} - Response
 */
exports.handler = async (event, context) => {
  console.log('Event:', JSON.stringify(event));
  
  // Extract path and HTTP method
  const path = event.path;
  const httpMethod = event.httpMethod;
  
  // Route based on path and method
  if (path === '/datasources' && httpMethod === 'GET') {
    return await listDataSources();
  } else if (path.match(/^\/datasources\/[^\/]+$/) && httpMethod === 'GET') {
    const sourceId = path.split('/')[2];
    return await getDataSource(sourceId);
  } else if (path === '/datasources/register' && httpMethod === 'POST') {
    const body = JSON.parse(event.body || '{}');
    return await registerDataSource(body);
  } else if (path.match(/^\/datasources\/[^\/]+\/update$/) && httpMethod === 'PUT') {
    const sourceId = path.split('/')[2];
    const body = JSON.parse(event.body || '{}');
    return await updateDataSource(sourceId, body);
  } else if (path.match(/^\/datasources\/[^\/]+\/delete$/) && httpMethod === 'DELETE') {
    const sourceId = path.split('/')[2];
    return await deleteDataSource(sourceId);
  } else {
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Not Found' })
    };
  }
};