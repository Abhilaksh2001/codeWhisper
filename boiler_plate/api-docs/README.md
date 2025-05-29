# API Documentation

This directory contains API documentation for the Real-Time Google Sheets Integration System.

## Contents

- `openapi.yaml` - OpenAPI specification for the WebSocket API
- `api-stubs-openapi.yaml` - OpenAPI specification for the API stubs
- `index.html` - HTML page to view the API documentation using Swagger UI

## Viewing the Documentation

### Option 1: Using the HTML Page

1. Open `index.html` in a web browser
2. Use the dropdown to switch between different API specifications

### Option 2: Using Swagger UI Online

1. Go to [Swagger Editor](https://editor.swagger.io/)
2. Import the YAML file you want to view
3. The documentation will be rendered in the right panel

### Option 3: Using Swagger UI Docker

```bash
docker run -p 8080:8080 -e SWAGGER_JSON=/foo/openapi.yaml -v $(pwd):/foo swaggerapi/swagger-ui
```

Then open your browser to http://localhost:8080

## API Overview

### WebSocket API

The WebSocket API provides real-time communication between the backend service and client applications. It supports:

- Establishing WebSocket connections
- Subscribing to Google Sheets and external data sources
- Receiving real-time updates when data changes

### API Stubs

The API stubs provide mock endpoints for testing and development. They include:

- JSON data sources (stocks, weather, news)
- XML data sources (products, customers)
- Admin endpoints to simulate data changes

## Message Types

### WebSocket API Messages

1. **INITIAL_DATA** - Initial data sent when subscribing to a Google Sheet
2. **UPDATE** - Updates sent when a Google Sheet changes
3. **EXTERNAL_INITIAL_DATA** - Initial data sent when subscribing to an external source
4. **EXTERNAL_UPDATE** - Updates sent when an external source changes

## Authentication

The API documentation includes placeholders for authentication, but the actual implementation would depend on your specific requirements. Common options include:

- API keys
- JWT tokens
- AWS Cognito
- Custom authorizers

## Further Reading

For more information on the APIs and their usage, refer to the main project documentation.