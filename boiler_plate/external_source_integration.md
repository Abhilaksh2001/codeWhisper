# External Source Integration

This document describes the integration of external JSON/XML data sources into the real-time data monitoring system.

## Overview

The system has been extended to monitor not only Google Sheets but also external data sources that provide JSON or XML data. The architecture follows the same pattern as the Google Sheets monitoring, with a dedicated ECS service for monitoring external sources.

## Components Added

### 1. External Source Monitor Service

A new ECS service has been added to monitor external data sources:

- **Location**: `ecs/external-source-monitor/`
- **Purpose**: Poll external APIs for JSON or XML data and detect changes
- **Key Files**:
  - `index.js`: Main monitoring service code
  - `package.json`: Dependencies including axios and xml2js
  - `Dockerfile`: Container configuration

### 2. Infrastructure Updates

The CloudFormation template has been updated to include:

- New ECS task definition for external source monitoring
- New ECS service for running the external source monitor
- New CloudWatch log group for monitoring logs
- Additional parameters for external source configuration

### 3. Lambda Handler Updates

The WebSocket handler Lambda function has been updated to:

- Process messages from external sources
- Support subscription to external sources
- Send external source updates to clients

### 4. Client Application Updates

The client application has been updated to:

- Allow selection between Google Sheets and external sources
- Handle and display external source data (both JSON and XML)
- Support different message types for external sources

## Configuration

External sources are configured via the `ExternalSourcesConfig` parameter in CloudFormation, which accepts a JSON array of source configurations:

```json
[
  {
    "id": "weather-api",
    "url": "https://api.example.com/weather",
    "type": "json",
    "headers": {
      "Authorization": "Bearer TOKEN"
    }
  },
  {
    "id": "stock-data",
    "url": "https://api.example.com/stocks",
    "type": "xml",
    "headers": {
      "X-API-Key": "YOUR_API_KEY"
    }
  }
]
```

Each source configuration includes:
- `id`: Unique identifier for the source
- `url`: The URL to fetch data from
- `type`: Data format ("json" or "xml")
- `headers`: Optional HTTP headers for the request

## Data Flow

1. The External Source Monitor service polls configured external APIs at regular intervals
2. When changes are detected, the service:
   - Stores the new data in DynamoDB (using the same table as Google Sheets data)
   - Sends a notification to SQS with the source ID and changes
3. The Lambda function processes the SQS message and:
   - Identifies clients subscribed to the external source
   - Sends real-time updates to those clients via WebSockets
4. The client application receives and displays the external source data

## Client Usage

To subscribe to an external source:

1. Select "External Source" in the client application
2. Enter the source ID (must match the ID in the configuration)
3. Click "Subscribe"

The client will receive real-time updates when the external source data changes.

## Implementation Notes

- External source data is stored in the same DynamoDB table as Google Sheets data, with a `sourceType` attribute to distinguish them
- The monitoring service handles both JSON and XML formats, converting XML to JSON for consistent storage and processing
- The client application renders JSON data as formatted JSON or as a table if it's an array
- The system uses the same SQS queue and Lambda function for both Google Sheets and external source updates