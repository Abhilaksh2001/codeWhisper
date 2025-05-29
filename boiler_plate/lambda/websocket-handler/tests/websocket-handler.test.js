const AWS = require('aws-sdk');
const { handler } = require('../index');

// Mock AWS services
jest.mock('aws-sdk');

// Test data
const connectionIds = [
  'abcdef123456',
  'connection-1234567890',
  'websocket-conn-0001',
  'a'.repeat(128), // Max length connection ID
  '特殊字符-connection' // Non-ASCII characters
];

const dataIds = [
  'sheet-123456',
  'external-source-001',
  'a'.repeat(256), // Very long ID
  'sheet-with-special-chars!@#$',
  '中文表格ID' // Non-ASCII characters
];

const sampleSheetData = [
  ['Name', 'Age', 'City'],
  ['John Doe', '30', 'New York'],
  ['Jane Smith', '25', 'Los Angeles'],
  ['Bob Johnson', '45', 'Chicago']
];

const sampleExternalData = {
  stocks: [
    { symbol: 'AAPL', price: 150.25 },
    { symbol: 'MSFT', price: 290.10 }
  ],
  lastUpdated: '2023-01-01T12:00:00Z'
};

const largeData = Array(1000).fill().map((_, i) => 
  [`Row ${i}`, `Value ${i}`, `Extra ${i}`]
);

// Mock setup helpers
const setupDynamoDBMock = () => {
  const mockPut = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });
  
  const mockDelete = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });
  
  const mockUpdate = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });
  
  const mockQuery = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({ Items: [] })
  });
  
  AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
    put: mockPut,
    delete: mockDelete,
    update: mockUpdate,
    query: mockQuery
  }));
  
  return { mockPut, mockDelete, mockUpdate, mockQuery };
};

const setupApiGatewayMock = () => {
  const mockPostToConnection = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });
  
  AWS.ApiGatewayManagementApi.mockImplementation(() => ({
    postToConnection: mockPostToConnection
  }));
  
  return { mockPostToConnection };
};

const setupSQSMock = () => {
  const mockSendMessage = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });
  
  AWS.SQS.mockImplementation(() => ({
    sendMessage: mockSendMessage
  }));
  
  return { mockSendMessage };
};

