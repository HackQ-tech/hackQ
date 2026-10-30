const mongoose = require('mongoose');
const { Schema } = mongoose;
const { TYPES } = require('../utils/types');

const postSchema = new Schema({
  author: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  slug: { type: String, required: true, unique: true, index: true },
  content: { type: String, required: true, maxlength: 50000 },
  tags: [{ type: String, index: true }],
  images: [{ url: String, publicId: String }],
  youtubeId: String,
  projectUrl: String,
  type: { type: String, enum: TYPES, default: 'discussion', index: true },
  cve: { id: String, severity: String, score: Number, product: String, reference: String },
  event: { date: Date, link: String, location: String },
  announced: { type: Boolean, default: false },
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  rejectReason: String,
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  pointsAwarded: { type: Boolean, default: false },
  reactions: { like: { type: Number, default: 0 }, fire: { type: Number, default: 0 }, bulb: { type: Number, default: 0 }, skull: { type: Number, default: 0 } },
  reactionCount: { type: Number, default: 0 },
  commentCount: { type: Number, default: 0 },
  views: { type: Number, default: 0 },
  shares: { type: Number, default: 0 },
  edited: { type: Boolean, default: false }
}, { timestamps: true });

postSchema.index({ status: 1, createdAt: -1 });
module.exports = mongoose.model('Post', postSchema);
