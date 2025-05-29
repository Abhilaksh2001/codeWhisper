# API Stubs for Testing and Development

This package provides mock API endpoints that simulate external data sources for testing and development purposes.

## Setup

```bash
# Install dependencies
npm install

# Start the server
npm start
```

The server will run on port 3000 by default. You can change this by setting the `PORT` environment variable.

## Available Endpoints

### JSON APIs

1. **Stock Data API**
   - Endpoint: `GET /api/stocks`
   - Returns: Current stock prices and changes in JSON format

2. **Weather API**
   - Endpoint: `GET /api/weather`
   - Returns: Current weather conditions and forecast in JSON format

3. **News API**
   - Endpoint: `GET /api/news`
   - Returns: Latest news items in JSON format

### XML APIs

4. **Product Catalog API**
   - Endpoint: `GET /api/products`
   - Returns: Product information in XML format

5. **Customer Data API**
   - Endpoint: `GET /api/customers`
   - Returns: Customer information in XML format

## Admin Endpoints

These endpoints allow you to simulate changes in the data:

1. **Update Stock Prices**
   - Endpoint: `POST /admin/update-stocks`
   - Action: Randomly updates stock prices

2. **Update Weather Data**
   - Endpoint: `POST /admin/update-weather`
   - Action: Randomly updates temperature and conditions

3. **Add News Item**
   - Endpoint: `POST /admin/add-news`
   - Body: `{ "title": "News Title", "content": "News Content" }`
   - Action: Adds a new news item to the beginning of the list

## Integration with External Source Monitor

To use these API stubs with the External Source Monitor service, configure the external sources as follows:

```json
[
  {
    "id": "stocks",
    "url": "http://localhost:3000/api/stocks",
    "type": "json"
  },
  {
    "id": "weather",
    "url": "http://localhost:3000/api/weather",
    "type": "json"
  },
  {
    "id": "news",
    "url": "http://localhost:3000/api/news",
    "type": "json"
  },
  {
    "id": "products",
    "url": "http://localhost:3000/api/products",
    "type": "xml"
  },
  {
    "id": "customers",
    "url": "http://localhost:3000/api/customers",
    "type": "xml"
  }
]
```

## Testing Data Changes

To test the real-time update functionality:

1. Start the API stub server
2. Configure the External Source Monitor to use these endpoints
3. Use the admin endpoints to simulate data changes
4. Observe the changes being detected and propagated to clients