// Tests
describe('WebSocket Handler Lambda Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn(); // Mock console.log
    console.error = jest.fn(); // Mock console.error
  });
  
  describe('WebSocket Connection Tests', () => {
    
    test('CONN-001: Successful connection', async () => {
      // Setup
      const { mockPut } = setupDynamoDBMock();
      
      // Input
      const event = {
        requestContext: {
          connectionId: connectionIds[0],
          routeKey: '$connect'
        }
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Connected');
      expect(mockPut).toHaveBeenCalledTimes(1);
      expect(mockPut.mock.calls[0][0].TableName).toBeDefined();
      expect(mockPut.mock.calls[0][0].Item.connectionId).toBe(connectionIds[0]);
      expect(mockPut.mock.calls[0][0].Item.ttl).toBeDefined();
    });
    
    test('CONN-002: Connection with DynamoDB failure', async () => {
      // Setup
      const { mockPut } = setupDynamoDBMock();
      mockPut.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('DynamoDB error'))
      });
      
      // Input
      const event = {
        requestContext: {
          connectionId: connectionIds[0],
          routeKey: '$connect'
        }
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('Failed to connect');
      expect(console.error).toHaveBeenCalled();
    });
    
    test('CONN-003: Connection with very long connection ID', async () => {
      // Setup
      const { mockPut } = setupDynamoDBMock();
      
      // Input
      const event = {
        requestContext: {
          connectionId: connectionIds[3], // Max length ID
          routeKey: '$connect'
        }
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Connected');
      expect(mockPut).toHaveBeenCalledTimes(1);
      expect(mockPut.mock.calls[0][0].Item.connectionId).toBe(connectionIds[3]);
    });
    
    test('CONN-004: Connection with non-ASCII characters', async () => {
      // Setup
      const { mockPut } = setupDynamoDBMock();
      
      // Input
      const event = {
        requestContext: {
          connectionId: connectionIds[4], // Non-ASCII characters
          routeKey: '$connect'
        }
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Connected');
      expect(mockPut).toHaveBeenCalledTimes(1);
      expect(mockPut.mock.calls[0][0].Item.connectionId).toBe(connectionIds[4]);
    });
  });
  
  describe('WebSocket Disconnection Tests', () => {
    
    test('DISC-001: Successful disconnection', async () => {
      // Setup
      const { mockDelete } = setupDynamoDBMock();
      
      // Input
      const event = {
        requestContext: {
          connectionId: connectionIds[0],
          routeKey: '$disconnect'
        }
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Disconnected');
      expect(mockDelete).toHaveBeenCalledTimes(1);
      expect(mockDelete.mock.calls[0][0].Key.connectionId).toBe(connectionIds[0]);
    });
    
    test('DISC-002: Disconnection with DynamoDB failure', async () => {
      // Setup
      const { mockDelete } = setupDynamoDBMock();
      mockDelete.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('DynamoDB error'))
      });
      
      // Input
      const event = {
        requestContext: {
          connectionId: connectionIds[0],
          routeKey: '$disconnect'
        }
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('Failed to disconnect');
      expect(console.error).toHaveBeenCalled();
    });
    
    test('DISC-003: Disconnection of non-existent connection', async () => {
      // Setup
      const { mockDelete } = setupDynamoDBMock();
      
      // Input
      const event = {
        requestContext: {
          connectionId: 'non-existent-connection',
          routeKey: '$disconnect'
        }
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Disconnected');
      expect(mockDelete).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Subscription Tests', () => {
    
    test('SUB-001: Successful sheet subscription', async () => {
      // Setup
      const { mockUpdate, mockQuery } = setupDynamoDBMock();
      const { mockPostToConnection } = setupApiGatewayMock();
      
      mockQuery.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Items: [{
            id: `${dataIds[0]}-timestamp`,
            sheetId: dataIds[0],
            data: JSON.stringify(sampleSheetData)
          }]
        })
      });
      
      // Input
      const event = {
        requestContext: {
          connectionId: connectionIds[0],
          routeKey: 'subscribe'
        },
        body: JSON.stringify({
          sheetId: dataIds[0]
        })
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Subscribed');
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockUpdate.mock.calls[0][0].Key.connectionId).toBe(connectionIds[0]);
      expect(mockPostToConnection).toHaveBeenCalledTimes(1);
    });
    
    test('SUB-002: Successful external source subscription', async () => {
      // Setup
      const { mockUpdate, mockQuery } = setupDynamoDBMock();
      const { mockPostToConnection } = setupApiGatewayMock();
      
      mockQuery.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Items: [{
            id: `${dataIds[1]}-timestamp`,
            sheetId: dataIds[1],
            data: JSON.stringify(sampleExternalData)
          }]
        })
      });
      
      // Input
      const event = {
        requestContext: {
          connectionId: connectionIds[0],
          routeKey: 'subscribe'
        },
        body: JSON.stringify({
          sourceId: dataIds[1],
          sourceType: 'external'
        })
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Subscribed');
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockPostToConnection).toHaveBeenCalledTimes(1);
      
      // Verify the message type is correct for external source
      const messageData = JSON.parse(mockPostToConnection.mock.calls[0][0].Data);
      expect(messageData.type).toBe('EXTERNAL_INITIAL_DATA');
    });
    
    test('SUB-003: Subscription with invalid body', async () => {
      // Input
      const event = {
        requestContext: {
          connectionId: connectionIds[0],
          routeKey: 'subscribe'
        },
        body: 'not-valid-json'
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(400);
      expect(result.body).toBe('Invalid request body');
    });
    
    test('SUB-004: Subscription with missing ID', async () => {
      // Input
      const event = {
        requestContext: {
          connectionId: connectionIds[0],
          routeKey: 'subscribe'
        },
        body: JSON.stringify({
          sourceType: 'external'
          // Missing sourceId
        })
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(400);
      expect(result.body).toBe('Missing ID parameter (sheetId or sourceId)');
    });
    
    test('SUB-005: Subscription to non-existent data', async () => {
      // Setup
      const { mockUpdate, mockQuery } = setupDynamoDBMock();
      
      // Return empty result from DynamoDB
      mockQuery.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Items: []
        })
      });
      
      // Input
      const event = {
        requestContext: {
          connectionId: connectionIds[0],
          routeKey: 'subscribe'
        },
        body: JSON.stringify({
          sheetId: 'non-existent-sheet'
        })
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Subscribed');
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      // No postToConnection should be called since there's no data
    });
    
    test('SUB-006: Subscription with DynamoDB update failure', async () => {
      // Setup
      const { mockUpdate } = setupDynamoDBMock();
      mockUpdate.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('DynamoDB error'))
      });
      
      // Input
      const event = {
        requestContext: {
          connectionId: connectionIds[0],
          routeKey: 'subscribe'
        },
        body: JSON.stringify({
          sheetId: dataIds[0]
        })
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('Failed to subscribe');
      expect(console.error).toHaveBeenCalled();
    });
    
    test('SUB-007: Subscription with API Gateway failure', async () => {
      // Setup
      const { mockUpdate, mockQuery } = setupDynamoDBMock();
      const { mockPostToConnection } = setupApiGatewayMock();
      
      mockQuery.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Items: [{
            id: `${dataIds[0]}-timestamp`,
            sheetId: dataIds[0],
            data: JSON.stringify(sampleSheetData)
          }]
        })
      });
      
      mockPostToConnection.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('API Gateway error'))
      });
      
      // Input
      const event = {
        requestContext: {
          connectionId: connectionIds[0],
          routeKey: 'subscribe'
        },
        body: JSON.stringify({
          sheetId: dataIds[0]
        })
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(500);
      expect(result.body).toContain('Failed to subscribe');
      expect(console.error).toHaveBeenCalled();
    });
    
    test('SUB-008: Subscription with stale connection', async () => {
      // Setup
      const { mockUpdate, mockQuery, mockDelete } = setupDynamoDBMock();
      const { mockPostToConnection } = setupApiGatewayMock();
      
      mockQuery.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Items: [{
            id: `${dataIds[0]}-timestamp`,
            sheetId: dataIds[0],
            data: JSON.stringify(sampleSheetData)
          }]
        })
      });
      
      // Mock 410 Gone error
      mockPostToConnection.mockReturnValue({
        promise: jest.fn().mockRejectedValue({ statusCode: 410 })
      });
      
      // Input
      const event = {
        requestContext: {
          connectionId: connectionIds[0],
          routeKey: 'subscribe'
        },
        body: JSON.stringify({
          sheetId: dataIds[0]
        })
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Subscribed');
      expect(mockDelete).toHaveBeenCalledTimes(1); // Connection should be deleted
    });
  });
  
  describe('SQS Message Processing Tests', () => {
    
    test('SQS-001: Process Google Sheets update', async () => {
      // Setup
      const { mockQuery } = setupDynamoDBMock();
      const { mockPostToConnection } = setupApiGatewayMock();
      
      // Mock connections subscribed to this sheet
      mockQuery.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Items: [
            { connectionId: connectionIds[0], sheetId: dataIds[0] },
            { connectionId: connectionIds[1], sheetId: dataIds[0] }
          ]
        })
      });
      
      // Input
      const event = {
        Records: [
          {
            eventSource: 'aws:sqs',
            body: JSON.stringify({
              sheetId: dataIds[0],
              changes: {
                type: 'update',
                data: sampleSheetData
              }
            })
          }
        ]
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Processed');
      expect(mockPostToConnection).toHaveBeenCalledTimes(2); // Two connections
      
      // Verify the message content
      const messageData = JSON.parse(mockPostToConnection.mock.calls[0][0].Data);
      expect(messageData.type).toBe('UPDATE');
      expect(messageData.data).toEqual(sampleSheetData);
    });
    
    test('SQS-002: Process external source update', async () => {
      // Setup
      const { mockQuery } = setupDynamoDBMock();
      const { mockPostToConnection } = setupApiGatewayMock();
      
      // Mock connections subscribed to this external source
      mockQuery.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Items: [
            { connectionId: connectionIds[0], sheetId: dataIds[1], sourceType: 'external' }
          ]
        })
      });
      
      // Input
      const event = {
        Records: [
          {
            eventSource: 'aws:sqs',
            body: JSON.stringify({
              sourceId: dataIds[1],
              sourceType: 'external',
              changes: {
                type: 'update',
                data: sampleExternalData
              }
            })
          }
        ]
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Processed');
      expect(mockPostToConnection).toHaveBeenCalledTimes(1);
      
      // Verify the message content
      const messageData = JSON.parse(mockPostToConnection.mock.calls[0][0].Data);
      expect(messageData.type).toBe('EXTERNAL_UPDATE');
      expect(messageData.data).toEqual(sampleExternalData);
    });
    
    test('SQS-004: Process SQS message with no subscribers', async () => {
      // Setup
      const { mockQuery } = setupDynamoDBMock();
      const { mockPostToConnection } = setupApiGatewayMock();
      
      // Mock no connections subscribed
      mockQuery.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Items: []
        })
      });
      
      // Input
      const event = {
        Records: [
          {
            eventSource: 'aws:sqs',
            body: JSON.stringify({
              sheetId: 'no-subscribers-sheet',
              changes: {
                type: 'update',
                data: sampleSheetData
              }
            })
          }
        ]
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Processed');
      expect(mockPostToConnection).not.toHaveBeenCalled(); // No connections to notify
    });
    
    test('SQS-006: Process SQS message with malformed body', async () => {
      // Input
      const event = {
        Records: [
          {
            eventSource: 'aws:sqs',
            body: 'not-valid-json'
          }
        ]
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(500);
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  describe('Edge Case Tests', () => {
    
    test('EDGE-001: Unsupported route key', async () => {
      // Input
      const event = {
        requestContext: {
          connectionId: connectionIds[0],
          routeKey: 'unsupported-route'
        }
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(400);
      expect(result.body).toBe('Unsupported route: unsupported-route');
    });
    
    test('EDGE-003: Empty SQS Records', async () => {
      // Input
      const event = {
        Records: []
      };
      
      // Execute
      const result = await handler(event);
      
      // Assert
      expect(result.statusCode).toBe(200);
      expect(result.body).toBe('Processed');
    });
  });
});