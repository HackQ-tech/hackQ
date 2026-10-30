const mongoose = require('mongoose');
const { Schema } = mongoose;
const s = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  targetType: { type: String, enum: ['post', 'comment'], required: true },
  target: { type: Schema.Types.ObjectId, required: true },
  type: { type: String, enum: ['like', 'fire', 'bulb', 'skull'], required: true },
  active: { type: Boolean, default: true }   // kept (inactive) after un-react so points can't be farmed by toggling heh
});
s.index({ user: 1, targetType: 1, target: 1 }, { unique: true });
module.exports = mongoose.model('Reaction', s);
