// api/auth.js  →  Vercel: /api/auth
const connectDB = require('../lib/db');
const User = require('../models/User');
const { ActivityLog } = require('../models/Dilekce');
const { signToken, verifyToken } = require('../middleware/auth');

const MASTER_KEY  = process.env.MASTER_KEY  || 'At.630109';
const MASTER_JWT  = process.env.MASTER_JWT  || 'Ta630109';
const MAX_FAIL    = 5;
const LOCK_MINS   = 15;

module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  await connectDB();
  const { action } = req.query;

  // ─── MASTER GİRİŞ ───────────────────────────────────────────
  if (action === 'master-login' && req.method === 'POST') {
    const { key, jwtToken } = req.body;
    if (key !== MASTER_KEY || jwtToken !== MASTER_JWT) {
      return res.status(401).json({ error: 'Master bilgileri hatalı!' });
    }
    const token = signToken({ id: 'master', role: 'master', username: 'Master Admin' });
    await ActivityLog.create({ username: 'Master Admin', type: 'login', description: 'Master giriş', ip: req.headers['x-forwarded-for'] || '' });
    return res.json({ token, role: 'master', username: 'Master Admin' });
  }

  // ─── KULLANICI GİRİŞ ────────────────────────────────────────
  if (action === 'login' && req.method === 'POST') {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli' });

    const user = await User.findOne({ $or: [{ username }, { email: username.toLowerCase() }] });
    if (!user) return res.status(401).json({ error: 'Kullanıcı bulunamadı' });

    // Hesap kilidi kontrolü
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const mins = Math.ceil((user.lockedUntil - new Date()) / 60000);
      return res.status(429).json({ error: `Hesap kilitli. ${mins} dakika bekleyin.` });
    }
    if (user.status === 'pending') return res.status(403).json({ error: 'Hesabınız onay bekliyor', code: 'pending' });
    if (user.status === 'blocked') return res.status(403).json({ error: 'Hesabınız engellendi', code: 'blocked' });

    const ok = await user.verifyPassword(password);
    if (!ok) {
      user.failedLogins = (user.failedLogins || 0) + 1;
      if (user.failedLogins >= MAX_FAIL) {
        user.lockedUntil = new Date(Date.now() + LOCK_MINS * 60000);
        user.failedLogins = 0;
      }
      await user.save();
      return res.status(401).json({ error: 'Şifre hatalı', remaining: MAX_FAIL - (user.failedLogins || 0) });
    }

    // Başarılı giriş
    user.failedLogins = 0;
    user.lockedUntil = null;
    user.lastLogin = new Date();
    user.loginCount = (user.loginCount || 0) + 1;
    await user.save();

    const token = signToken({ id: user._id, role: user.role, username: user.username });
    await ActivityLog.create({ userId: user._id, username: user.username, type: 'login', description: `${user.username} giriş yaptı`, ip: req.headers['x-forwarded-for'] || '' });

    return res.json({ token, user: user.toSafeObject() });
  }

  // ─── KAYIT ──────────────────────────────────────────────────
  if (action === 'register' && req.method === 'POST') {
    const { fullName, email, username, password } = req.body;
    if (!fullName || !email || !username || !password) return res.status(400).json({ error: 'Tüm alanlar zorunlu' });
    if (password.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Geçersiz e-posta' });

    const exists = await User.findOne({ $or: [{ username }, { email: email.toLowerCase() }] });
    if (exists) return res.status(409).json({ error: exists.username === username ? 'Bu kullanıcı adı alınmış' : 'Bu e-posta zaten kayıtlı' });

    const user = await User.create({ fullName, email: email.toLowerCase(), username, password, status: 'pending' });
    await ActivityLog.create({ userId: user._id, username, type: 'register', description: `Kayıt talebi: ${username}` });

    return res.status(201).json({ message: 'Kayıt talebi alındı! Yönetici onayı bekleniyor.' });
  }

  // ─── KENDİ BİLGİLERİ ────────────────────────────────────────
  if (action === 'me' && req.method === 'GET') {
    const auth = await verifyToken(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    if (auth.user === 'master') return res.json({ role: 'master', username: 'Master Admin' });
    return res.json({ user: auth.user.toSafeObject() });
  }

  return res.status(404).json({ error: 'Geçersiz işlem' });
};
