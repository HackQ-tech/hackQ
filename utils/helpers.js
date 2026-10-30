const crypto = require('crypto');
const User = require('../models/User');

exports.asyncH = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
exports.httpError = (status, message) => Object.assign(new Error(message), { status });
exports.escapeRegex = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
exports.slugify = (t) => String(t).toLowerCase().normalize('NFKD').replace(/[^\w\s-]/g, '').trim().replace(/[\s_-]+/g, '-').slice(0, 60).replace(/^-|-$/g, '') || 'post';
exports.makeSlug = (title) => `${exports.slugify(title)}-${crypto.randomBytes(3).toString('hex')}`;
exports.startOfDay = () => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); return d; };

exports.youtubeId = (url = '') => {
  const m = String(url).match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/);
  return m ? m[1] : '';
};
exports.isHttpUrl = (u) => { try { const x = new URL(u); return ['http:', 'https:'].includes(x.protocol); } catch { return false; } };
exports.ageOf = (d) => { const b = new Date(d); if (isNaN(b)) return null; const n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n < new Date(n.getFullYear(), b.getMonth(), b.getDate())) a--; return a; };

exports.uniqueUsername = async (base) => {
  let name = String(base).replace(/[^a-zA-Z0-9_]/g, '').slice(0, 16) || 'hacker';
  if (name.length < 3) name += 'xyz';
  let candidate = name;
  while (await User.exists({ usernameLower: candidate.toLowerCase() })) candidate = `${name}${Math.floor(Math.random() * 9999)}`;
  return candidate;
};
