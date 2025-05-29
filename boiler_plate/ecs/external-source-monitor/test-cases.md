# External Source Monitor Test Cases

This document outlines comprehensive test cases for the External Source Monitor service, covering both typical scenarios and edge cases.

## Test Data Generation

### External Source Configurations
```javascript
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
```

### Sample API Responses
```javascript
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
```

## 1. Initialization Tests

### 1.1 Successful Initialization
**Test ID:** INIT-001  
**Description:** Test successful initialization of the monitoring service  
**Setup:** Configure environment variables with valid values  
**Expected Behavior:**
- Google Sheets API client initialized successfully
- Monitoring loop started
- Log message indicating service started

### 1.2 Missing SQS Queue URL
**Test ID:** INIT-002  
**Description:** Test initialization with missing SQS_QUEUE_URL environment variable  
**Setup:** Omit SQS_QUEUE_URL environment variable  
**Expected Behavior:**
- Error logged: 'SQS_QUEUE_URL environment variable is required'
- Process exits with code 1

### 1.3 Empty External Sources Configuration
**Test ID:** INIT-003  
**Description:** Test initialization with empty EXTERNAL_SOURCES environment variable  
**Setup:** Set EXTERNAL_SOURCES to '[]'  
**Expected Behavior:**
- Warning logged: 'No external sources configured for monitoring'
- Service starts successfully but doesn't monitor any sources

### 1.4 Invalid External Sources JSON
**Test ID:** INIT-004  
**Description:** Test initialization with invalid JSON in EXTERNAL_SOURCES environment variable  
**Setup:** Set EXTERNAL_SOURCES to invalid JSON string  
**Expected Behavior:**
- Error logged about JSON parsing failure
- Process exits with code 1

## 2. External Source Fetching Tests

### 2.1 Successful JSON Fetch
**Test ID:** FETCH-001  
**Description:** Test successful fetching of JSON data from external source  
**Setup:** 
- Mock axios to return successful response with JSON data
- Configure source with type 'json'  
**Input:** testSources[0] (stocks-api)  
**Expected Behavior:**
- Data fetched successfully
- Data returned in parsed JSON format
- Log message indicating successful fetch

### 2.2 Successful XML Fetch
**Test ID:** FETCH-002  
**Description:** Test successful fetching of XML data from external source  
**Setup:** 
- Mock axios to return successful response with XML data
- Configure source with type 'xml'  
**Input:** testSources[2] (products-catalog)  
**Expected Behavior:**
- Data fetched successfully
- XML data parsed to JSON format
- Log message indicating successful fetch

### 2.3 HTTP Error Response
**Test ID:** FETCH-003  
**Description:** Test handling of HTTP error from external source  
**Setup:** Mock axios to return 404 error  
**Input:** testSources[0] (stocks-api)  
**Expected Behavior:**
- Error logged with appropriate details
- Error propagated to caller
- No data returned

### 2.4 Network Timeout
**Test ID:** FETCH-004  
**Description:** Test handling of network timeout  
**Setup:** Mock axios to throw timeout error  
**Input:** testSources[0] (stocks-api)  
**Expected Behavior:**
- Error logged with timeout details
- Error propagated to caller
- No data returned

### 2.5 Invalid JSON Response
**Test ID:** FETCH-005  
**Description:** Test handling of invalid JSON response  
**Setup:** 
- Mock axios to return successful response with invalid JSON
- Configure source with type 'json'  
**Input:** testSources[0] (stocks-api)  
**Expected Behavior:**
- Error logged about JSON parsing failure
- Error propagated to caller
- No data returned

### 2.6 Invalid XML Response
**Test ID:** FETCH-006  
**Description:** Test handling of invalid XML response  
**Setup:** 
- Mock axios to return successful response with invalid XML
- Configure source with type 'xml'  
**Input:** testSources[2] (products-catalog)  
**Expected Behavior:**
- Error logged about XML parsing failure
- Error propagated to caller
- No data returned

