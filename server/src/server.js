require('dotenv').config();

const app = require('./app');
const connectDatabase = require('./config/database');
const mongoose = require('mongoose');
const { isProductionJwtSecret } = require('./config/security');

const validateConfiguration = () => {
  const missing = [];
  if (!process.env.MONGODB_URI) missing.push('MONGODB_URI');
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGINS) {
    missing.push('CORS_ORIGINS');
  }
  if (missing.length > 0) {
    throw new Error(`Required configuration is missing: ${missing.join(', ')}`);
  }
  if (process.env.NODE_ENV === 'production' && !isProductionJwtSecret(process.env.JWT_SECRET)) {
    throw new Error('JWT_SECRET must be a non-placeholder value of at least 32 characters in production');
  }
};

const startServer = async () => {
  try {
    validateConfiguration();
    await connectDatabase();
    const port = Number.parseInt(process.env.PORT || '5000', 10);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      throw new Error('PORT must be a valid TCP port');
    }
    const server = app.listen(port, () => {
      console.log(`Server listening on port ${port}`);
    });
    const shutdown = (signal) => {
      server.close(() => {
        mongoose.connection.close(false).finally(() => process.exit(0));
      });
      setTimeout(() => process.exit(1), 10000).unref();
      console.log(`${signal} received. Shutting down safely.`);
    };
    process.once('SIGINT', () => shutdown('SIGINT'));
    process.once('SIGTERM', () => shutdown('SIGTERM'));
  } } catch (error) {
  console.error('Server startup failed.');
  console.error('Error type:', error.name);
  console.error(
    'Error details:',
    String(error.message).replace(/mongodb(\+srv)?:\/\/\S+/gi, '[REDACTED_MONGODB_URI]')
  );
  process.exitCode = 1;
}
};

startServer();
