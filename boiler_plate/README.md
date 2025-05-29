# Real-Time Google Sheets Integration System

This project implements a real-time system that monitors Google Sheets for changes and propagates them to client applications via WebSockets.

## Architecture Overview

The system uses a hybrid architecture with:

- **Amazon ECS with Fargate** - For long-running Google Sheets monitoring service
- **AWS Lambda** - For event-driven processing of WebSocket connections and client requests
- **Amazon API Gateway** (WebSockets) - For real-time client communication
- **Amazon DynamoDB** - For data storage
- **Amazon SQS** - For message queuing and decoupling
- **Amazon ElastiCache** - For connection management

## Directory Structure

```
boiler_plate/
├── infrastructure/
│   └── cloudformation.yaml       # CloudFormation template for AWS resources
├── ecs/
│   ├── Dockerfile                # Docker configuration for the monitoring service
│   ├── index.js                  # Main code for the Google Sheets monitoring service
│   ├── package.json              # Node.js dependencies for the monitoring service
│   └── external-source-monitor/  # External source monitoring service
│       ├── index.js              # Main code for external source monitoring
│       ├── Dockerfile            # Docker configuration for external source monitor
│       └── package.json          # Node.js dependencies
├── lambda/
│   ├── websocket-handler/        # Lambda function for WebSocket handling
│   │   ├── index.js              # Main Lambda handler code
│   │   ├── package.json          # Node.js dependencies
│   │   └── tests/                # Test files for WebSocket handler
│   └── datasource-handler/       # Lambda functions for data source management
│       ├── list.js               # Lists all data sources
│       ├── get.js                # Gets a specific data source
│       ├── register.js           # Registers a new data source
│       ├── update.js             # Updates an existing data source
│       ├── delete.js             # Deletes a data source
│       └── package.json          # Node.js dependencies
├── client/
│   └── index.html                # Simple HTML/JS client for testing
├── api-docs/                     # API documentation
│   ├── openapi.yaml              # OpenAPI specification for WebSocket API
│   ├── api-stubs-openapi.yaml    # OpenAPI specification for API stubs
│   ├── index.html                # HTML viewer for API documentation
│   └── architecture.md           # Architecture documentation
└── README.md                     # This file
```

## Components

### 1. Google Sheets Monitoring Service (ECS)

A long-running service that:
- Polls Google Sheets API for changes
- Compares with previous state stored in DynamoDB
- Sends change notifications to SQS when changes are detected

### 2. WebSocket Handler (Lambda)

Event-driven functions that:
- Handle WebSocket connections and disconnections
- Process client subscription requests
- Send real-time updates to connected clients
- Process SQS messages with sheet changes (automatically triggered via Event Source Mapping)

### 3. Data Storage (DynamoDB)

Two main tables:
- `sheets-data-{env}`: Stores the data from Google Sheets
- `websocket-connections-{env}`: Manages WebSocket connections and subscriptions

### 4. Message Queue (SQS)

- `sheet-changes-{env}`: Queue for change notifications
- Includes a dead-letter queue for failed messages

### 5. Client Application

A simple HTML/JS application that:
- Connects to the WebSocket API
- Subscribes to specific Google Sheets
- Displays real-time updates

## Deployment Instructions

### Prerequisites

1. AWS CLI configured with appropriate permissions
2. Docker installed (for building the ECS container)
3. Node.js and npm installed
4. Google Cloud project with Sheets API enabled
5. Google API credentials configured

### Deployment Steps

1. **Create AWS Resources**

   ```bash
   aws cloudformation deploy \
     --template-file infrastructure/cloudformation.yaml \
     --stack-name google-sheets-realtime \
     --parameter-overrides \
       Environment=dev \
       SubnetId=subnet-xxxxxxxx \
       ECRRepositoryURI=xxxxxxxxxxxx.dkr.ecr.region.amazonaws.com/sheets-monitor
   ```

2. **Build and Push ECS Container**

   ```bash
   # Navigate to ECS directory
   cd ecs

   # Build Docker image
   docker build -t sheets-monitor .

   # Tag and push to ECR
   aws ecr get-login-password --region region | docker login --username AWS --password-stdin xxxxxxxxxxxx.dkr.ecr.region.amazonaws.com
   docker tag sheets-monitor:latest xxxxxxxxxxxx.dkr.ecr.region.amazonaws.com/sheets-monitor:latest
   docker push xxxxxxxxxxxx.dkr.ecr.region.amazonaws.com/sheets-monitor:latest
   ```

3. **Deploy Lambda Function**

   ```bash
   # Navigate to Lambda directory
   cd lambda/websocket-handler

   # Install dependencies
   npm install

   # Package and deploy
   zip -r function.zip .
   aws lambda update-function-code \
     --function-name websocket-handler-dev \
     --zip-file fileb://function.zip
   ```

4. **Configure Client**

   Update the WebSocket API endpoint in `client/index.html`:

   ```javascript
   const API_ENDPOINT = 'wss://xxxxxxxxxx.execute-api.region.amazonaws.com/dev';
   ```

## Usage

1. Open the client application in a web browser
2. Enter a Google Sheet ID to subscribe to
3. The client will display real-time updates when the sheet changes

## Scaling Considerations

- The architecture supports up to 100,000 concurrent WebSocket connections
- For high-scale scenarios, implement message batching and compression
- Consider using API Gateway in multiple regions for global distribution

## Security Considerations

- Implement proper authentication for WebSocket connections
- Use IAM roles with least privilege
- Encrypt sensitive data in transit and at rest
- Implement rate limiting to prevent abuse

## Monitoring and Maintenance

- Use CloudWatch for monitoring and alerting
- Set up alarms for error rates and latency
- Implement structured logging for troubleshooting
- Regularly review and optimize resource usage