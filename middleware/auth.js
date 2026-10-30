const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { httpError } = require('../utils/helpers');

const SECRET = () => process.env.JWT_SECRET || 'dev_secret_change_me';
const DAYS = 7;

exports.setAuthCookie = (res, user) => {
  const token = jwt.sign({ id: user._id, tv: user.tokenVersion || 0 }, SECRET(), { expiresIn: `${DAYS}d` });
  res.cookie('token', token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: DAYS * 864e5 });
};

// Reads the JWT cookie on every request; sets req.user (or null)
exports.attachUser = async (req, res, next) => {
  req.user = null;
  const token = req.cookies?.token;
  if (token) {
    try {
      const { id, tv = 0 } = jwt.verify(token, SECRET());
      const user = await User.findById(id).lean();
      if (user && !user.banned && !user.restricted && tv === (user.tokenVersion || 0)) req.user = user;
      else res.clearCookie('token');
    } catch { res.clearCookie('token'); }
  }
  next();
};

exports.requireAuth = (req, res, next) => req.user ? next() : next(httpError(401, 'Please log in to continue'));
exports.requireRole = (...roles) => (req, res, next) => req.user && roles.includes(req.user.role) ? next() : next(httpError(403, 'You do not have permission to do that'));
exports.isStaff = (u) => !!u && ['admin', 'moderator'].includes(u.role);
