const AWS = require('aws-sdk');

// Initialize AWS clients
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();

// Table name from environment variables
const DATA_SOURCES_TABLE = process.env.DATA_SOURCES_TABLE || 'data-sources-dev';
const SECRETS_PREFIX = process.env.SECRETS_PREFIX || 'datasource/';

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
 * Lambda handler for updating a data source
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  
  // Extract source ID from path parameters
  const sourceId = event.pathParameters?.sourceId;
  
  if (!sourceId) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: 'Missing sourceId parameter' })
    };
  }
  
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
  
  return await updateDataSource(sourceId, body);
};