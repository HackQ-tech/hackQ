const BugReport = require('../models/BugReport');
const User = require('../models/User');
const crypto = require('crypto');
const { uploadBuffer } = require('../config/cloudinary');
const { httpError, startOfDay, isHttpUrl } = require('../utils/helpers');
const { AUTHOR_FIELDS, brief } = require('../utils/serialize');
const { addPoints } = require('../utils/points');
const { notify } = require('../utils/notify');
const { POINTS } = require('../utils/ranks');
const mail = require('../utils/accountMail');

const CATS = ['ui', 'functionality', 'security', 'performance', 'content', 'other'], SEVS = ['low', 'medium', 'high', 'critical'];
const STATUSES = ['open', 'in_progress', 'fixed', 'invalid', 'duplicate'];
const LABEL = { in_progress: 'is being worked on', fixed: 'was fixed', invalid: 'was closed as not a bug', duplicate: 'was closed as a duplicate' };

exports.create = async (req, res) => {
  const b = req.body, title = String(b.title || '').trim(), description = String(b.description || '').trim(), steps = String(b.steps || '').trim();
  if (title.length < 5 || title.length > 120) throw httpError(400, 'Title must be 5-120 characters');
  if (description.length < 10) throw httpError(400, 'Please describe what went wrong (at least 10 characters)');
  if (description.length > 5000 || steps.length > 3000) throw httpError(400, 'Your report is too long');
  if (!CATS.includes(b.category) || !SEVS.includes(b.severity)) throw httpError(400, 'Pick a category and severity');
  let pageUrl = String(b.pageUrl || '').trim().slice(0, 300);
  if (pageUrl && !pageUrl.startsWith('/') && !isHttpUrl(pageUrl)) throw httpError(400, 'Page must be a link or a path like /post/my-post');
  if (await BugReport.countDocuments({ reporter: req.user._id, createdAt: { $gte: startOfDay() } }) >= 5) throw httpError(429, 'You can send up to 5 bug reports per day. Thank you for your enthusiasm!');
  const images = await Promise.all((req.files || []).slice(0, 3).map(f => uploadBuffer(f.buffer, 'bugs')));
  const bug = await BugReport.create({
    ref: 'BUG-' + crypto.randomBytes(3).toString('hex').toUpperCase(), reporter: req.user._id, title, description, steps, category: b.category, severity: b.severity, pageUrl,
    device: mail.device(req.headers['user-agent']), viewport: String(b.viewport || '').replace(/[^\dx@. ]/g, '').slice(0, 30), images
  });
  mail.sendBugReport(bug, req.user);   // admin + reporter emails, not awaited
  (await User.find({ role: 'admin', banned: false }).select('_id').lean()).forEach(a => notify({ user: a._id, actor: req.user._id, type: 'bug', text: `${req.user.username} reported a bug: "${title.slice(0, 60)}"`, link: '/admin#bugs' }));
  res.status(201).json({ ref: bug.ref, id: bug._id });
};

exports.mine = async (req, res) => res.json({ bugs: await BugReport.find({ reporter: req.user._id }).sort({ createdAt: -1 }).limit(50).select('-handledBy').lean(), reward: POINTS.bugReward });

// ---- admin ----
exports.list = async (req, res) => {
  const filter = STATUSES.includes(req.query.status) ? { status: req.query.status } : {};
  const [bugs, counts] = await Promise.all([
    BugReport.find(filter).sort({ createdAt: -1 }).limit(60).populate('reporter', AUTHOR_FIELDS + ' email').lean(),
    BugReport.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }])
  ]);
  res.json({ bugs: bugs.map(b => ({ ...b, reporterEmail: b.reporter?.email, reporter: b.reporter ? brief(b.reporter) : { username: 'deleted user', avatar: '/img/avatars/default.svg', rank: 'Newbie' } })), counts: Object.fromEntries(counts.map(c => [c._id, c.n])), reward: POINTS.bugReward });
};

exports.update = async (req, res) => {
  const bug = await BugReport.findById(req.params.id);
  if (!bug) throw httpError(404, 'Report not found');
  const status = req.body.status, note = String(req.body.note || '').trim().slice(0, 1000);
  if (!STATUSES.includes(status)) throw httpError(400, 'Invalid status');
  if (bug.rewarded && status !== 'fixed') throw httpError(400, 'The reward was already paid for this bug, so it stays fixed.');
  bug.status = status; bug.adminNote = note || bug.adminNote; bug.handledBy = req.user._id; bug.handledAt = new Date();
  let reward = 0;
  if (status === 'fixed' && !bug.rewarded) {       // valid + fixed -> 1000 points, once
    bug.rewarded = true; reward = POINTS.bugReward;
    await addPoints(bug.reporter, reward);
    await User.updateOne({ _id: bug.reporter }, { $inc: { 'stats.bugsFixed': 1 } });
  }
  await bug.save();
  const reporter = await User.findById(bug.reporter).select('username email');
  if (reporter) {
    if (status !== 'open') notify({ user: reporter._id, actor: req.user._id, type: 'bug', text: `Your bug report ${bug.ref} ${LABEL[status]}${reward ? ` (+${reward} points)` : ''}`, link: '/report-bug' });
    mail.sendBugStatus(bug, reporter, reward || POINTS.bugReward);
  }
  res.json({ ok: true, rewarded: !!reward });
};
