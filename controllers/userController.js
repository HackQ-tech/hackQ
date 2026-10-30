const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Post = require('../models/Post');
const Notification = require('../models/Notification');
const { uploadBuffer, destroy } = require('../config/cloudinary');
const { TAGS, JOBS } = require('../utils/tags');
const { getRank, RANKS } = require('../utils/ranks');
const { AUTHOR_FIELDS, brief, decoratePosts } = require('../utils/serialize');
const { httpError, isHttpUrl, ageOf } = require('../utils/helpers');
const { notify } = require('../utils/notify');
const { setAuthCookie } = require('../middleware/auth');
const { notifyPasswordChange } = require('../utils/accountMail');

const PRESETS = ['default', 'neon', 'cyber', 'ghost', 'robot', 'skull', 'alien'];
const findByName = (name) => User.findOne({ usernameLower: String(name).toLowerCase() }).lean();

exports.profile = async (req, res) => {
  const u = await findByName(req.params.username);
  if (!u || u.banned) throw httpError(404, 'User not found');
  const me = req.user, owner = !!me && String(me._id) === String(u._id);
  const out = {
    ...brief(u), rankInfo: getRank(u.points), createdAt: u.createdAt, stats: u.stats, isOwner: owner,
    followers: u.followers.length, following: u.following.length,
    isFollowing: !!me && u.followers.some(f => String(f) === String(me._id))
  };
  ['bio', 'portfolio', 'github', 'interests', 'job', 'birthdate'].forEach(f => { if (owner || u.privacy?.[f]) out[f] = u[f]; });
  res.json({ user: out });
};

exports.posts = async (req, res) => {
  const u = await findByName(req.params.username);
  if (!u) throw httpError(404, 'User not found');
  const owner = req.user && String(req.user._id) === String(u._id);
  const docs = await Post.find({ author: u._id, ...(owner ? {} : { status: 'approved' }) }).sort({ createdAt: -1 }).limit(50).populate('author', AUTHOR_FIELDS).lean();
  res.json({ posts: await decoratePosts(docs, req.user) });
};

exports.follow = async (req, res) => {
  const target = await findByName(req.params.username);
  if (!target) throw httpError(404, 'User not found');
  if (String(target._id) === String(req.user._id)) throw httpError(400, 'You cannot follow yourself');
  const already = target.followers.some(f => String(f) === String(req.user._id));
  await User.updateOne({ _id: target._id }, already ? { $pull: { followers: req.user._id } } : { $addToSet: { followers: req.user._id } });
  await User.updateOne({ _id: req.user._id }, already ? { $pull: { following: target._id } } : { $addToSet: { following: target._id } });
  if (!already) notify({ user: target._id, actor: req.user._id, type: 'follow', text: `${req.user.username} started following you`, link: `/u/${req.user.username}` });
  res.json({ isFollowing: !already, followers: target.followers.length + (already ? -1 : 1) });
};

exports.connections = async (req, res) => {
  const u = await User.findOne({ usernameLower: req.params.username.toLowerCase() }).populate({ path: req.params.kind, select: AUTHOR_FIELDS, options: { limit: 100 } }).lean();
  if (!u) throw httpError(404, 'User not found');
  res.json({ users: u[req.params.kind].map(brief) });
};

