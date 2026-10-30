const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { setAuthCookie } = require('../middleware/auth');
const { httpError, ageOf } = require('../utils/helpers');
const { selfUser } = require('../utils/serialize');
const tokens = require('../utils/tokens');
const mail = require('../utils/accountMail');

const PRESETS = ['default', 'neon', 'cyber', 'ghost', 'robot', 'skull', 'alien'];
const isAdminEmail = e => process.env.ADMIN_EMAIL && e === process.env.ADMIN_EMAIL.toLowerCase();
const COOLDOWN = 60;   // seconds between emails of the same kind

async function emailCode(user) {
  try { await mail.sendCode(user); } catch (e) { console.error('verification mail failed:', e.message); throw httpError(502, "We couldn't send the email right now. Please try again in a moment."); }
  return tokens.ttl(user._id, 'verify');
}
const checkPassword = pw => { if (!pw || pw.length < 8) throw httpError(400, 'Password must be at least 8 characters'); if (pw.length > 128) throw httpError(400, 'Password is too long'); };

exports.register = async (req, res) => {
  const { username, password, birthdate, avatar = 'default' } = req.body, email = String(req.body.email || '').toLowerCase().trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username || '')) throw httpError(400, 'Username: 3-20 letters, numbers or underscores');
  if (!/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'Enter a valid email');
  checkPassword(password);
  const age = ageOf(birthdate);
  if (age === null) throw httpError(400, 'Birthdate is required');
  if (age < 13 || age > 120) throw httpError(400, 'You must be at least 13 years old to join HackQ');
  if (!PRESETS.includes(avatar)) throw httpError(400, 'Invalid avatar');

  await User.deleteMany({ emailVerified: false, provider: 'local', createdAt: { $lt: new Date(Date.now() - 864e5) } });   // abandoned sign-ups
  let user = await User.findOne({ email });
  if (user && user.emailVerified) throw httpError(409, 'An account with that email already exists');
  if (await User.exists({ usernameLower: username.toLowerCase(), _id: { $ne: user?._id } })) throw httpError(409, 'That username is taken');

  const fields = { username, email, birthdate, password: await bcrypt.hash(password, 12), avatar: `/img/avatars/${avatar}.svg`, avatarSource: 'preset', emailVerified: false,
    ...(isAdminEmail(email) ? { role: 'admin', verified: true, badge: 'blue' } : {}) };
  if (user) { Object.assign(user, fields); await user.save(); } else user = await User.create(fields);   // re-registering with an unverified email just refreshes it
  res.status(201).json({ ok: true, needsVerify: true, email, expiresIn: await emailCode(user) });
};

exports.verify = async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || '').toLowerCase().trim() });
  if (!user) throw httpError(400, 'Wrong code');
  if (user.emailVerified) throw httpError(400, 'This email is already verified. Please log in.');
  const r = await tokens.checkCode(user._id, String(req.body.code || '').trim());
  if (r.status === 'expired') throw httpError(400, 'This code has expired. Request a new one.');
  if (r.status === 'locked') throw httpError(429, 'Too many wrong attempts. Request a new code.');
  if (r.status === 'invalid') throw httpError(400, `Wrong code. ${r.left} ${r.left === 1 ? 'try' : 'tries'} left.`);
  user.emailVerified = true; await user.save();
  setAuthCookie(res, user);
  mail.sendWelcome(user);
  res.json({ ok: true });
};

exports.resend = async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || '').toLowerCase().trim(), emailVerified: false });
  if (!user) return res.json({ ok: true, expiresIn: 0 });   // same answer either way: no account enumeration
  const wait = Math.ceil(COOLDOWN - await tokens.secondsSince(user._id, 'verify'));
  if (wait > 0) throw httpError(429, `Please wait ${wait}s before requesting another code`);
  res.json({ ok: true, expiresIn: await emailCode(user) });
};

exports.login = async (req, res) => {
  const { identifier = '', password = '' } = req.body, id = String(identifier).toLowerCase().trim();
  const user = await User.findOne({ $or: [{ email: id }, { usernameLower: id }] }).select('+password');
  if (!user || !user.password || !(await bcrypt.compare(password, user.password))) throw httpError(401, 'Wrong username/email or password');
  if (user.banned) throw httpError(403, `This account is banned${user.banReason ? ': ' + user.banReason : ''}`);
  if (user.restricted) throw httpError(403, 'This account was locked for your security. Use "Forgot password" to recover it.');
  if (!user.emailVerified) {
    let expiresIn = await tokens.ttl(user._id, 'verify');
    if (!expiresIn || await tokens.secondsSince(user._id, 'verify') > COOLDOWN) expiresIn = await emailCode(user);
    return res.status(403).json({ error: 'Please verify your email to continue', needsVerify: true, email: user.email, expiresIn });
  }
  setAuthCookie(res, user);
  res.json({ ok: true });
};

exports.logout = (req, res) => { res.clearCookie('token'); res.json({ ok: true }); };

exports.forgot = async (req, res) => {
  const user = await User.findOne({ email: String(req.body.email || '').toLowerCase().trim() });
  if (user && !user.banned && await tokens.secondsSince(user._id, 'reset') > COOLDOWN) {
    try { await mail.sendReset(user); } catch (e) { console.error('reset mail failed:', e.message); }
  }
  res.json({ ok: true });   // identical response whether or not the account exists
};

exports.reset = async (req, res) => {
  checkPassword(req.body.password);
  const t = await tokens.findLink(req.body.token, 'reset');
  if (!t) throw httpError(400, 'This reset link is invalid or has expired. Request a new one.');
  const user = await User.findById(t.user);
  if (!user || user.banned) throw httpError(400, 'This reset link is invalid or has expired.');
  Object.assign(user, { password: await bcrypt.hash(req.body.password, 12), restricted: false, emailVerified: true, passwordChangedAt: new Date(), tokenVersion: (user.tokenVersion || 0) + 1 });
  await user.save();
  await tokens.clear(user._id, ['reset', 'verify']);
  setAuthCookie(res, user);
  mail.notifyPasswordChange(user, req, 'reset');
  res.json({ ok: true });
};

// "This wasn't me" link from the password-changed email: sign out everywhere, lock the account, hand back a reset token
exports.secure = async (req, res) => {
  const t = await tokens.findLink(req.body.token, 'secure');
  if (!t) throw httpError(400, 'This security link is invalid or has expired.');
  const user = await User.findById(t.user);
  if (!user) throw httpError(400, 'This security link is invalid or has expired.');
  user.restricted = true; user.tokenVersion = (user.tokenVersion || 0) + 1; await user.save();
  await tokens.clear(user._id, ['secure', 'reset']);
  res.clearCookie('token');
  res.json({ ok: true, resetToken: await tokens.createLink(user._id, 'reset', 30) });
};

exports.me = async (req, res) => {
  if (!req.user) return res.json({ user: null, unread: 0 });
  const withPw = await User.findById(req.user._id).select('+password').lean();
  const unread = await Notification.countDocuments({ user: req.user._id, read: false });
  res.json({ user: selfUser({ ...req.user, hasPassword: !!withPw.password }), unread });
};

exports.oauthDone = (req, res) => {
  if (req.user.restricted) return res.redirect('/login?error=locked');
  setAuthCookie(res, req.user);
  res.redirect(req.user.birthdate ? '/' : '/settings?complete=1');
};
