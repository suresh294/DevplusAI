const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const authenticate = require('../src/middleware/auth');
const authController = require('../src/controllers/authController');
const User = require('../src/models/user');
const app = require('../src/app');

const response = () => {
  const result = {};
  result.status = (code) => {
    result.statusCode = code;
    return result;
  };
  result.json = (body) => {
    result.body = body;
    return result;
  };
  return result;
};

test('rejects requests without a bearer token', () => {
  const res = response();
  let called = false;

  authenticate({ get: () => undefined }, res, () => {
    called = true;
  });

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { success: false, error: 'Authentication required' });
  assert.equal(called, false);
});

test('rejects invalid tokens without exposing token details', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret';
  const res = response();

  authenticate({ get: () => 'Bearer invalid-token' }, res, () => {});

  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { success: false, error: 'Invalid or expired token' });
});

test('attaches the verified subject to the request', () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret';
  const token = jwt.sign({}, process.env.JWT_SECRET, { subject: 'user-id' });
  const req = { get: () => `Bearer ${token}` };
  const res = response();
  let nextCalled = false;

  authenticate(req, res, () => {
    nextCalled = true;
  });

  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;

  assert.equal(nextCalled, true);
  assert.deepEqual(req.user, { id: 'user-id' });
  assert.equal(res.statusCode, undefined);
});

test('rejects tokens when the server secret is missing', () => {
  const previousSecret = process.env.JWT_SECRET;
  delete process.env.JWT_SECRET;
  const res = response();

  authenticate({ get: () => 'Bearer token' }, res, () => {});

  if (previousSecret !== undefined) process.env.JWT_SECRET = previousSecret;

  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { success: false, error: 'Authentication required' });
});

test('rejects null and non-object auth request bodies', async () => {
  for (const body of [null, [], 'text', 42]) {
    const registerRes = response();
    await authController.register({ body }, registerRes);
    assert.equal(registerRes.statusCode, 400);
    assert.equal(registerRes.body.error, 'A valid request body is required');

    const loginRes = response();
    await authController.login({ body }, loginRes);
    assert.equal(loginRes.statusCode, 400);
    assert.equal(loginRes.body.error, 'A valid request body is required');
  }
});

test('preserves valid registration behavior with isolated user mocks', async () => {
  const previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'test-secret';
  const originalFindOne = User.findOne;
  const originalCreate = User.create;
  User.findOne = async () => null;
  User.create = async (data) => ({ _id: 'user-id', name: data.name, email: data.email });

  try {
    const res = response();
    await authController.register(
      { body: { name: 'Test User', email: 'test@example.com', password: 'password123' } },
      res
    );
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.success, true);
    assert.equal(res.body.data.user.email, 'test@example.com');
    assert.equal(typeof res.body.data.token, 'string');
  } finally {
    User.findOne = originalFindOne;
    User.create = originalCreate;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});

test('sanitizes malformed JSON and unexpected application errors', () => {
  const errorHandlers = app._router.stack
    .filter((layer) => typeof layer.handle === 'function' && layer.handle.length === 4)
    .map((layer) => layer.handle);
  const errorHandler = errorHandlers[errorHandlers.length - 1];

  const malformedRes = response();
  errorHandler({ type: 'entity.parse.failed' }, {}, malformedRes, () => {});
  assert.deepEqual(malformedRes.body, {
    success: false,
    error: 'Invalid JSON request body',
  });
  assert.equal(malformedRes.statusCode, 400);

  const unexpectedRes = response();
  errorHandler({ message: 'private database path' }, {}, unexpectedRes, () => {
    throw new Error('next should not be called');
  });
  assert.deepEqual(unexpectedRes.body, {
    success: false,
    error: 'Internal server error',
  });
  assert.equal(unexpectedRes.statusCode, 500);
  assert.equal(JSON.stringify(unexpectedRes.body).includes('private database path'), false);
});

test('allows the configured frontend origin through CORS middleware', () => {
  const corsMiddleware = app._router.stack.find(
    (layer) =>
      typeof layer.handle === 'function' &&
      layer.handle.length === 3 &&
      layer.handle.toString().includes('allowedOrigins')
  ).handle;
  const headers = {};
  let continued = false;

  corsMiddleware(
    { headers: { origin: 'http://localhost:5173' }, method: 'POST' },
    {
      setHeader(name, value) {
        headers[name] = value;
      },
    },
    () => {
      continued = true;
    }
  );

  assert.equal(continued, true);
  assert.equal(headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
  assert.equal(headers['Access-Control-Allow-Headers'], 'Content-Type,Authorization');
});
