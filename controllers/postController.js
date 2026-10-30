const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Reaction = require('../models/Reaction');
const User = require('../models/User');
const { uploadBuffer, destroy } = require('../config/cloudinary');
const { TAGS } = require('../utils/tags');
const { TYPES, SEVERITIES } = require('../utils/types');
const { getRank, POINTS } = require('../utils/ranks');
const { AUTHOR_FIELDS, decoratePosts } = require('../utils/serialize');
const { httpError, makeSlug, startOfDay, youtubeId, isHttpUrl, escapeRegex } = require('../utils/helpers');
const { scorePost, trendScore, bumpPrefs } = require('../utils/feed');
const { approvePost, addPoints } = require('../utils/points');
const { isStaff } = require('../middleware/auth');
const toggleReaction = require('../utils/react');

const PAGE = 10, MAX_IMAGES = 4;
const pop = { path: 'author', select: AUTHOR_FIELDS };

function parseBody(b, type) {
  const title = (b.title || '').trim(), content = (b.content || '').trim();
  if (title.length < 5 || title.length > 150) throw httpError(400, 'Title must be 5-150 characters');
  if (content.length < 10) throw httpError(400, 'Write at least 10 characters');
  if (content.length > 50000) throw httpError(400, 'Content is too long (max 50,000 characters)');
  const tags = [...new Set([].concat(b.tags || []).flatMap(t => String(t).split(',')).map(t => t.trim().toLowerCase()).filter(t => TAGS.includes(t)))].slice(0, 5);
  const url = (v, label) => { v = (v || '').trim(); if (v && !isHttpUrl(v)) throw httpError(400, `${label} must start with http(s)://`); return v; };
  const data = { title, content, tags, type, youtubeId: '', projectUrl: '' };
  if (['project', 'tutorial'].includes(type) && b.youtube) {
    data.youtubeId = youtubeId(b.youtube);
    if (!data.youtubeId) throw httpError(400, 'That does not look like a YouTube link');
  }
  if (type === 'project') {
    data.projectUrl = url(b.projectUrl, 'Project link');
    if (!data.projectUrl) throw httpError(400, 'Add a link to your project (repo or live demo)');
  }
  if (type === 'cve') {
    const id = (b.cveId || '').trim().toUpperCase();
    if (!/^CVE-\d{4}-\d{4,7}$/.test(id)) throw httpError(400, 'CVE ID format: CVE-2024-12345');
    const severity = (b.severity || '').toLowerCase();
    if (!SEVERITIES.includes(severity)) throw httpError(400, 'Pick a severity');
    const score = b.cvss === '' || b.cvss == null ? undefined : Number(b.cvss);
    if (score !== undefined && !(score >= 0 && score <= 10)) throw httpError(400, 'CVSS score must be between 0 and 10');
    data.cve = { id, severity, score, product: (b.product || '').trim().slice(0, 100), reference: url(b.reference, 'Reference link') };
  }
  if (['ctf', 'event'].includes(type)) {
    const date = new Date(b.eventDate);
    if (!b.eventDate || isNaN(date)) throw httpError(400, 'Pick the date and time');
    data.event = { date, link: url(b.eventLink, 'Event link'), location: (b.location || 'Online').trim().slice(0, 80) };
  }
  return data;
}
const uploadAll = files => Promise.all((files || []).map(f => uploadBuffer(f.buffer, 'posts')));

exports.create = async (req, res) => {
  const me = req.user;
  if (!me.birthdate) throw httpError(403, 'Add your birthdate in Settings before posting');
  const staff = isStaff(me), rank = getRank(me.points);
  if (!staff) {
    const today = await Post.countDocuments({ author: me._id, createdAt: { $gte: startOfDay() } });
    if (today >= rank.dailyPosts) throw httpError(429, `Daily limit reached: ${rank.name}s can post ${rank.dailyPosts}x per day. Earn points to rank up!`);
  }
  if (!TYPES.includes(req.body.type)) throw httpError(400, 'Choose a post type');
  const data = parseBody(req.body, req.body.type);
  const images = await uploadAll(req.files);
  const post = new Post({ ...data, images, author: me._id, slug: makeSlug(data.title) });
  const autoApprove = staff || me.points >= POINTS.autoApproveAt;
  if (autoApprove) await approvePost(post, staff ? me : null); else await post.save();
  res.status(201).json({ slug: post.slug, pending: !autoApprove });
};

exports.update = async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw httpError(404, 'Post not found');
  const staff = isStaff(req.user);
  if (String(post.author) !== String(req.user._id) && !staff) throw httpError(403, 'Not your post');
  Object.assign(post, parseBody(req.body, post.type));
  let remove = []; try { remove = JSON.parse(req.body.removeImages || '[]'); } catch {}
  const gone = post.images.filter(i => remove.includes(i.publicId));
  post.images = post.images.filter(i => !remove.includes(i.publicId));
  if (post.images.length + (req.files || []).length > MAX_IMAGES) throw httpError(400, `Max ${MAX_IMAGES} images per post`);
  post.images.push(...await uploadAll(req.files));
  gone.forEach(i => destroy(i.publicId));
  post.edited = true;
  // Edits by low-rank authors go back to review so a harmless post can't be swapped for a bad one
  if (!staff && req.user.points < POINTS.autoApproveAt && post.status === 'approved') post.status = 'pending';
  await post.save();
  res.json({ slug: post.slug, pending: post.status !== 'approved' });
};

