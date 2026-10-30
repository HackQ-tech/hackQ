const mongoose = require('mongoose');
const { Schema } = mongoose;
module.exports = mongoose.model('Comment', new Schema({
  post: { type: Schema.Types.ObjectId, ref: 'Post', required: true, index: true },
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  parent: { type: Schema.Types.ObjectId, ref: 'Comment', default: null },
  text: { type: String, maxlength: 1500, default: '' },
  gifUrl: String,
  reactions: { like: { type: Number, default: 0 }, fire: { type: Number, default: 0 }, bulb: { type: Number, default: 0 }, skull: { type: Number, default: 0 } },
  reactionCount: { type: Number, default: 0 }
}, { timestamps: true }));
