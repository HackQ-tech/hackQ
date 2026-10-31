const mongoose = require('mongoose');
const { Schema } = mongoose;
// One collection for: verify (6-digit email code), reset (password link), secure ("this wasn't me" link)
const s = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['verify', 'reset', 'secure'], required: true },
  hash: { type: String, required: true },          // sha256 of the code/token - raw values are never stored
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true }
}, { timestamps: true });
s.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });   // Mongo deletes expired tokens automatically
module.exports = mongoose.model('Token', s);
