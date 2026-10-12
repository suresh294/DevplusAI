const jwt = require('jsonwebtoken');
const { isProductionJwtSecret } = require('../config/security');

const authenticate = (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');

  if (
    scheme !== 'Bearer' ||
    !token ||
    !process.env.JWT_SECRET ||
    (process.env.NODE_ENV === 'production' && !isProductionJwtSecret(process.env.JWT_SECRET))
  ) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub };
    return next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
};

module.exports = authenticate;