### 2.7 Empty Response
**Test ID:** FETCH-007  
**Description:** Test handling of empty response  
**Setup:** Mock axios to return empty response  
**Input:** testSources[0] (stocks-api)  
**Expected Behavior:**
- Appropriate handling of empty response
- Empty data object returned or error logged
- No unexpected errors

### 2.8 Large Response
**Test ID:** FETCH-008  
**Description:** Test handling of very large response  
**Setup:** Mock axios to return large JSON response  
**Input:** testSources[0] (stocks-api)  
**Expected Behavior:**
- Data fetched and parsed successfully
- No memory issues or timeouts
- Complete data returned

## 3. DynamoDB Interaction Tests

### 3.1 Get Last Known State - Existing Data
**Test ID:** DB-001  
**Description:** Test retrieving last known state when data exists  
**Setup:** 
- Mock DynamoDB query to return sample data
- Configure with valid source ID  
**Input:** 'stocks-api'  
**Expected Behavior:**
- Query executed with correct parameters
- Last known state returned
- No errors

### 3.2 Get Last Known State - No Data
**Test ID:** DB-002  
**Description:** Test retrieving last known state when no data exists  
**Setup:** 
- Mock DynamoDB query to return empty result
- Configure with valid source ID  
**Input:** 'new-source-id'  
**Expected Behavior:**
- Query executed with correct parameters
- Null returned
- No errors

### 3.3 Get Last Known State - DynamoDB Error
**Test ID:** DB-003  
**Description:** Test retrieving last known state when DynamoDB throws error  
**Setup:** Mock DynamoDB query to throw error  
**Input:** 'stocks-api'  
**Expected Behavior:**
- Error logged with appropriate details
- Error propagated to caller
- No data returned

### 3.4 Save Current State - Successful
**Test ID:** DB-004  
**Description:** Test saving current state successfully  
**Setup:** 
- Mock DynamoDB put to succeed
- Configure with valid source ID and data  
**Input:** 
- sourceId: 'stocks-api'
- data: jsonResponses['stocks-api'].updated  
**Expected Behavior:**
- Put executed with correct parameters
- Success logged
- No errors

### 3.5 Save Current State - DynamoDB Error
**Test ID:** DB-005  
**Description:** Test saving current state when DynamoDB throws error  
**Setup:** Mock DynamoDB put to throw error  
**Input:** 
- sourceId: 'stocks-api'
- data: jsonResponses['stocks-api'].updated  
**Expected Behavior:**
- Error logged with appropriate details
- Error propagated to caller

### 3.6 Save Current State - Large Data
**Test ID:** DB-006  
**Description:** Test saving very large data set  
**Setup:** 
- Mock DynamoDB put to succeed
- Configure with valid source ID and large data  
**Input:** 
- sourceId: 'large-data-source'
- data: largeJsonResponse  
**Expected Behavior:**
- Data successfully stringified and saved
- No size limitations encountered
- Success logged

## 4. Change Detection Tests

### 4.1 Detect Initial Data
**Test ID:** CHANGE-001  
**Description:** Test change detection for initial data (no previous data)  
**Input:** 
- currentData: jsonResponses['stocks-api'].initial
- previousData: null  
**Expected Output:**
- Change detected with type 'initial'
- Current data included in changes

### 4.2 Detect No Changes
**Test ID:** CHANGE-002  
**Description:** Test change detection when data hasn't changed  
**Input:** 
- currentData: jsonResponses['stocks-api'].initial
- previousData: JSON.stringify(jsonResponses['stocks-api'].initial)  
**Expected Output:**
- Null returned (no changes detected)

### 4.3 Detect Changes
**Test ID:** CHANGE-003  
**Description:** Test change detection when data has changed  
**Input:** 
- currentData: jsonResponses['stocks-api'].updated
- previousData: JSON.stringify(jsonResponses['stocks-api'].initial)  
**Expected Output:**
- Change detected with type 'update'
- Updated data included in changes

### 4.4 Handle String vs Object Previous Data
**Test ID:** CHANGE-004  
**Description:** Test change detection handles both string and object previous data  
**Input:** 
- Test both string and object formats for previousData  
**Expected Behavior:**
- Both formats handled correctly
- Consistent change detection results

