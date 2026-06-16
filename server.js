const express = require('express');
const app = express();

app.use(express.json());

// CORS
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Load route handlers
const analyze = require('./api/analyze');
const scan    = require('./api/scan');
const verify  = require('./api/verify');
const checkout = require('./api/checkout');
const webhook  = require('./api/webhook');

// Routes
app.post('/api/analyze',  analyze);
app.post('/api/scan',     scan);
app.post('/api/verify',   verify);
app.get('/api/checkout',  checkout);
app.post('/api/webhook',  webhook);

app.get('/', (req, res) => res.send('Rankwise backend running'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
