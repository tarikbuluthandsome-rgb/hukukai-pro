// models/Dilekce.js
const mongoose = require('mongoose');

const dilekceSchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  username:     { type: String },
  davaTuru:     { type: String, default: 'genel' },
  title:        { type: String, default: 'İsimsiz Dilekçe' },
  content:      { type: String, required: true },   // HTML içerik
  // Dilekçe alanları (arama için)
  davaciAd:     { type: String, default: '' },
  davalıAd:     { type: String, default: '' },
  mahkeme:      { type: String, default: '' },
  isPDF:        { type: Boolean, default: false },
  isArchived:   { type: Boolean, default: false },
}, {
  timestamps: true
});

// Tam metin arama indexi
dilekceSchema.index({ userId: 1, createdAt: -1 });
dilekceSchema.index({ davaTuru: 1 });

module.exports = mongoose.model('Dilekce', dilekceSchema);


// models/ActivityLog.js
const activitySchema = new mongoose.Schema({
  userId:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  username:     { type: String, default: 'Anonim' },
  type:         { type: String, enum: ['login', 'logout', 'register', 'dilekce', 'admin', 'demo', 'error'] },
  description:  { type: String },
  ip:           { type: String, default: '' },
  userAgent:    { type: String, default: '' },
  createdAt:    { type: Date, default: Date.now, expires: 2592000 }  // 30 gün sonra otomatik sil
});

activitySchema.index({ type: 1, createdAt: -1 });

const ActivityLog = mongoose.model('ActivityLog', activitySchema);


// models/SiteConfig.js
const configSchema = new mongoose.Schema({
  key:   { type: String, unique: true, required: true },
  value: { type: mongoose.Schema.Types.Mixed }
});

const SiteConfig = mongoose.model('SiteConfig', configSchema);

module.exports = { ActivityLog, SiteConfig };
