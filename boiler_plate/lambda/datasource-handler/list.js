const AWS = require('aws-sdk');

// Initialize AWS clients
const dynamoDB = new AWS.DynamoDB.DocumentClient();

// Table name from environment variables
const DATA_SOURCES_TABLE = process.env.DATA_SOURCES_TABLE || 'data-sources-dev';

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
 * Lambda handler for listing data sources
 */
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event));
  return await listDataSources();
};