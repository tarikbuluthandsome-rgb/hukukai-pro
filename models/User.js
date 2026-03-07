// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username:     { type: String, required: true, unique: true, trim: true, minlength: 3 },
  email:        { type: String, required: true, unique: true, lowercase: true },
  password:     { type: String, required: true, minlength: 6 },
  fullName:     { type: String, default: '' },
  role:         { type: String, enum: ['master', 'subscriber', 'demo'], default: 'subscriber' },
  status:       { type: String, enum: ['active', 'pending', 'blocked'], default: 'pending' },
  // Profil
  profilePhoto: { type: String, default: null },       // base64 veya URL
  // Abonelik
  plan:         { type: String, enum: ['none', 'monthly', 'yearly'], default: 'none' },
  planExpiry:   { type: Date, default: null },
  // İstatistikler
  dilekceCount:    { type: Number, default: 0 },
  lastLogin:       { type: Date, default: null },
  loginCount:      { type: Number, default: 0 },
  violationCount:  { type: Number, default: 0 },
  // Güvenlik
  failedLogins:    { type: Number, default: 0 },
  lockedUntil:     { type: Date, default: null },
  // Demo
  demoStartDate:   { type: Date, default: null },
  demoUsedToday:   { type: Number, default: 0 },
  demoLastDay:     { type: String, default: null },
}, {
  timestamps: true   // createdAt, updatedAt otomatik
});

// Şifre kaydetmeden önce hash'le
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Şifre doğrulama metodu
userSchema.methods.verifyPassword = async function(plain) {
  return bcrypt.compare(plain, this.password);
};

// JSON'a dönüştürürken şifreyi gizle
userSchema.methods.toSafeObject = function() {
  const obj = this.toObject();
  delete obj.password;
  delete obj.failedLogins;
  delete obj.lockedUntil;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
