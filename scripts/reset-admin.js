// Usage: npm run reset-admin
// Makes the admin account in MongoDB match ADMIN_EMAIL / ADMIN_USERNAME / ADMIN_PASSWORD from .env
require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const User = require('../models/User');

(async () => {
  const { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_USERNAME = 'admin', MONGO_URI } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) { console.error('ADMIN_EMAIL / ADMIN_PASSWORD are missing. Is your .env file in the project root (next to package.json)?'); process.exit(1); }
  await mongoose.connect(MONGO_URI || 'mongodb://127.0.0.1:27017/hackq');
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const hash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  let u = await User.findOne({ email });
  if (u) Object.assign(u, { password: hash, role: 'admin', verified: true, emailVerified: true, restricted: false, badge: u.badge === 'none' ? 'blue' : u.badge, banned: false });
  else u = new User({ emailVerified: true, username: ADMIN_USERNAME, email, password: hash, role: 'admin', verified: true, badge: 'blue', birthdate: new Date('1990-01-01'), points: 3000 });
  await u.save();
  console.log(`Admin ready.\n  Log in with username "${u.username}" or email "${u.email}"\n  Password: the ADMIN_PASSWORD value from your .env (${ADMIN_PASSWORD.length} characters)`);
  await mongoose.disconnect();
})().catch(e => { console.error(e.message); process.exit(1); });
