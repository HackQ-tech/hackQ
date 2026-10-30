// Simple, explainable feed scoring - no ML, just preference scores.
const User = require('../models/User');
const { JOBS } = require('./tags');

// Raise (or lower) a user's interest in tags. react=+2, comment=+3, view=+0.5
exports.bumpPrefs = (userId, tags = [], n) => {
  if (!userId || !tags.length) return;
  const inc = {}; tags.forEach(t => { inc[`prefs.${t}`] = n; });
  User.updateOne({ _id: userId }, { $inc: inc }).catch(() => {});
};

exports.scorePost = (p, user, followingSet) => {
  const ageH = (Date.now() - new Date(p.createdAt)) / 36e5;
  let s = Math.max(0, 40 - ageH * 0.5);                              // fresh posts float to the top
  if (followingSet.has(String(p.author._id || p.author))) s += 60;  // people you follow: high priority
  const jobTags = JOBS[user.job] || [];
  for (const t of [...p.tags, 'type_' + p.type]) {
    s += Math.min(user.prefs?.[t] || 0, 30) * 2;                      // learned from likes / comments / reads
    if (user.interests?.includes(t)) s += 8;                         // chosen interests
    if (jobTags.includes(t)) s += 4;                                 // job-based nudge
  }
  s += Math.log2(2 + p.reactionCount + 2 * p.commentCount) * 3;     // quality signal
  s += Math.random() * 5;                                            // a little variety
  return s;
};

exports.trendScore = (p) => {
  const ageH = (Date.now() - new Date(p.createdAt)) / 36e5;
  return (p.reactionCount + p.commentCount * 2 + p.views / 20) / Math.pow(ageH + 2, 0.6);
};
