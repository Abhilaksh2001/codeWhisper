const AWS = require('aws-sdk');
const axios = require('axios');
const xml2js = require('xml2js');

// Mock the modules
jest.mock('aws-sdk');
jest.mock('axios');
jest.mock('xml2js');

// Import the module under test
// Note: We're using a mock require to avoid actual execution of the module
jest.mock('../index', () => {
  // Extract the functions we want to test
  const originalModule = jest.requireActual('../index');
  return {
    fetchExternalData: originalModule.fetchExternalData,
    getLastKnownState: originalModule.getLastKnownState,
    saveCurrentState: originalModule.saveCurrentState,
    detectChanges: originalModule.detectChanges,
    sendChangeNotification: originalModule.sendChangeNotification,
    monitorSource: originalModule.monitorSource,
    monitoringLoop: originalModule.monitoringLoop,
    start: originalModule.start
  };
}, { virtual: true });

const {
  fetchExternalData,
  getLastKnownState,
  saveCurrentState,
  detectChanges,
  sendChangeNotification,
  monitorSource
} = require('../index');

// Test data
const testSources = [
  {
    id: 'stocks-api',
    url: 'https://api.example.com/stocks',
    type: 'json',
    headers: { 'Authorization': 'Bearer valid-token' }
  },
  {
    id: 'weather-api',
    url: 'https://api.example.com/weather',
    type: 'json',
    headers: { 'X-API-Key': 'valid-api-key' }
  },
  {
    id: 'products-catalog',
    url: 'https://api.example.com/products',
    type: 'xml',
    headers: {}
  },
  {
    id: 'very-long-source-id-' + 'a'.repeat(100),
    url: 'https://api.example.com/long-id',
    type: 'json',
    headers: {}
  },
  {
    id: '特殊字符-source',
    url: 'https://api.example.com/special-chars',
    type: 'json',
    headers: {}
  }
];

const jsonResponses = {
  'stocks-api': {
    initial: {
      stocks: [
        { symbol: 'AAPL', price: 150.25 },
        { symbol: 'MSFT', price: 290.10 }
      ],
      lastUpdated: '2023-01-01T12:00:00Z'
    },
    updated: {
      stocks: [
        { symbol: 'AAPL', price: 152.75 },
        { symbol: 'MSFT', price: 288.30 }
      ],
      lastUpdated: '2023-01-01T13:00:00Z'
    }
  },
  'weather-api': {
    initial: {
      location: 'New York',
      temperature: 72,
      conditions: 'Sunny'
    },
    updated: {
      location: 'New York',
      temperature: 68,
      conditions: 'Cloudy'
    }
  }
};

const xmlResponses = {
  'products-catalog': {
    initial: `<?xml version="1.0" encoding="UTF-8"?>
<products>
  <product>
    <id>1</id>
    <name>Laptop</name>
    <price>999.99</price>
  </product>
  <product>
    <id>2</id>
    <name>Smartphone</name>
    <price>699.99</price>
  </product>
</products>`,
    updated: `<?xml version="1.0" encoding="UTF-8"?>
<products>
  <product>
    <id>1</id>
    <name>Laptop</name>
    <price>949.99</price>
  </product>
  <product>
    <id>2</id>
    <name>Smartphone</name>
    <price>699.99</price>
  </product>
  <product>
    <id>3</id>
    <name>Headphones</name>
    <price>149.99</price>
  </product>
</products>`
  }
};

const parsedXmlResponses = {
  'products-catalog': {
    initial: {
      products: {
        product: [
          { id: '1', name: 'Laptop', price: '999.99' },
          { id: '2', name: 'Smartphone', price: '699.99' }
        ]
      }
    },
    updated: {
      products: {
        product: [
          { id: '1', name: 'Laptop', price: '949.99' },
          { id: '2', name: 'Smartphone', price: '699.99' },
          { id: '3', name: 'Headphones', price: '149.99' }
        ]
      }
    }
  }
};

const largeJsonResponse = {
  items: Array(1000).fill().map((_, i) => ({
    id: i,
    name: `Item ${i}`,
    description: `Description for item ${i}`,
    attributes: {
      color: i % 3 === 0 ? 'red' : i % 3 === 1 ? 'green' : 'blue',
      size: i % 4 === 0 ? 'small' : i % 4 === 1 ? 'medium' : i % 4 === 2 ? 'large' : 'xlarge',
      weight: Math.random() * 100
    }
  }))
};

const malformedResponses = {
  invalidJson: '{"stocks": [{"symbol": "AAPL", "price": 150.25},',
  invalidXml: '<?xml version="1.0" encoding="UTF-8"?><products><product><id>1</id><name>Laptop</name><price>999.99</price></product',
  emptyResponse: '',
  nonJsonResponse: 'This is not JSON or XML'
};

