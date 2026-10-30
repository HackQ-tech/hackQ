const crypto = require('crypto');
const Token = require('../models/Token');
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex');
exports.CODE_MINUTES = 30; exports.MAX_ATTEMPTS = 5;

exports.createCode = async (userId) => {
  await Token.deleteMany({ user: userId, type: 'verify' });
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0');
  await Token.create({ user: userId, type: 'verify', hash: sha(`${userId}:${code}`), expiresAt: new Date(Date.now() + exports.CODE_MINUTES * 60e3) });
  return code;
};
exports.checkCode = async (userId, code) => {
  const t = await Token.findOne({ user: userId, type: 'verify' });
  if (!t || t.expiresAt < new Date()) return { status: 'expired' };
  if (t.attempts >= exports.MAX_ATTEMPTS) return { status: 'locked' };
  const ok = /^\d{6}$/.test(String(code)) && crypto.timingSafeEqual(Buffer.from(sha(`${userId}:${code}`)), Buffer.from(t.hash));
  if (!ok) { t.attempts++; await t.save(); return { status: 'invalid', left: exports.MAX_ATTEMPTS - t.attempts }; }
  await t.deleteOne();
  return { status: 'ok' };
};
// Random link tokens. 'secure' links may coexist (every password change gets its own); the rest replace older ones.
exports.createLink = async (userId, type, minutes) => {
  if (type !== 'secure') await Token.deleteMany({ user: userId, type });
  const raw = crypto.randomBytes(32).toString('hex');
  await Token.create({ user: userId, type, hash: sha(raw), expiresAt: new Date(Date.now() + minutes * 60e3) });
  return raw;
};
exports.findLink = (raw, type) => (typeof raw === 'string' && raw.length <= 128) ? Token.findOne({ type, hash: sha(raw), expiresAt: { $gt: new Date() } }) : null;
exports.clear = (userId, types) => Token.deleteMany({ user: userId, type: { $in: types } });
exports.secondsSince = async (userId, type) => { const t = await Token.findOne({ user: userId, type }).sort({ createdAt: -1 }).lean(); return t ? (Date.now() - t.createdAt) / 1000 : Infinity; };
exports.ttl = async (userId, type) => { const t = await Token.findOne({ user: userId, type }).sort({ createdAt: -1 }).lean(); return t ? Math.max(0, Math.round((t.expiresAt - Date.now()) / 1000)) : 0; };
