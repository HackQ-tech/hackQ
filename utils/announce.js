const User = require('../models/User');
const Notification = require('../models/Notification');
const { mentionedUsers } = require('./mentions');
const WHAT = { discussion: 'a discussion', question: 'a question', project: 'a project', tutorial: 'a tutorial', cve: 'a CVE', ctf: 'a CTF', event: 'an event' };

// Runs once, when a post first goes live: notifies @mentioned users and everyone who follows the author
module.exports = async function announcePost(post) {
  const author = await User.findById(post.author).select('username followers').lean();
  if (!author) return;
  const link = `/post/${post.slug}`, title = post.title.slice(0, 70);
  const mentioned = await mentionedUsers(`${post.title} ${post.content}`, author._id);
  const skip = new Set(mentioned.map(u => String(u._id)));
  const docs = mentioned.map(u => ({ user: u._id, actor: author._id, type: 'mention', text: `${author.username} mentioned you in "${title}"`, link }));
  const followers = await User.find({ _id: { $in: author.followers.slice(0, 5000) }, banned: false, 'notify.posts': { $ne: false } }).select('_id').lean();
  followers.filter(f => !skip.has(String(f._id))).forEach(f => docs.push({ user: f._id, actor: author._id, type: 'post', text: `${author.username} posted ${WHAT[post.type] || 'a post'}: "${title}"`, link }));
  if (docs.length) await Notification.insertMany(docs);
};