// Mock setup helpers
const setupDynamoDBMock = () => {
  const mockPut = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({})
  });
  
  const mockQuery = jest.fn().mockReturnValue({
    promise: jest.fn().mockResolvedValue({ Items: [] })
  });
  
  AWS.DynamoDB.DocumentClient.mockImplementation(() => ({
    put: mockPut,
    query: mockQuery
  }));
  
  return { mockPut, mockQuery };
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

const setupXmlParserMock = () => {
  const mockParseStringPromise = jest.fn();
  
  xml2js.Parser.mockImplementation(() => ({
    parseStringPromise: mockParseStringPromise
  }));
  
  return { mockParseStringPromise };
};

describe('External Source Monitor Tests', () => {
  
  beforeEach(() => {
    jest.clearAllMocks();
    console.log = jest.fn(); // Mock console.log
    console.error = jest.fn(); // Mock console.error
    
    // Reset environment variables
    process.env.DATA_TABLE = 'sheets-data-dev';
    process.env.SQS_QUEUE_URL = 'https://sqs.example.com/queue';
  });
  
  describe('External Source Fetching Tests', () => {
    
    test('FETCH-001: Successful JSON fetch', async () => {
      // Setup
      axios.get.mockResolvedValue({
        data: jsonResponses['stocks-api'].initial
      });
      
      // Execute
      const result = await fetchExternalData(testSources[0]);
      
      // Assert
      expect(axios.get).toHaveBeenCalledWith(
        testSources[0].url,
        expect.objectContaining({
          headers: testSources[0].headers
        })
      );
      expect(result).toEqual(jsonResponses['stocks-api'].initial);
    });
    
    test('FETCH-002: Successful XML fetch', async () => {
      // Setup
      const { mockParseStringPromise } = setupXmlParserMock();
      
      axios.get.mockResolvedValue({
        data: xmlResponses['products-catalog'].initial
      });
      
      mockParseStringPromise.mockResolvedValue(
        parsedXmlResponses['products-catalog'].initial
      );
      
      // Execute
      const result = await fetchExternalData(testSources[2]);
      
      // Assert
      expect(axios.get).toHaveBeenCalledWith(
        testSources[2].url,
        expect.objectContaining({
          headers: testSources[2].headers
        })
      );
      expect(mockParseStringPromise).toHaveBeenCalledWith(
        xmlResponses['products-catalog'].initial
      );
      expect(result).toEqual(parsedXmlResponses['products-catalog'].initial);
    });
    
    test('FETCH-003: HTTP error response', async () => {
      // Setup
      axios.get.mockRejectedValue({
        response: {
          status: 404,
          statusText: 'Not Found'
        }
      });
      
      // Execute and Assert
      await expect(fetchExternalData(testSources[0])).rejects.toEqual(
        expect.objectContaining({
          response: expect.objectContaining({
            status: 404
          })
        })
      );
      expect(console.error).toHaveBeenCalled();
    });
    
    test('FETCH-004: Network timeout', async () => {
      // Setup
      axios.get.mockRejectedValue(new Error('timeout of 10000ms exceeded'));
      
      // Execute and Assert
      await expect(fetchExternalData(testSources[0])).rejects.toThrow('timeout');
      expect(console.error).toHaveBeenCalled();
    });
    
    test('FETCH-005: Invalid JSON response', async () => {
      // Setup
      axios.get.mockResolvedValue({
        data: malformedResponses.invalidJson
      });
      
      // Execute
      const promise = fetchExternalData({
        ...testSources[0],
        type: 'json'
      });
      
      // Assert
      await expect(promise).resolves.toEqual(malformedResponses.invalidJson);
      // Note: In the actual implementation, this might throw an error when parsing,
      // but our mock just returns the raw data
    });
    
    test('FETCH-006: Invalid XML response', async () => {
      // Setup
      const { mockParseStringPromise } = setupXmlParserMock();
      
      axios.get.mockResolvedValue({
        data: malformedResponses.invalidXml
      });
      
      mockParseStringPromise.mockRejectedValue(
        new Error('Invalid XML')
      );
      
      // Execute and Assert
      await expect(fetchExternalData(testSources[2])).rejects.toThrow('Invalid XML');
      expect(console.error).toHaveBeenCalled();
    });
    
    test('FETCH-007: Empty response', async () => {
      // Setup
      axios.get.mockResolvedValue({
        data: ''
      });
      
      // Execute
      const result = await fetchExternalData(testSources[0]);
      
      // Assert
      expect(result).toBe('');
    });
    
    test('FETCH-008: Large response', async () => {
      // Setup
      axios.get.mockResolvedValue({
        data: largeJsonResponse
      });
      
      // Execute
      const result = await fetchExternalData(testSources[0]);
      
      // Assert
      expect(result).toEqual(largeJsonResponse);
      expect(result.items.length).toBe(1000);
    });
  });
  
  describe('DynamoDB Interaction Tests', () => {
    
    test('DB-001: Get last known state - existing data', async () => {
      // Setup
      const { mockQuery } = setupDynamoDBMock();
      const lastState = {
        id: 'stocks-api-timestamp',
        sheetId: 'stocks-api',
        data: JSON.stringify(jsonResponses['stocks-api'].initial),
        lastUpdated: '2023-01-01T12:00:00Z'
      };
      
      mockQuery.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Items: [lastState]
        })
      });
      
      // Execute
      const result = await getLastKnownState('stocks-api');
      
      // Assert
      expect(mockQuery).toHaveBeenCalledWith(expect.objectContaining({
        TableName: 'sheets-data-dev',
        KeyConditionExpression: 'sheetId = :sourceId',
        ExpressionAttributeValues: {
          ':sourceId': 'stocks-api'
        }
      }));
      expect(result).toEqual(lastState);
    });
    
    test('DB-002: Get last known state - no data', async () => {
      // Setup
      const { mockQuery } = setupDynamoDBMock();
      
      mockQuery.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Items: []
        })
      });
      
      // Execute
      const result = await getLastKnownState('new-source-id');
      
      // Assert
      expect(mockQuery).toHaveBeenCalled();
      expect(result).toBeNull();
    });
    
    test('DB-003: Get last known state - DynamoDB error', async () => {
      // Setup
      const { mockQuery } = setupDynamoDBMock();
      
      mockQuery.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('DynamoDB error'))
      });
      
      // Execute and Assert
      await expect(getLastKnownState('stocks-api')).rejects.toThrow('DynamoDB error');
      expect(console.error).toHaveBeenCalled();
    });
    
    test('DB-004: Save current state - successful', async () => {
      // Setup
      const { mockPut } = setupDynamoDBMock();
      const sourceId = 'stocks-api';
      const data = jsonResponses['stocks-api'].updated;
      
      // Execute
      await saveCurrentState(sourceId, data);
      
      // Assert
      expect(mockPut).toHaveBeenCalledWith(expect.objectContaining({
        TableName: 'sheets-data-dev',
        Item: expect.objectContaining({
          sheetId: sourceId,
          data: JSON.stringify(data),
          sourceType: 'external'
        })
      }));
    });
    
    test('DB-005: Save current state - DynamoDB error', async () => {
      // Setup
      const { mockPut } = setupDynamoDBMock();
      
      mockPut.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('DynamoDB error'))
      });
      
      // Execute and Assert
      await expect(saveCurrentState('stocks-api', jsonResponses['stocks-api'].updated))
        .rejects.toThrow('DynamoDB error');
      expect(console.error).toHaveBeenCalled();
    });
    
    test('DB-006: Save current state - large data', async () => {
      // Setup
      const { mockPut } = setupDynamoDBMock();
      const sourceId = 'large-data-source';
      
      // Execute
      await saveCurrentState(sourceId, largeJsonResponse);
      
      // Assert
      expect(mockPut).toHaveBeenCalledWith(expect.objectContaining({
        TableName: 'sheets-data-dev',
        Item: expect.objectContaining({
          sheetId: sourceId,
          data: JSON.stringify(largeJsonResponse)
        })
      }));
    });
  });
  
  describe('Change Detection Tests', () => {
    
    test('CHANGE-001: Detect initial data', () => {
      // Execute
      const result = detectChanges(jsonResponses['stocks-api'].initial, null);
      
      // Assert
      expect(result).toEqual({
        type: 'initial',
        data: jsonResponses['stocks-api'].initial
      });
    });
    
    test('CHANGE-002: Detect no changes', () => {
      // Execute
      const result = detectChanges(
        jsonResponses['stocks-api'].initial,
        JSON.stringify(jsonResponses['stocks-api'].initial)
      );
      
      // Assert
      expect(result).toBeNull();
    });
    
    test('CHANGE-003: Detect changes', () => {
      // Execute
      const result = detectChanges(
        jsonResponses['stocks-api'].updated,
        JSON.stringify(jsonResponses['stocks-api'].initial)
      );
      
      // Assert
      expect(result).toEqual({
        type: 'update',
        data: jsonResponses['stocks-api'].updated
      });
    });
    
    test('CHANGE-004: Handle string vs object previous data', () => {
      // Test with string previous data
      const resultWithString = detectChanges(
        jsonResponses['stocks-api'].updated,
        JSON.stringify(jsonResponses['stocks-api'].initial)
      );
      
      // Test with object previous data
      const resultWithObject = detectChanges(
        jsonResponses['stocks-api'].updated,
        jsonResponses['stocks-api'].initial
      );
      
      // Assert both produce the same result
      expect(resultWithString).toEqual(resultWithObject);
    });
  });
  
  describe('SQS Notification Tests', () => {
    
    test('SQS-001: Send change notification - successful', async () => {
      // Setup
      const { mockSendMessage } = setupSQSMock();
      const sourceId = 'stocks-api';
      const changes = {
        type: 'update',
        data: jsonResponses['stocks-api'].updated
      };
      
      // Execute
      await sendChangeNotification(sourceId, changes);
      
      // Assert
      expect(mockSendMessage).toHaveBeenCalledWith(expect.objectContaining({
        QueueUrl: 'https://sqs.example.com/queue',
        MessageBody: expect.stringContaining(sourceId)
      }));
      
      // Verify message content
      const messageBody = JSON.parse(mockSendMessage.mock.calls[0][0].MessageBody);
      expect(messageBody.sourceId).toBe(sourceId);
      expect(messageBody.sourceType).toBe('external');
      expect(messageBody.changes).toEqual(changes);
    });
    
    test('SQS-002: Send change notification - SQS error', async () => {
      // Setup
      const { mockSendMessage } = setupSQSMock();
      
      mockSendMessage.mockReturnValue({
        promise: jest.fn().mockRejectedValue(new Error('SQS error'))
      });
      
      // Execute and Assert
      await expect(sendChangeNotification('stocks-api', { type: 'update', data: {} }))
        .rejects.toThrow('SQS error');
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  describe('Source Monitoring Tests', () => {
    
    test('MONITOR-001: Single source monitoring - no changes', async () => {
      // Setup
      const { mockQuery } = setupDynamoDBMock();
      const { mockSendMessage } = setupSQSMock();
      
      // Mock axios to return data
      axios.get.mockResolvedValue({
        data: jsonResponses['stocks-api'].initial
      });
      
      // Mock DynamoDB to return the same data
      mockQuery.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Items: [{
            id: 'stocks-api-timestamp',
            sheetId: 'stocks-api',
            data: JSON.stringify(jsonResponses['stocks-api'].initial)
          }]
        })
      });
      
      // Execute
      await monitorSource(testSources[0]);
      
      // Assert
      expect(axios.get).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalled();
      expect(mockSendMessage).not.toHaveBeenCalled(); // No changes, no notification
    });
    
    test('MONITOR-002: Single source monitoring - with changes', async () => {
      // Setup
      const { mockQuery, mockPut } = setupDynamoDBMock();
      const { mockSendMessage } = setupSQSMock();
      
      // Mock axios to return updated data
      axios.get.mockResolvedValue({
        data: jsonResponses['stocks-api'].updated
      });
      
      // Mock DynamoDB to return initial data
      mockQuery.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Items: [{
            id: 'stocks-api-timestamp',
            sheetId: 'stocks-api',
            data: JSON.stringify(jsonResponses['stocks-api'].initial)
          }]
        })
      });
      
      // Execute
      await monitorSource(testSources[0]);
      
      // Assert
      expect(axios.get).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalled();
      expect(mockPut).toHaveBeenCalled(); // Should save new state
      expect(mockSendMessage).toHaveBeenCalled(); // Should send notification
    });
    
    test('MONITOR-003: Single source monitoring - first run', async () => {
      // Setup
      const { mockQuery, mockPut } = setupDynamoDBMock();
      const { mockSendMessage } = setupSQSMock();
      
      // Mock axios to return data
      axios.get.mockResolvedValue({
        data: jsonResponses['stocks-api'].initial
      });
      
      // Mock DynamoDB to return no previous data
      mockQuery.mockReturnValue({
        promise: jest.fn().mockResolvedValue({
          Items: []
        })
      });
      
      // Execute
      await monitorSource(testSources[0]);
      
      // Assert
      expect(axios.get).toHaveBeenCalled();
      expect(mockQuery).toHaveBeenCalled();
      expect(mockPut).toHaveBeenCalled(); // Should save initial state
      expect(mockSendMessage).toHaveBeenCalled(); // Should send initial notification
      
      // Verify message type is 'initial'
      const messageBody = JSON.parse(mockSendMessage.mock.calls[0][0].MessageBody);
      expect(messageBody.changes.type).toBe('initial');
    });
    
    test('MONITOR-004: Single source monitoring - API error', async () => {
      // Setup
      const { mockQuery, mockPut } = setupDynamoDBMock();
      const { mockSendMessage } = setupSQSMock();
      
      // Mock axios to throw error
      axios.get.mockRejectedValue(new Error('API error'));
      
      // Execute
      await monitorSource(testSources[0]);
      
      // Assert
      expect(axios.get).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
      expect(mockPut).not.toHaveBeenCalled(); // Should not save state
      expect(mockSendMessage).not.toHaveBeenCalled(); // Should not send notification
    });
  });
});