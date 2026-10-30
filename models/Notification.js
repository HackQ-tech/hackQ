const mongoose = require('mongoose');
const { Schema } = mongoose;
module.exports = mongoose.model('Notification', new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User' },
  type: { type: String, default: 'system' },
  text: String,
  link: String,
  read: { type: Boolean, default: false }
}, { timestamps: true }));