exports.remove = async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) throw httpError(404, 'Post not found');
  const own = String(post.author) === String(req.user._id);
  if (!own && !isStaff(req.user)) throw httpError(403, 'Not your post');
  post.images.forEach(i => destroy(i.publicId));
  const cids = (await Comment.find({ post: post._id }).select('_id').lean()).map(c => c._id);
  await Promise.all([
    Comment.deleteMany({ post: post._id }),
    Reaction.deleteMany({ $or: [{ targetType: 'post', target: post._id }, { targetType: 'comment', target: { $in: cids } }] }),
    post.deleteOne()
  ]);
  if (!own && post.pointsAwarded) { await addPoints(post.author, -POINTS.post); await User.updateOne({ _id: post.author }, { $inc: { 'stats.posts': -1 } }); }
  res.json({ ok: true });
};

exports.list = async (req, res) => {
  const me = req.user, q = (req.query.q || '').trim(), tag = req.query.tag;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  let tab = req.query.tab || 'foryou';
  if (!me && tab === 'foryou') tab = 'latest';
  if (!me && ['following', 'saved'].includes(tab)) throw httpError(401, 'Log in to see this');

  const filter = { status: 'approved' };
  if (TAGS.includes(tag)) filter.tags = tag;
  if (TYPES.includes(req.query.type)) filter.type = req.query.type;
  if (q) { const rx = new RegExp(escapeRegex(q.slice(0, 60)), 'i'); filter.$or = [{ title: rx }, { content: rx }, { 'cve.id': rx }, { tags: rx }]; }

  let docs, hasMore;
  if (['latest', 'following', 'saved', 'upcoming'].includes(tab)) {
    if (tab === 'upcoming') { filter['event.date'] = { $gte: new Date() }; if (!filter.type) filter.type = { $in: ['ctf', 'event'] }; }
    if (tab === 'following') filter.author = { $in: me.following };
    if (tab === 'saved') filter._id = { $in: me.bookmarks };
    docs = await Post.find(filter).sort(tab === 'upcoming' ? { 'event.date': 1 } : { createdAt: -1 }).skip((page - 1) * PAGE).limit(PAGE + 1).populate(pop).lean();
    hasMore = docs.length > PAGE; docs = docs.slice(0, PAGE);
  } else {
    const days = tab === 'trending' ? 7 : 30;
    filter.createdAt = { $gte: new Date(Date.now() - days * 864e5) };
    const pool = await Post.find(filter).sort({ createdAt: -1 }).limit(300).populate(pop).lean();
    const fset = new Set((me?.following || []).map(String));
    const scored = pool.map(p => ({ p, s: tab === 'trending' ? trendScore(p) : scorePost(p, me, fset) })).sort((a, b) => b.s - a.s).map(x => x.p);
    docs = scored.slice((page - 1) * PAGE, page * PAGE); hasMore = scored.length > page * PAGE;
  }
  res.json({ posts: await decoratePosts(docs, me), hasMore, tab });
};

exports.bySlug = async (req, res) => {
  const post = await Post.findOne({ slug: req.params.slug }).populate(pop).lean();
  if (!post) throw httpError(404, 'Post not found');
  const me = req.user, own = me && String(post.author._id) === String(me._id);
  if (post.status !== 'approved' && !own && !isStaff(me)) throw httpError(404, 'Post not found');
  if (!own && post.status === 'approved') {
    Post.updateOne({ _id: post._id }, { $inc: { views: 1 } }).exec();
    post.views++;
    if (me) bumpPrefs(me._id, [...post.tags, 'type_' + post.type], 0.5);
  }
  res.json({ post: (await decoratePosts([post], me, true))[0] });
};

exports.react = async (req, res) => {
  const post = await Post.findOne({ _id: req.params.id, status: 'approved' });
  if (!post) throw httpError(404, 'Post not found');
  res.json(await toggleReaction({ user: req.user, targetType: 'post', Model: Post, target: post, type: req.body.type, link: `/post/${post.slug}` }));
};

exports.share = async (req, res) => { await Post.updateOne({ _id: req.params.id, status: 'approved' }, { $inc: { shares: 1 } }); res.json({ ok: true }); };

exports.bookmark = async (req, res) => {
  const has = req.user.bookmarks.some(b => String(b) === req.params.id);
  await User.updateOne({ _id: req.user._id }, has ? { $pull: { bookmarks: req.params.id } } : { $addToSet: { bookmarks: req.params.id } });
  res.json({ bookmarked: !has });
};

exports.tags = async (req, res) => {
  const t = await Post.aggregate([{ $match: { status: 'approved' } }, { $unwind: '$tags' }, { $group: { _id: '$tags', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 15 }]);
  res.json({ all: TAGS, trending: t.map(x => ({ tag: x._id, count: x.count })) });
};

exports.widgets = async (req, res) => {
  const [events, cves] = await Promise.all([
    Post.find({ status: 'approved', type: { $in: ['ctf', 'event'] }, 'event.date': { $gte: new Date() } }).sort({ 'event.date': 1 }).limit(5).select('title slug type event').lean(),
    Post.find({ status: 'approved', type: 'cve' }).sort({ createdAt: -1 }).limit(5).select('title slug cve createdAt').lean()
  ]);
  res.json({ events, cves });
};
