const AWS = require('aws-sdk');

// Initialize AWS clients
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const secretsManager = new AWS.SecretsManager();

// Table name from environment variables
const DATA_SOURCES_TABLE = process.env.DATA_SOURCES_TABLE || 'data-sources-dev';

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
 * Lambda handler for deleting a data source
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
  
  return await deleteDataSource(sourceId);
};