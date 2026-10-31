const User = require('../models/User');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const { AUTHOR_FIELDS, decoratePosts, decorateComments } = require('../utils/serialize');
const { httpError, escapeRegex } = require('../utils/helpers');
const { approvePost, addPoints } = require('../utils/points');
const { notify } = require('../utils/notify');

exports.stats = async (req, res) => {
  const day = new Date(Date.now() - 864e5);
  const [users, posts, pending, comments, banned, newUsers, newPosts, bugsOpen] = await Promise.all([
    User.countDocuments(), Post.countDocuments({ status: 'approved' }), Post.countDocuments({ status: 'pending' }), Comment.countDocuments(),
    User.countDocuments({ banned: true }), User.countDocuments({ createdAt: { $gte: day } }), Post.countDocuments({ createdAt: { $gte: day } }),
    require('../models/BugReport').countDocuments({ status: { $in: ['open', 'in_progress'] } })
  ]);
  res.json({ users, posts, pending, comments, banned, newUsers, newPosts, bugsOpen });
};

exports.posts = async (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : 'pending';
  const docs = await Post.find({ status }).sort({ createdAt: -1 }).limit(50).populate('author', AUTHOR_FIELDS).lean();
  res.json({ posts: await decoratePosts(docs, null) });
};

exports.approve = async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw httpError(404, 'Post not found');
  await approvePost(post, req.user);
  notify({ user: post.author, actor: req.user._id, text: `Your post "${post.title.slice(0, 50)}" was approved (+5 points)`, link: `/post/${post.slug}` });
  res.json({ ok: true });
};

exports.reject = async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw httpError(404, 'Post not found');
  post.status = 'rejected'; post.rejectReason = String(req.body.reason || '').slice(0, 300);
  await post.save();
  notify({ user: post.author, actor: req.user._id, text: `Your post "${post.title.slice(0, 50)}" was rejected${post.rejectReason ? ': ' + post.rejectReason : ''}`, link: `/post/${post.slug}` });
  res.json({ ok: true });
};

exports.users = async (req, res) => {
  const q = (req.query.q || '').trim();
  const filter = q ? { $or: [{ usernameLower: new RegExp(escapeRegex(q.toLowerCase())) }, { email: new RegExp(escapeRegex(q), 'i') }] } : {};
  const users = await User.find(filter).sort({ createdAt: -1 }).limit(50).select('username email avatar points role badge verified banned createdAt provider').lean();
  res.json({ users });
};

exports.updateUser = async (req, res) => {
  const t = await User.findById(req.params.id);
  if (!t) throw httpError(404, 'User not found');
  const self = String(t._id) === String(req.user._id), b = req.body;
  if (b.role !== undefined) {
    if (!['user', 'moderator', 'admin'].includes(b.role)) throw httpError(400, 'Invalid role');
    if (self && b.role !== 'admin') throw httpError(400, 'You cannot demote yourself');
    t.role = b.role;
    if (b.role === 'admin' && t.badge === 'none') { t.badge = 'blue'; t.verified = true; }      // admins get the blue verified tick
    if (b.role === 'moderator' && t.badge === 'none') { t.badge = 'gray'; t.verified = true; }  // moderators get gray
  }
  if (b.badge !== undefined) { if (!['none', 'blue', 'gray', 'gold', 'red'].includes(b.badge)) throw httpError(400, 'Invalid badge'); t.badge = b.badge; }
  if (b.verified !== undefined) t.verified = !!b.verified;
  if (b.banned !== undefined) {
    if (self) throw httpError(400, 'You cannot ban yourself');
    if (t.role === 'admin') throw httpError(400, 'Demote this admin before banning');
    t.banned = !!b.banned; t.banReason = b.banned ? String(b.reason || '').slice(0, 200) : undefined;
  }
  await t.save();
  if (b.points !== undefined && Number.isFinite(+b.points)) await addPoints(t._id, Math.trunc(+b.points));  // delta, e.g. +50 / -20
  res.json({ ok: true });
};

exports.comments = async (req, res) => {
  const docs = await Comment.find().sort({ createdAt: -1 }).limit(50).populate('author', AUTHOR_FIELDS).populate('post', 'slug title').lean();
  const out = await decorateComments(docs, null);
  res.json({ comments: out.map((c, i) => ({ ...c, post: docs[i].post })) });
};
