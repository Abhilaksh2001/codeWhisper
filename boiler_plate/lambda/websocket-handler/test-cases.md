# WebSocket Handler Lambda Test Cases

This document outlines comprehensive test cases for the WebSocket handler Lambda function, covering both typical scenarios and edge cases.

## Test Data Generation

### Connection IDs
```javascript
const connectionIds = [
  'abcdef123456',
  'connection-1234567890',
  'websocket-conn-0001',
  'a'.repeat(128), // Max length connection ID
  '特殊字符-connection' // Non-ASCII characters
];
```

### Sheet/Source IDs
```javascript
const dataIds = [
  'sheet-123456',
  'external-source-001',
  'a'.repeat(256), // Very long ID
  'sheet-with-special-chars!@#$',
  '中文表格ID' // Non-ASCII characters
];
```

### Sample Data
```javascript
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

const emptyData = [];

const malformedData = "Not a valid JSON string";
```

## 1. WebSocket Connection Tests

### 1.1 Successful Connection
**Test ID:** CONN-001  
**Description:** Test successful WebSocket connection  
**Input:**
```javascript
const event = {
  requestContext: {
    connectionId: connectionIds[0],
    routeKey: '$connect'
  }
};
```
**Expected Output:**
- Status code: 200
- Body: 'Connected'
- Connection record created in DynamoDB with TTL

### 1.2 Connection with DynamoDB Failure
**Test ID:** CONN-002  
**Description:** Test connection when DynamoDB put operation fails  
**Setup:** Mock DynamoDB put to throw an error  
**Input:** Same as CONN-001  
**Expected Output:**
- Status code: 500
- Body contains error message
- Error logged to CloudWatch

### 1.3 Connection with Very Long Connection ID
**Test ID:** CONN-003  
**Description:** Test connection with maximum length connection ID  
**Input:**
```javascript
const event = {
  requestContext: {
    connectionId: connectionIds[3], // Max length ID
    routeKey: '$connect'
  }
};
```
**Expected Output:**
- Status code: 200
- Body: 'Connected'
- Connection record created in DynamoDB

### 1.4 Connection with Non-ASCII Characters
**Test ID:** CONN-004  
**Description:** Test connection with non-ASCII characters in connection ID  
**Input:**
```javascript
const event = {
  requestContext: {
    connectionId: connectionIds[4], // Non-ASCII characters
    routeKey: '$connect'
  }
};
```
**Expected Output:**
- Status code: 200
- Body: 'Connected'
- Connection record created in DynamoDB

## 2. WebSocket Disconnection Tests

### 2.1 Successful Disconnection
**Test ID:** DISC-001  
**Description:** Test successful WebSocket disconnection  
**Setup:** Create a connection record in DynamoDB  
**Input:**
```javascript
const event = {
  requestContext: {
    connectionId: connectionIds[0],
    routeKey: '$disconnect'
  }
};
```
**Expected Output:**
- Status code: 200
- Body: 'Disconnected'
- Connection record deleted from DynamoDB

### 2.2 Disconnection with DynamoDB Failure
**Test ID:** DISC-002  
**Description:** Test disconnection when DynamoDB delete operation fails  
**Setup:** 
- Create a connection record in DynamoDB
- Mock DynamoDB delete to throw an error  
**Input:** Same as DISC-001  
**Expected Output:**
- Status code: 500
- Body contains error message
- Error logged to CloudWatch

### 2.3 Disconnection of Non-Existent Connection
**Test ID:** DISC-003  
**Description:** Test disconnection for a connection ID that doesn't exist  
**Setup:** Ensure no connection record exists  
**Input:**
```javascript
const event = {
  requestContext: {
    connectionId: 'non-existent-connection',
    routeKey: '$disconnect'
  }
};
```
**Expected Output:**
- Status code: 200
- Body: 'Disconnected'
- No errors (idempotent operation)

## 3. Subscription Tests

### 3.1 Successful Sheet Subscription
**Test ID:** SUB-001  
**Description:** Test successful subscription to a Google Sheet  
**Setup:** 
- Create a connection record in DynamoDB
- Create sheet data in DynamoDB  
**Input:**
```javascript
const event = {
  requestContext: {
    connectionId: connectionIds[0],
    routeKey: 'subscribe'
  },
  body: JSON.stringify({
    sheetId: dataIds[0]
  })
};
```
**Expected Output:**
- Status code: 200
- Body: 'Subscribed'
- Connection record updated with sheetId
- Initial data sent to connection

### 3.2 Successful External Source Subscription
**Test ID:** SUB-002  
**Description:** Test successful subscription to an external source  
**Setup:** 
- Create a connection record in DynamoDB
- Create external source data in DynamoDB  
**Input:**
```javascript
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
```
**Expected Output:**
- Status code: 200
- Body: 'Subscribed'
- Connection record updated with sourceId and sourceType
- Initial data sent to connection with type EXTERNAL_INITIAL_DATA

