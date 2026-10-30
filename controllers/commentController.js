const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Reaction = require('../models/Reaction');
const User = require('../models/User');
const { AUTHOR_FIELDS, decorateComments } = require('../utils/serialize');
const { httpError, startOfDay } = require('../utils/helpers');
const { addPoints } = require('../utils/points');
const { bumpPrefs } = require('../utils/feed');
const { notify } = require('../utils/notify');
const { mentionedUsers } = require('../utils/mentions');
const { POINTS } = require('../utils/ranks');
const { isStaff } = require('../middleware/auth');
const toggleReaction = require('../utils/react');

const isGiphy = u => { try { const x = new URL(u); return x.protocol === 'https:' && /(^|\.)giphy\.com$/.test(x.hostname); } catch { return false; } };

exports.list = async (req, res) => {
  const comments = await Comment.find({ post: req.params.id }).sort({ createdAt: 1 }).limit(500).populate('author', AUTHOR_FIELDS).lean();
  res.json({ comments: await decorateComments(comments, req.user) });
};

exports.create = async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, status: 'approved' });
  if (!post) throw httpError(404, 'Post not found');
  const text = (req.body.text || '').trim(), gifUrl = req.body.gifUrl || '';
  if (!text && !gifUrl) throw httpError(400, 'Write something or pick a GIF');
  if (text.length > 1500) throw httpError(400, 'Comment is too long (max 1500 characters)');
  if (gifUrl && !isGiphy(gifUrl)) throw httpError(400, 'Invalid GIF');

  let parent = null, parentDoc = null;
  if (req.body.parent) {
    parentDoc = await Comment.findOne({ _id: req.body.parent, post: post._id });
    if (!parentDoc) throw httpError(404, 'Comment you are replying to was not found');
    parent = parentDoc.parent || parentDoc._id;   // replies are one level deep
  }
  const todayCount = await Comment.countDocuments({ author: req.user._id, createdAt: { $gte: startOfDay() } });
  const comment = await Comment.create({ post: post._id, author: req.user._id, parent, text, gifUrl: gifUrl || undefined });
  await Post.updateOne({ _id: post._id }, { $inc: { commentCount: 1 } });
  await User.updateOne({ _id: req.user._id }, { $inc: { 'stats.comments': 1 } });
  // +3 points, capped per day so comment-spam can't farm rank
  if (todayCount < POINTS.commentsPerDayRewarded) await addPoints(req.user._id, POINTS.comment);
  bumpPrefs(req.user._id, [...post.tags, 'type_' + post.type], 3);

  const link = `/post/${post.slug}#c-${comment._id}`, done = new Set([String(req.user._id)]);
  const send = (user, type, msg) => { if (!done.has(String(user))) { done.add(String(user)); notify({ user, actor: req.user._id, type, text: msg, link }); } };
  (await mentionedUsers(text, req.user._id)).forEach(u => send(u._id, 'mention', `${req.user.username} mentioned you in a comment`));
  if (parentDoc) send(parentDoc.author, 'reply', `${req.user.username} replied to your comment`);
  send(post.author, 'comment', `${req.user.username} commented on "${post.title.slice(0, 50)}"`);

  const [c] = await decorateComments([await Comment.findById(comment._id).populate('author', AUTHOR_FIELDS).lean()], req.user);
  res.status(201).json({ comment: c });
};

exports.remove = async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) throw httpError(404, 'Comment not found');
  const own = String(c.author) === String(req.user._id);
  if (!own && !isStaff(req.user)) throw httpError(403, 'Not your comment');
  const ids = [c._id, ...(await Comment.find({ parent: c._id }).select('_id').lean()).map(x => x._id)];
  await Comment.deleteMany({ _id: { $in: ids } });
  await Reaction.deleteMany({ targetType: 'comment', target: { $in: ids } });
  await Post.updateOne({ _id: c.post }, { $inc: { commentCount: -ids.length } });
  if (!own) await addPoints(c.author, -POINTS.comment);   // moderator removal takes the points back
  res.json({ ok: true });
};

exports.react = async (req, res) => {
  const c = await Comment.findById(req.params.id);
  if (!c) throw httpError(404, 'Comment not found');
  const post = await Post.findById(c.post).select('slug').lean();
  res.json(await toggleReaction({ user: req.user, targetType: 'comment', Model: Comment, target: c, type: req.body.type, link: `/post/${post?.slug}#c-${c._id}` }));
};

exports.giphy = async (req, res) => {
  const key = process.env.GIPHY_API_KEY;
  if (!key) throw httpError(503, 'GIF search is not configured (GIPHY_API_KEY missing)');
  const q = (req.query.q || '').trim().slice(0, 50);
  const url = `https://api.giphy.com/v1/gifs/${q ? 'search' : 'trending'}?api_key=${key}&limit=18&rating=pg-13${q ? '&q=' + encodeURIComponent(q) : ''}`;
  const r = await fetch(url);
  if (!r.ok) throw httpError(502, 'Giphy is not responding');
  const d = await r.json();
  res.json({ gifs: (d.data || []).map(g => ({ id: g.id, url: g.images.fixed_height.url, preview: g.images.fixed_height_small?.url || g.images.fixed_height.url })) });
};