exports.updateMe = async (req, res) => {
  const b = req.body, set = {};
  if (b.bio !== undefined) { if (String(b.bio).length > 300) throw httpError(400, 'Bio max 300 characters'); set.bio = String(b.bio).trim(); }
  if (b.portfolio !== undefined) { const v = String(b.portfolio).trim(); if (v && !isHttpUrl(v)) throw httpError(400, 'Portfolio must be a full http(s) URL'); set.portfolio = v; }
  if (b.github !== undefined) {
    const v = String(b.github).trim().replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\/$/, '');
    if (v && !/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(v)) throw httpError(400, 'Invalid GitHub username');
    set.github = v;
  }
  if (b.job !== undefined) { if (b.job && !Object.keys(JOBS).includes(b.job)) throw httpError(400, 'Invalid job'); set.job = b.job; }
  if (b.interests !== undefined) set.interests = [...new Set([].concat(b.interests).filter(t => TAGS.includes(t)))].slice(0, 10);
  if (b.birthdate) { const a = ageOf(b.birthdate); if (a === null || a < 13 || a > 120) throw httpError(400, 'You must be at least 13 years old'); set.birthdate = b.birthdate; }
  if (b.notify && typeof b.notify === 'object') ['posts', 'mentions'].forEach(k => { if (typeof b.notify[k] === 'boolean') set[`notify.${k}`] = b.notify[k]; });
  if (b.privacy && typeof b.privacy === 'object') ['bio', 'portfolio', 'github', 'interests', 'job', 'birthdate'].forEach(k => { if (typeof b.privacy[k] === 'boolean') set[`privacy.${k}`] = b.privacy[k]; });
  if (b.avatarPreset) {
    if (!PRESETS.includes(b.avatarPreset)) throw httpError(400, 'Invalid avatar');
    set.avatar = `/img/avatars/${b.avatarPreset}.svg`; set.avatarSource = 'preset';
    if (req.user.avatarPublicId) { destroy(req.user.avatarPublicId); set.avatarPublicId = null; }
  }
  await User.updateOne({ _id: req.user._id }, { $set: set });
  res.json({ ok: true });
};

exports.uploadAvatar = async (req, res) => {
  if (!req.file) throw httpError(400, 'Choose an image first');
  const { url, publicId } = await uploadBuffer(req.file.buffer, 'avatars');
  if (req.user.avatarPublicId) destroy(req.user.avatarPublicId);
  await User.updateOne({ _id: req.user._id }, { avatar: url, avatarSource: 'upload', avatarPublicId: publicId });
  res.json({ avatar: url });
};

exports.changePassword = async (req, res) => {
  const { current = '', password = '' } = req.body;
  if (password.length < 8) throw httpError(400, 'New password must be at least 8 characters');
  const u = await User.findById(req.user._id).select('+password');
  if (u.password && !(await bcrypt.compare(current, u.password))) throw httpError(401, 'Current password is wrong');
  const first = !u.password;
  u.password = await bcrypt.hash(password, 12); u.passwordChangedAt = new Date(); u.tokenVersion = (u.tokenVersion || 0) + 1;   // signs out every other device
  await u.save();
  setAuthCookie(res, u);
  notifyPasswordChange(u, req, first ? 'set' : 'changed');
  res.json({ ok: true });
};

exports.leaderboard = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);
  const users = await User.find({ banned: false, points: { $gt: 0 } }).sort({ points: -1 }).limit(limit).select(AUTHOR_FIELDS + ' stats').lean();
  res.json({ users: users.map(u => ({ ...brief(u), stats: u.stats })), ranks: RANKS });
};

exports.notifications = async (req, res) => {
  const items = await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(25).lean();
  res.json({ items });
};
exports.readNotifications = async (req, res) => { await Notification.updateMany({ user: req.user._id, read: false }, { read: true }); res.json({ ok: true }); };
exports.meta = (req, res) => res.json({ tags: TAGS, jobs: Object.keys(JOBS), presets: PRESETS });

exports.search = async (req, res) => {   // @mention autocomplete: people you follow come first
  const q = String(req.query.q || '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20);
  const filter = { banned: false }; if (q) filter.usernameLower = new RegExp('^' + q);
  const found = await User.find(filter).sort({ points: -1 }).limit(15).select(AUTHOR_FIELDS).lean();
  const fol = new Set((req.user.following || []).map(String));
  found.sort((a, b) => (fol.has(String(b._id)) - fol.has(String(a._id))));
  res.json({ users: found.slice(0, 6).map(brief) });
};