### 3.3 Subscription with Invalid Body
**Test ID:** SUB-003  
**Description:** Test subscription with invalid JSON body  
**Input:**
```javascript
const event = {
  requestContext: {
    connectionId: connectionIds[0],
    routeKey: 'subscribe'
  },
  body: 'not-valid-json'
};
```
**Expected Output:**
- Status code: 400
- Body: 'Invalid request body'

### 3.4 Subscription with Missing ID
**Test ID:** SUB-004  
**Description:** Test subscription with missing sheetId/sourceId  
**Input:**
```javascript
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
```
**Expected Output:**
- Status code: 400
- Body: 'Missing ID parameter (sheetId or sourceId)'

### 3.5 Subscription to Non-Existent Data
**Test ID:** SUB-005  
**Description:** Test subscription to a sheet/source that doesn't have data  
**Setup:** 
- Create a connection record in DynamoDB
- Ensure no data exists for the requested ID  
**Input:**
```javascript
const event = {
  requestContext: {
    connectionId: connectionIds[0],
    routeKey: 'subscribe'
  },
  body: JSON.stringify({
    sheetId: 'non-existent-sheet'
  })
};
```
**Expected Output:**
- Status code: 200
- Body: 'Subscribed'
- Connection record updated with sheetId
- No initial data sent (no error)

### 3.6 Subscription with DynamoDB Update Failure
**Test ID:** SUB-006  
**Description:** Test subscription when DynamoDB update operation fails  
**Setup:** 
- Create a connection record in DynamoDB
- Mock DynamoDB update to throw an error  
**Input:** Same as SUB-001  
**Expected Output:**
- Status code: 500
- Body contains error message
- Error logged to CloudWatch

### 3.7 Subscription with API Gateway Failure
**Test ID:** SUB-007  
**Description:** Test subscription when sending initial data fails  
**Setup:** 
- Create a connection record in DynamoDB
- Create sheet data in DynamoDB
- Mock apiGateway.postToConnection to throw an error (not 410)  
**Input:** Same as SUB-001  
**Expected Output:**
- Status code: 500
- Body contains error message
- Error logged to CloudWatch

### 3.8 Subscription with Stale Connection
**Test ID:** SUB-008  
**Description:** Test subscription when connection is stale  
**Setup:** 
- Create a connection record in DynamoDB
- Create sheet data in DynamoDB
- Mock apiGateway.postToConnection to throw an error with statusCode 410  
**Input:** Same as SUB-001  
**Expected Output:**
- Status code: 200
- Body: 'Subscribed'
- Connection record updated with sheetId
- Connection record deleted due to stale connection

## 4. SQS Message Processing Tests

### 4.1 Process Google Sheets Update
**Test ID:** SQS-001  
**Description:** Test processing SQS message for Google Sheets update  
**Setup:** 
- Create connection records in DynamoDB with subscriptions
- Create sheet data in DynamoDB  
**Input:**
```javascript
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
```
**Expected Output:**
- Status code: 200
- Body: 'Processed'
- Updates sent to all subscribed connections
- Log message indicating number of connections updated

### 4.2 Process External Source Update
**Test ID:** SQS-002  
**Description:** Test processing SQS message for external source update  
**Setup:** 
- Create connection records in DynamoDB with subscriptions
- Create external source data in DynamoDB  
**Input:**
```javascript
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
```
**Expected Output:**
- Status code: 200
- Body: 'Processed'
- Updates sent to all subscribed connections with type EXTERNAL_UPDATE
- Log message indicating number of connections updated

### 4.3 Process Multiple SQS Messages
**Test ID:** SQS-003  
**Description:** Test processing multiple SQS messages in one event  
**Setup:** 
- Create connection records in DynamoDB with various subscriptions
- Create data in DynamoDB  
**Input:**
```javascript
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
    },
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
```
**Expected Output:**
- Status code: 200
- Body: 'Processed'
- Updates sent to all subscribed connections for both messages
- Log messages for both updates

### 4.4 Process SQS Message with No Subscribers
**Test ID:** SQS-004  
**Description:** Test processing SQS message when no connections are subscribed  
**Setup:** 
- Ensure no connection records exist with the target subscription  
**Input:**
```javascript
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
```
**Expected Output:**
- Status code: 200
- Body: 'Processed'
- Log message indicating 0 connections updated
- No errors

### 4.5 Process SQS Message with Large Data
**Test ID:** SQS-005  
**Description:** Test processing SQS message with very large data payload  
**Setup:** 
- Create connection records in DynamoDB with subscriptions  
**Input:**
```javascript
const event = {
  Records: [
    {
      eventSource: 'aws:sqs',
      body: JSON.stringify({
        sheetId: dataIds[0],
        changes: {
          type: 'update',
          data: largeData
        }
      })
    }
  ]
};
```
**Expected Output:**
- Status code: 200
- Body: 'Processed'
- Updates sent to all subscribed connections
- No performance issues or timeouts

