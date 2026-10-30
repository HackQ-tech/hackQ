const mongoose = require('mongoose');
const pub = { type: Boolean, default: true };

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, trim: true },
  usernameLower: { type: String, unique: true, index: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, select: false },
  provider: { type: String, enum: ['local', 'google', 'github'], default: 'local' },
  providerId: String,
  avatar: { type: String, default: '/img/avatars/default.svg' },
  avatarSource: { type: String, enum: ['preset', 'upload', 'oauth'], default: 'preset' },
  avatarPublicId: String,
  birthdate: Date,
  bio: { type: String, maxlength: 300, default: '' },
  portfolio: { type: String, default: '' },
  github: { type: String, default: '' },
  job: { type: String, default: '' },
  interests: [String],
  // true = visible to everyone
  privacy: { bio: pub, portfolio: pub, github: pub, interests: pub, job: pub, birthdate: { type: Boolean, default: false } },
  points: { type: Number, default: 0 },
  stats: { posts: { type: Number, default: 0 }, comments: { type: Number, default: 0 }, reactionsGiven: { type: Number, default: 0 } },
  role: { type: String, enum: ['user', 'moderator', 'admin'], default: 'user' },
  badge: { type: String, enum: ['none', 'blue', 'gray', 'gold', 'red'], default: 'none' },
  verified: { type: Boolean, default: false },
  followers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  bookmarks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Post' }],
  notify: { posts: { type: Boolean, default: true }, mentions: { type: Boolean, default: true } },
  prefs: { type: Object, default: {} },   // tag -> preference score (feed personalisation)
  emailVerified: { type: Boolean, default: true },   // register() sets false until the emailed code is entered
  restricted: { type: Boolean, default: false },     // locked via the "secure my account" link until the password is reset
  tokenVersion: { type: Number, default: 0 },        // bump to sign out every session
  passwordChangedAt: Date,
  banned: { type: Boolean, default: false },
  banReason: String
}, { timestamps: true, minimize: false });

userSchema.index({ points: -1 });
userSchema.pre('validate', function (next) { this.usernameLower = this.username.toLowerCase(); next(); });
module.exports = mongoose.model('User', userSchema);
