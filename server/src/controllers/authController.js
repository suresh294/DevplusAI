const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/user');

const isRequestBodyObject = (body) =>
  body !== null && typeof body === 'object' && !Array.isArray(body);

const issueToken = (userId) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }

  return jwt.sign({}, process.env.JWT_SECRET, {
    subject: userId.toString(),
    expiresIn: '1d',
  });
};

const register = async (req, res) => {
  if (!isRequestBodyObject(req.body)) {
    return res.status(400).json({
      success: false,
      error: 'A valid request body is required',
    });
  }

  const { name, email, password } = req.body;

  if (
    typeof name !== 'string' ||
    !name.trim() ||
    typeof email !== 'string' ||
    !email.trim() ||
    typeof password !== 'string' ||
    password.length < 8
  ) {
    return res.status(400).json({
      success: false,
      error: 'Name, email, and a password of at least 8 characters are required',
    });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: 'An account with that email already exists',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      passwordHash,
    });

    return res.status(201).json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email },
        token: issueToken(user._id),
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        error: 'An account with that email already exists',
      });
    }

    if (error.message === 'JWT_SECRET is not configured') {
      return res.status(500).json({
        success: false,
        error: 'Authentication is not configured',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Registration failed',
    });
  }
};

const login = async (req, res) => {
  if (!isRequestBodyObject(req.body)) {
    return res.status(400).json({
      success: false,
      error: 'A valid request body is required',
    });
  }

  const { email, password } = req.body;

  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'Email and password are required',
    });
  }

  try {
    const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        user: { id: user._id, name: user.name, email: user.email },
        token: issueToken(user._id),
      },
    });
  } catch (error) {
    if (error.message === 'JWT_SECRET is not configured') {
      return res.status(500).json({
        success: false,
        error: 'Authentication is not configured',
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Login failed',
    });
  }
};

module.exports = { register, login };