### 4.5 Detect Changes in Large Data
**Test ID:** CHANGE-005  
**Description:** Test change detection with very large data sets  
**Input:** 
- Large data sets with small changes  
**Expected Behavior:**
- Changes detected correctly
- Performance remains acceptable

## 5. SQS Notification Tests

### 5.1 Send Change Notification - Successful
**Test ID:** SQS-001  
**Description:** Test successful sending of change notification to SQS  
**Setup:** 
- Mock SQS sendMessage to succeed
- Configure with valid source ID and changes  
**Input:** 
- sourceId: 'stocks-api'
- changes: { type: 'update', data: jsonResponses['stocks-api'].updated }  
**Expected Behavior:**
- SQS message sent with correct parameters
- Success logged
- No errors

### 5.2 Send Change Notification - SQS Error
**Test ID:** SQS-002  
**Description:** Test sending change notification when SQS throws error  
**Setup:** Mock SQS sendMessage to throw error  
**Input:** 
- sourceId: 'stocks-api'
- changes: { type: 'update', data: jsonResponses['stocks-api'].updated }  
**Expected Behavior:**
- Error logged with appropriate details
- Error propagated to caller

### 5.3 Send Change Notification - Large Payload
**Test ID:** SQS-003  
**Description:** Test sending very large change notification  
**Setup:** 
- Mock SQS sendMessage to succeed
- Configure with valid source ID and large changes  
**Input:** 
- sourceId: 'large-data-source'
- changes: { type: 'update', data: largeJsonResponse }  
**Expected Behavior:**
- Message size checked against SQS limits
- Appropriate handling if size exceeds limits
- Success logged if within limits

## 6. Monitoring Loop Tests

### 6.1 Single Source Monitoring - No Changes
**Test ID:** MONITOR-001  
**Description:** Test monitoring a single source with no changes  
**Setup:** 
- Mock all dependencies
- Configure source to return same data as last known state  
**Input:** testSources[0] (stocks-api)  
**Expected Behavior:**
- Source checked successfully
- No changes detected
- No updates to DynamoDB or SQS
- Appropriate logging

### 6.2 Single Source Monitoring - With Changes
**Test ID:** MONITOR-002  
**Description:** Test monitoring a single source with changes  
**Setup:** 
- Mock all dependencies
- Configure source to return different data from last known state  
**Input:** testSources[0] (stocks-api)  
**Expected Behavior:**
- Source checked successfully
- Changes detected
- Current state saved to DynamoDB
- Notification sent to SQS
- Appropriate logging

### 6.3 Single Source Monitoring - First Run
**Test ID:** MONITOR-003  
**Description:** Test monitoring a single source for the first time (no last known state)  
**Setup:** 
- Mock all dependencies
- Configure DynamoDB to return null for last known state  
**Input:** testSources[0] (stocks-api)  
**Expected Behavior:**
- Source checked successfully
- Initial data detected as change
- Current state saved to DynamoDB
- Notification sent to SQS
- Appropriate logging

