const { getRank } = require('./ranks');
const Reaction = require('../models/Reaction');

const AUTHOR_FIELDS = 'username avatar points role badge verified';
const brief = (u) => u && ({ _id: u._id, username: u.username, avatar: u.avatar, role: u.role, badge: u.badge, verified: u.verified, points: u.points, rank: getRank(u.points).name });

// The logged-in user's own data
const selfUser = (u) => ({
  ...brief(u), email: u.email, provider: u.provider, birthdate: u.birthdate, bio: u.bio, portfolio: u.portfolio, github: u.github,
  job: u.job, interests: u.interests, privacy: u.privacy, notify: u.notify, avatarSource: u.avatarSource, rankInfo: getRank(u.points),
  followers: u.followers.length, following: u.following.length, stats: u.stats, hasPassword: !!u.hasPassword, createdAt: u.createdAt
});

async function decoratePosts(posts, viewer, full = false) {
  const ids = posts.map(p => p._id);
  const mine = {};
  if (viewer && ids.length) (await Reaction.find({ user: viewer._id, targetType: 'post', target: { $in: ids }, active: true }).lean()).forEach(r => { mine[r.target] = r.type; });
  const bm = new Set((viewer?.bookmarks || []).map(String));
  return posts.map(({ __v, reports, ...p }) => ({
    ...p, length: p.content.length, content: full ? p.content : p.content.slice(0, 700), author: brief(p.author), my: mine[p._id] || null, bookmarked: bm.has(String(p._id))
  }));
}

async function decorateComments(comments, viewer) {
  const ids = comments.map(c => c._id);
  const mine = {};
  if (viewer && ids.length) (await Reaction.find({ user: viewer._id, targetType: 'comment', target: { $in: ids }, active: true }).lean()).forEach(r => { mine[r.target] = r.type; });
  return comments.map(({ __v, ...c }) => ({ ...c, author: brief(c.author), my: mine[c._id] || null }));
}
module.exports = { AUTHOR_FIELDS, brief, selfUser, decoratePosts, decorateComments };
