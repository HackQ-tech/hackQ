const mongoose = require('mongoose');
const { Schema } = mongoose;
module.exports = mongoose.model('BugReport', new Schema({
  ref: { type: String, unique: true, index: true },                    // human-friendly id, e.g. BUG-3FA91C
  reporter: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 120 },
  description: { type: String, required: true, maxlength: 5000 },
  steps: { type: String, maxlength: 3000, default: '' },
  category: { type: String, enum: ['ui', 'functionality', 'security', 'performance', 'content', 'other'], default: 'other' },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'medium' },
  pageUrl: { type: String, maxlength: 300, default: '' },
  device: { type: String, default: '' },
  viewport: { type: String, default: '' },
  images: [{ url: String, publicId: String }],
  status: { type: String, enum: ['open', 'in_progress', 'fixed', 'invalid', 'duplicate'], default: 'open', index: true },
  adminNote: { type: String, maxlength: 1000, default: '' },
  handledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  handledAt: Date,
  rewarded: { type: Boolean, default: false }                          // the 1000 points are paid once
}, { timestamps: true }));
