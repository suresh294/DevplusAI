const express = require('express');
const authRoutes = require('./routes/authRoutes');
const authenticate = require('./middleware/auth');
const projectRoutes = require('./routes/projectRoutes');
const signalRoutes = require('./routes/signalRoutes');

const app = express();

const allowedOrigin = 'http://localhost:5173';
const allowedMethods = 'GET,POST,PATCH,DELETE,OPTIONS';
const allowedHeaders = 'Content-Type,Authorization';

app.use((req, res, next) => {
  if (req.headers.origin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', allowedMethods);
    res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
    res.setHeader('Vary', 'Origin');
  }

  if (req.method === 'OPTIONS') {
    return req.headers.origin === allowedOrigin ? res.sendStatus(204) : res.sendStatus(403);
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
