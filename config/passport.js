const passport = require('passport');
const User = require('../models/User');
const { uniqueUsername } = require('../utils/helpers');
const { sendWelcome } = require('../utils/accountMail');

const BASE = process.env.BASE_URL || 'http://localhost:3000';

async function findOrCreate(provider, profile, email, avatar) {
  let user = await User.findOne({ provider, providerId: profile.id });
  if (user) {
    if (avatar && user.avatarSource === 'oauth' && user.avatar !== avatar) { user.avatar = avatar; await user.save(); }
    return user;
  }
  if (email) { // link to an existing account with the same verified email
    user = await User.findOne({ email });
    if (user) { if (!user.emailVerified) { user.emailVerified = true; await user.save(); } return user; }   // provider proved the email
  }
  const base = profile.username || (profile.displayName || '').replace(/\s+/g, '') || (email || '').split('@')[0] || 'hacker';
  const created = await User.create({
    username: await uniqueUsername(base),
    email: email || `${provider}-${profile.id}@users.noreply.hackq.local`,
    provider, providerId: profile.id,
    avatar: avatar || '/img/avatars/default.svg',
    avatarSource: avatar ? 'oauth' : 'preset',
    role: process.env.ADMIN_EMAIL && email === process.env.ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user'
  });
  sendWelcome(created);
  return created;
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  const GoogleStrategy = require('passport-google-oauth20').Strategy;
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: `${BASE}/api/auth/google/callback`
  }, async (at, rt, profile, done) => {
    try {
      const email = profile.emails?.find(e => e.verified)?.value?.toLowerCase();
      done(null, await findOrCreate('google', profile, email, profile.photos?.[0]?.value));
    } catch (e) { done(e); }
  }));
}

if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  const GitHubStrategy = require('passport-github2').Strategy;
  passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: `${BASE}/api/auth/github/callback`, scope: ['user:email']
  }, async (at, rt, profile, done) => {
    try {
      const em = (profile.emails || []).find(e => e.primary && e.verified) || (profile.emails || []).find(e => e.verified);
      done(null, await findOrCreate('github', profile, em?.value?.toLowerCase(), profile.photos?.[0]?.value));
    } catch (e) { done(e); }
  }));
}

module.exports = passport;
