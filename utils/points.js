const User = require('../models/User');
const { POINTS } = require('./ranks');
const announcePost = require('./announce');

exports.addPoints = async (userId, n) => {
  const u = await User.findByIdAndUpdate(userId, { $inc: { points: n } }, { new: true });
  if (u && u.points < 0) { u.points = 0; await u.save(); }
  return u;
};

// Gives the author +5 once per post, after app.
exports.approvePost = async (post, approver) => {
  post.status = 'approved'; post.rejectReason = undefined;
  const first = !post.announced; post.announced = true;
  if (approver) { post.approvedBy = approver._id; post.approvedAt = new Date(); }
  if (!post.pointsAwarded) {
    post.pointsAwarded = true;
    await User.findByIdAndUpdate(post.author, { $inc: { points: POINTS.post, 'stats.posts': 1 } });
  }
  await post.save();
  if (first) announcePost(post).catch(e => console.error('announce failed', e.message));
};
