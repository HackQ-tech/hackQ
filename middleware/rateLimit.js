const rateLimit = require('express-rate-limit');
const mk = (windowMin, max, message) => rateLimit({ windowMs: windowMin * 60 * 1000, max, standardHeaders: true, legacyHeaders: false, message: { error: message } });
exports.apiLimiter = mk(15, 600, 'Too many requests, slow down.');
exports.authLimiter = mk(15, 25, 'Too many login attempts, try again later.');
exports.writeLimiter = mk(10, 60, 'You are doing that too fast.');
