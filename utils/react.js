const Reaction = require('../models/Reaction');
const User = require('../models/User');
const { addPoints } = require('./points');
const { bumpPrefs } = require('./feed');
const { notify } = require('./notify');
const { httpError } = require('./helpers');
const { POINTS } = require('./ranks');

// Toggle / switch a reaction on a post or comment. Every 3rd *new* reaction a user gives = +1 point.
module.exports = async function toggleReaction({ user, targetType, Model, target, type, link }) {
  if (!['like', 'fire', 'bulb', 'skull'].includes(type)) throw httpError(400, 'Invalid reaction');
  let r = await Reaction.findOne({ user: user._id, targetType, target: target._id });
  const inc = {}; let isNew = false;
  if (!r) {
    r = await Reaction.create({ user: user._id, targetType, target: target._id, type });
    inc[`reactions.${type}`] = 1; inc.reactionCount = 1; isNew = true;
  } else if (r.active && r.type === type) {
    r.active = false; inc[`reactions.${type}`] = -1; inc.reactionCount = -1; await r.save();
  } else if (r.active) {
    inc[`reactions.${r.type}`] = -1; inc[`reactions.${type}`] = 1; r.type = type; await r.save();
  } else {
    r.active = true; r.type = type; inc[`reactions.${type}`] = 1; inc.reactionCount = 1; await r.save();
  }
  const updated = await Model.findByIdAndUpdate(target._id, { $inc: inc }, { new: true }).lean();
  if (isNew) {
    const u = await User.findByIdAndUpdate(user._id, { $inc: { 'stats.reactionsGiven': 1 } }, { new: true });
    if (u.stats.reactionsGiven % POINTS.reactionsPerPoint === 0) await addPoints(user._id, 1);
    if (targetType === 'post') bumpPrefs(user._id, [...target.tags, 'type_' + target.type], 2);
    notify({ user: target.author, actor: user._id, type: 'reaction', text: `${user.username} reacted to your ${targetType}`, link });
  }
  return { counts: updated.reactions, total: updated.reactionCount, my: r.active ? r.type : null };
};
