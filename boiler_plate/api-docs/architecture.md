# Architecture Overview

## System Components

### 1. Data Source Monitoring

#### Google Sheets Monitor (ECS Service)
- **Purpose**: Continuously monitors Google Sheets for changes
- **Implementation**: Long-running ECS Fargate container
- **Key Features**:
  - Polls Google Sheets API at regular intervals
  - Detects changes by comparing with previous state
  - Sends change notifications to SQS

#### External Source Monitor (ECS Service)
- **Purpose**: Monitors external JSON/XML data sources for changes
- **Implementation**: Long-running ECS Fargate container
- **Key Features**:
  - Dynamically loads data source configurations from DynamoDB
  - Supports both JSON and XML formats
  - Handles API authentication with secure key storage
  - Sends change notifications to SQS

### 2. Data Source Management API

#### List Data Sources (Lambda Function)
- **Purpose**: Lists all available data sources
- **Endpoint**: GET /datasources
- **Implementation**: Dedicated Lambda function (list.js)

#### Get Data Source (Lambda Function)
- **Purpose**: Gets details of a specific data source
- **Endpoint**: GET /datasources/{sourceId}
- **Implementation**: Dedicated Lambda function (get.js)

#### Register Data Source (Lambda Function)
- **Purpose**: Registers a new external data source
- **Endpoint**: POST /datasources/register
- **Implementation**: Dedicated Lambda function (register.js)
- **Key Features**:
  - Securely stores API keys in AWS Secrets Manager
  - Validates required fields and formats

#### Update Data Source (Lambda Function)
- **Purpose**: Updates an existing data source
- **Endpoint**: PUT /datasources/{sourceId}/update
- **Implementation**: Dedicated Lambda function (update.js)

#### Delete Data Source (Lambda Function)
- **Purpose**: Deletes a data source
- **Endpoint**: DELETE /datasources/{sourceId}/delete
- **Implementation**: Dedicated Lambda function (delete.js)

### 3. WebSocket Communication

#### WebSocket Handler (Lambda Function)
- **Purpose**: Manages WebSocket connections and subscriptions
- **Implementation**: Lambda function triggered by API Gateway WebSocket events
- **Key Features**:
  - Handles connection/disconnection events
  - Processes subscription requests
  - Sends real-time updates to clients

#### SQS Message Processor (Lambda Function)
- **Purpose**: Processes change notifications from SQS
- **Implementation**: Same Lambda function as WebSocket Handler, triggered by SQS events
- **Key Features**:
  - Automatically triggered by Event Source Mapping
  - Distributes updates to subscribed clients

### 4. Storage

#### Data Sources Table (DynamoDB)
- **Purpose**: Stores data source configurations
- **Key Fields**:
  - id (primary key)
  - name, description
  - type (googleSheet or external)
  - url, pollingInterval, headers
  - apiKeySecretId (reference to Secrets Manager)

#### Sheets Data Table (DynamoDB)
- **Purpose**: Stores actual data from sources
- **Key Fields**:
  - id (primary key)
  - sheetId (source identifier)
  - data (JSON string of the data)
  - lastUpdated (timestamp)

#### Connections Table (DynamoDB)
- **Purpose**: Manages WebSocket connections
- **Key Fields**:
  - connectionId (primary key)
  - sheetId (what source the connection is subscribed to)
  - connectedAt, ttl

#### API Keys (AWS Secrets Manager)
- **Purpose**: Securely stores API keys for external sources
- **Key Features**:
  - Encrypted at rest
  - Access controlled via IAM

### 5. Client Application

- **Purpose**: Provides user interface for viewing real-time data
- **Implementation**: HTML/JS application
- **Key Features**:
  - Establishes WebSocket connection
  - Subscribes to data sources
  - Displays real-time updates

## Data Flow

1. **Data Source Registration**:
   - Client calls Register Data Source Lambda
   - Lambda stores configuration in DynamoDB
   - API keys are stored in Secrets Manager

2. **Data Monitoring**:
   - ECS services continuously monitor data sources
   - When changes are detected, notifications are sent to SQS

3. **Client Connection**:
   - Client connects to WebSocket API
   - Connection ID is stored in DynamoDB

4. **Subscription**:
   - Client sends subscription request
   - WebSocket Lambda updates connection record with subscription info
   - Initial data is sent to client

5. **Real-time Updates**:
   - SQS triggers Lambda when changes are detected
   - Lambda queries for connections subscribed to the changed source
   - Updates are sent to all subscribed clients

## Security Considerations

- **API Keys**: Stored securely in AWS Secrets Manager
- **Authentication**: API Gateway can be configured with authorizers
- **Encryption**: Data encrypted at rest and in transit
- **Least Privilege**: IAM roles follow principle of least privilege

## Scalability

- **WebSocket Connections**: API Gateway scales to handle thousands of connections
- **Processing**: Lambda functions scale automatically with load
- **Monitoring**: ECS services can be scaled based on number of sources to monitor