### 6.4 Single Source Monitoring - API Error
**Test ID:** MONITOR-004  
**Description:** Test monitoring a single source when API request fails  
**Setup:** 
- Mock fetchExternalData to throw error
- Configure with valid source  
**Input:** testSources[0] (stocks-api)  
**Expected Behavior:**
- Error logged
- Monitoring continues (doesn't break the loop)
- No updates to DynamoDB or SQS

### 6.5 Multiple Source Monitoring
**Test ID:** MONITOR-005  
**Description:** Test monitoring multiple sources in sequence  
**Setup:** 
- Mock all dependencies
- Configure multiple sources with various scenarios  
**Input:** Multiple test sources  
**Expected Behavior:**
- All sources checked in sequence
- Appropriate handling for each source
- Monitoring loop continues even if some sources fail
- Appropriate logging for each source

### 6.6 Monitoring Loop Scheduling
**Test ID:** MONITOR-006  
**Description:** Test that monitoring loop reschedules itself  
**Setup:** 
- Mock setTimeout
- Configure with test sources  
**Expected Behavior:**
- setTimeout called with monitoringLoop function
- Correct polling interval used
- Loop continues after processing all sources

## 7. Error Handling and Edge Cases

### 7.1 Handle Source with Invalid URL
**Test ID:** EDGE-001  
**Description:** Test handling of source with invalid URL  
**Setup:** Configure source with invalid URL  
**Input:** { id: 'invalid-url', url: 'not-a-valid-url', type: 'json' }  
**Expected Behavior:**
- Error logged
- Monitoring continues for other sources
- No unexpected crashes

### 7.2 Handle Source with Very Long URL
**Test ID:** EDGE-002  
**Description:** Test handling of source with very long URL  
**Setup:** Configure source with URL exceeding 2000 characters  
**Input:** { id: 'long-url', url: 'https://example.com/' + 'a'.repeat(2000), type: 'json' }  
**Expected Behavior:**
- Request attempted
- Appropriate error handling if URL is too long
- No unexpected crashes

### 7.3 Handle Source with Invalid Type
**Test ID:** EDGE-003  
**Description:** Test handling of source with invalid type  
**Setup:** Configure source with type other than 'json' or 'xml'  
**Input:** { id: 'invalid-type', url: 'https://example.com/data', type: 'csv' }  
**Expected Behavior:**
- Default to JSON handling
- Attempt to process response as JSON
- Appropriate error handling if processing fails

### 7.4 Handle Very Long Source ID
**Test ID:** EDGE-004  
**Description:** Test handling of source with very long ID  
**Setup:** Configure source with very long ID  
**Input:** testSources[3] (very-long-source-id)  
**Expected Behavior:**
- Source processed correctly
- No issues with DynamoDB keys or SQS messages
- No unexpected crashes

### 7.5 Handle Non-ASCII Characters in Source ID
**Test ID:** EDGE-005  
**Description:** Test handling of source with non-ASCII characters in ID  
**Setup:** Configure source with non-ASCII characters in ID  
**Input:** testSources[4] (特殊字符-source)  
**Expected Behavior:**
- Source processed correctly
- No issues with DynamoDB keys or SQS messages
- No unexpected crashes

### 7.6 Handle Process Termination Signals
**Test ID:** EDGE-006  
**Description:** Test handling of SIGTERM and SIGINT signals  
**Setup:** Trigger process signals  
**Expected Behavior:**
- Graceful shutdown
- Appropriate logging
- Process exits with code 0

## 8. Performance Tests

### 8.1 Memory Usage Test
**Test ID:** PERF-001  
**Description:** Test memory usage during monitoring loop  
**Setup:** 
- Configure with multiple sources including large data
- Monitor memory usage during execution  
**Expected Behavior:**
- Memory usage stays within reasonable limits
- No memory leaks over time
- No out-of-memory errors

### 8.2 CPU Usage Test
**Test ID:** PERF-002  
**Description:** Test CPU usage during monitoring loop  
**Setup:** 
- Configure with multiple sources
- Monitor CPU usage during execution  
**Expected Behavior:**
- CPU usage spikes only during active processing
- Returns to baseline between polling intervals
- No excessive CPU usage

### 8.3 Long-Running Stability Test
**Test ID:** PERF-003  
**Description:** Test stability over long running period  
**Setup:** 
- Configure with multiple sources
- Run for extended period (hours)  
**Expected Behavior:**
- Consistent behavior over time
- No degradation in performance
- No memory leaks
- Reliable scheduling of monitoring loop

## Test Implementation Guidelines

1. **Mocking External Dependencies:**
   - Use Jest mocks for axios, AWS SDK, and other dependencies
   - Create helper functions for common mock setups

2. **Environment Variable Management:**
   - Use Jest's setup files to manage environment variables
   - Reset environment between tests

3. **Time Management:**
   - Use Jest's fake timers for testing scheduling
   - Control time progression in tests

4. **Test Isolation:**
   - Ensure tests don't interfere with each other
   - Reset all mocks between tests

5. **Test Coverage:**
   - Aim for >90% code coverage
   - Ensure all conditional branches are tested