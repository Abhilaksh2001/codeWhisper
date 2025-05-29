const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Store mock data
let stockData = {
  stocks: [
    { symbol: 'AAPL', price: 150.25, change: 2.5 },
    { symbol: 'MSFT', price: 290.10, change: -1.2 },
    { symbol: 'GOOGL', price: 2750.80, change: 5.3 },
    { symbol: 'AMZN', price: 3400.50, change: -2.1 }
  ],
  lastUpdated: new Date().toISOString()
};

let weatherData = {
  location: 'New York',
  temperature: 72,
  conditions: 'Partly Cloudy',
  forecast: [
    { day: 'Monday', high: 75, low: 65, conditions: 'Sunny' },
    { day: 'Tuesday', high: 70, low: 60, conditions: 'Cloudy' },
    { day: 'Wednesday', high: 80, low: 68, conditions: 'Partly Cloudy' }
  ],
  lastUpdated: new Date().toISOString()
};

let newsData = [
  { id: 1, title: 'Breaking News', content: 'This is a breaking news story', timestamp: new Date().toISOString() },
  { id: 2, title: 'Technology Update', content: 'New technology breakthrough announced', timestamp: new Date().toISOString() },
  { id: 3, title: 'Sports Results', content: 'Latest sports scores and highlights', timestamp: new Date().toISOString() }
];

// Routes

// Stock API (JSON)
app.get('/api/stocks', (req, res) => {
  res.json(stockData);
});

// Weather API (JSON)
app.get('/api/weather', (req, res) => {
  res.json(weatherData);
});

// News API (JSON)
app.get('/api/news', (req, res) => {
  res.json(newsData);
});

// Product Catalog API (XML)
app.get('/api/products', (req, res) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<products>
  <product>
    <id>1</id>
    <name>Laptop</name>
    <price>999.99</price>
    <category>Electronics</category>
  </product>
  <product>
    <id>2</id>
    <name>Smartphone</name>
    <price>699.99</price>
    <category>Electronics</category>
  </product>
  <product>
    <id>3</id>
    <name>Headphones</name>
    <price>149.99</price>
    <category>Accessories</category>
  </product>
</products>`;
  
  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

// Customer Data API (XML)
app.get('/api/customers', (req, res) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<customers>
  <customer>
    <id>1001</id>
    <name>John Smith</name>
    <email>john@example.com</email>
    <status>active</status>
  </customer>
  <customer>
    <id>1002</id>
    <name>Jane Doe</name>
    <email>jane@example.com</email>
    <status>inactive</status>
  </customer>
  <customer>
    <id>1003</id>
    <name>Bob Johnson</name>
    <email>bob@example.com</email>
    <status>active</status>
  </customer>
</customers>`;
  
  res.set('Content-Type', 'application/xml');
  res.send(xml);
});

// Update endpoints to simulate changes

// Update stock prices
app.post('/admin/update-stocks', (req, res) => {
  stockData.stocks.forEach(stock => {
    // Random price change between -5 and +5
    const change = Math.round((Math.random() * 10 - 5) * 100) / 100;
    stock.price = Math.max(0, stock.price + change);
    stock.change = change;
  });
  stockData.lastUpdated = new Date().toISOString();
  res.json({ message: 'Stock data updated', data: stockData });
});

// Update weather
app.post('/admin/update-weather', (req, res) => {
  // Random temperature between 60 and 90
  weatherData.temperature = Math.floor(Math.random() * 30) + 60;
  
  const conditions = ['Sunny', 'Cloudy', 'Partly Cloudy', 'Rainy', 'Stormy'];
  weatherData.conditions = conditions[Math.floor(Math.random() * conditions.length)];
  
  weatherData.lastUpdated = new Date().toISOString();
  res.json({ message: 'Weather data updated', data: weatherData });
});

// Add news item
app.post('/admin/add-news', (req, res) => {
  const newId = newsData.length > 0 ? Math.max(...newsData.map(item => item.id)) + 1 : 1;
  const newItem = {
    id: newId,
    title: req.body.title || `News Item ${newId}`,
    content: req.body.content || `This is news item ${newId}`,
    timestamp: new Date().toISOString()
  };
  
  newsData.unshift(newItem); // Add to beginning of array
  
  // Keep only the latest 10 news items
  if (newsData.length > 10) {
    newsData = newsData.slice(0, 10);
  }
  
  res.json({ message: 'News item added', data: newItem });
});

// Start server
app.listen(PORT, () => {
  console.log(`API stub server running on port ${PORT}`);
  console.log('Available endpoints:');
  console.log('  GET  /api/stocks    - Stock data (JSON)');
  console.log('  GET  /api/weather   - Weather data (JSON)');
  console.log('  GET  /api/news      - News data (JSON)');
  console.log('  GET  /api/products  - Product catalog (XML)');
  console.log('  GET  /api/customers - Customer data (XML)');
  console.log('Admin endpoints to simulate changes:');
  console.log('  POST /admin/update-stocks  - Update stock prices');
  console.log('  POST /admin/update-weather - Update weather data');
  console.log('  POST /admin/add-news      - Add a news item');
});