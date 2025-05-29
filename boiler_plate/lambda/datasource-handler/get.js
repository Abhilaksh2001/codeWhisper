const AWS = require('aws-sdk');

// Initialize AWS clients
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Table name from environment variables
const DATA_SOURCES_TABLE = process.env.DATA_SOURCES_TABLE || 'data-sources-dev';

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
 * Lambda handler for getting a data source
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
  
  return await getDataSource(sourceId);
};