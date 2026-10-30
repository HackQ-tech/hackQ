const handler = (err, req, res, next) => {
  let status = err.status || 500, msg = err.message || 'Server error';
  if (err.code === 'LIMIT_FILE_SIZE') { status = 413; msg = 'Each image must be 6 MB or smaller'; }
  else if (err.name === 'MulterError') { status = 400; msg = err.code === 'LIMIT_UNEXPECTED_FILE' || err.code === 'LIMIT_FILE_COUNT' ? 'Too many images (max 4)' : err.message; }
  else if (err.code === 11000) { status = 409; msg = 'That value is already taken'; }
  else if (err.name === 'ValidationError') { status = 400; msg = Object.values(err.errors).map(e => e.message).join(', '); }
  else if (err.name === 'CastError') { status = 404; msg = 'Not found'; }
  if (status >= 500) console.error(err);
  if (req.originalUrl.startsWith('/api')) return res.status(status).json({ error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Server error' : msg });
  res.status(status).send(msg);
};
module.exports = handler;
module.exports.wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
