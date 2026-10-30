const User = require('../models/User');
// Finds @username mentions 
exports.extract = t => [...new Set([...String(t).matchAll(/(?:^|[\s(])@([A-Za-z0-9_]{3,20})\b/g)].map(m => m[1].toLowerCase()))].slice(0, 10);
exports.mentionedUsers = async (text, excludeId) => {
  const names = exports.extract(text);
  if (!names.length) return [];
  return User.find({ usernameLower: { $in: names }, banned: false, 'notify.mentions': { $ne: false }, _id: { $ne: excludeId } }).select('_id username').lean();
};