### 4.6 Process SQS Message with Malformed Body
**Test ID:** SQS-006  
**Description:** Test processing SQS message with malformed JSON body  
**Input:**
```javascript
const event = {
  Records: [
    {
      eventSource: 'aws:sqs',
      body: 'not-valid-json'
    }
  ]
};
```
**Expected Output:**
- Status code: 500
- Body contains error message
- Error logged to CloudWatch

### 4.7 Process SQS Message with Missing Fields
**Test ID:** SQS-007  
**Description:** Test processing SQS message with missing required fields  
**Input:**
```javascript
const event = {
  Records: [
    {
      eventSource: 'aws:sqs',
      body: JSON.stringify({
        // Missing sheetId/sourceId
        changes: {
          type: 'update',
          data: sampleSheetData
        }
      })
    }
  ]
};
```
**Expected Output:**
- Status code: 500
- Body contains error message
- Error logged to CloudWatch

## 5. Edge Case Tests

### 5.1 Unsupported Route Key
**Test ID:** EDGE-001  
**Description:** Test handling of unsupported WebSocket route key  
**Input:**
```javascript
const event = {
  requestContext: {
    connectionId: connectionIds[0],
    routeKey: 'unsupported-route'
  }
};
```
**Expected Output:**
- Status code: 400
- Body: 'Unsupported route: unsupported-route'

### 5.2 Missing Request Context
**Test ID:** EDGE-002  
**Description:** Test handling of event with missing requestContext  
**Input:**
```javascript
const event = {
  // Missing requestContext
};
```
**Expected Output:**
- Error logged to CloudWatch
- Appropriate error response

### 5.3 Empty SQS Records
**Test ID:** EDGE-003  
**Description:** Test handling of SQS event with empty Records array  
**Input:**
```javascript
const event = {
  Records: []
};
```
**Expected Output:**
- Status code: 200
- Body: 'Processed'
- No errors (nothing to process)

### 5.4 Lambda Timeout Simulation
**Test ID:** EDGE-004  
**Description:** Test behavior when Lambda execution approaches timeout  
**Setup:** 
- Create many connection records (100+) in DynamoDB with subscriptions
- Mock slow API Gateway responses  
**Input:** Same as SQS-001 but with many subscribers  
**Expected Behavior:**
- Function should handle as many connections as possible before timeout
- Partial success should be logged
- Consider implementing pagination or batching for large subscriber lists

### 5.5 DynamoDB Query Limit Exceeded
**Test ID:** EDGE-005  
**Description:** Test handling when DynamoDB query returns truncated results due to limit  
**Setup:** 
- Create many connection records (1000+) subscribed to the same sheet
- Ensure query will be truncated  
**Input:** Same as SQS-001 but with many subscribers  
**Expected Behavior:**
- Function should handle pagination correctly
- All connections should receive updates
- No errors due to truncation

## 6. Performance Tests

### 6.1 High Concurrency Test
**Test ID:** PERF-001  
**Description:** Test Lambda function under high concurrency  
**Setup:** Simulate multiple concurrent invocations  
**Expected Behavior:**
- All requests handled correctly
- No race conditions or data corruption
- Performance degradation within acceptable limits

### 6.2 Memory Usage Test
**Test ID:** PERF-002  
**Description:** Test memory usage with large payloads  
**Setup:** Use maximum allowed payload sizes  
**Expected Behavior:**
- Memory usage stays within allocated limits
- No out-of-memory errors

### 6.3 Cold Start Performance
**Test ID:** PERF-003  
**Description:** Measure cold start performance  
**Setup:** Ensure Lambda is cold before invocation  
**Expected Behavior:**
- Cold start time within acceptable limits
- All operations complete successfully

## 7. Integration Tests

### 7.1 End-to-End WebSocket Flow
**Test ID:** INT-001  
**Description:** Test complete flow from connection to subscription to update  
**Steps:**
1. Connect WebSocket
2. Subscribe to a sheet
3. Trigger an update via SQS
4. Verify update received
5. Disconnect WebSocket

**Expected Behavior:**
- All steps complete successfully
- Updates received in correct order
- Connection properly cleaned up after disconnect

### 7.2 Multiple Client Scenario
**Test ID:** INT-002  
**Description:** Test multiple clients subscribing to the same data source  
**Steps:**
1. Connect multiple WebSockets
2. Subscribe all to the same sheet
3. Trigger an update via SQS
4. Verify all clients receive the update

**Expected Behavior:**
- All clients receive updates
- System scales appropriately with number of clients

## Test Implementation Guidelines

1. **Mocking AWS Services:**
   - Use AWS SDK Mock or Jest mocks for DynamoDB, API Gateway, and SQS
   - Create helper functions for common mock setups

2. **Test Data Management:**
   - Create fixtures for test data
   - Use setup and teardown functions to manage test state

3. **Error Injection:**
   - Implement error injection for AWS service calls
   - Test both expected and unexpected error scenarios

4. **Performance Measurement:**
   - Add timing measurements for critical operations
   - Log memory usage for performance tests

5. **Test Coverage:**
   - Aim for >90% code coverage
   - Ensure all conditional branches are tested