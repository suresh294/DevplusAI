const express = require('express');
const authRoutes = require('./routes/authRoutes');
const authenticate = require('./middleware/auth');
const projectRoutes = require('./routes/projectRoutes');
const signalRoutes = require('./routes/signalRoutes');

const app = express();


const allowedOrigins = (
  process.env.CORS_ORIGINS ||
  'http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedMethods = 'GET,POST,PATCH,DELETE,OPTIONS';
const allowedHeaders = 'Content-Type,Authorization';

app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', allowedMethods);
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    if (!origin || allowedOrigins.includes(origin)) {
      return res.sendStatus(204);
    }

    return res.sendStatus(403);
  }

  return next();
});

app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/projects', authenticate, projectRoutes);
app.use('/api/signals', authenticate, signalRoutes);

app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'DevPulse AI API is healthy',
  });
});

app.use((error, req, res, next) => {
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      success: false,
      error: 'Invalid JSON request body',
    });
  }

  return res.status(500).json({
    success: false,
    error: 'Internal server error',
  });
});

module.exports = app;
