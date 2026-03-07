// api/users.js  →  Vercel: /api/users
const connectDB = require('../lib/db');
const User = require('../models/User');
const { ActivityLog } = require('../models/Dilekce');
const { requireMaster, verifyToken } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  await connectDB();
  const { action, id } = req.query;

  // ─── TÜM KULLANICILARI LİSTELE (master) ─────────────────────
  if (action === 'list' && req.method === 'GET') {
    const auth = await requireMaster(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { status, search, page = 1, limit = 50 } = req.query;
    const filter = {};
    if (status && status !== 'all') filter.status = status;
    if (search) filter.$or = [
      { username: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
      { fullName: { $regex: search, $options: 'i' } }
    ];

    const [users, total] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip((page-1)*limit).limit(Number(limit)),
      User.countDocuments(filter)
    ]);

    const stats = await User.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const statMap = { active: 0, pending: 0, blocked: 0 };
    stats.forEach(s => { statMap[s._id] = s.count; });

    return res.json({ users, total, stats: statMap });
  }

  // ─── KULLANICI EKLE (master) ─────────────────────────────────
  if (action === 'create' && req.method === 'POST') {
    const auth = await requireMaster(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { username, email, password, fullName, status = 'active' } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: 'Zorunlu alanlar eksik' });

    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) return res.status(409).json({ error: 'Kullanıcı adı veya e-posta zaten mevcut' });

    const user = await User.create({ username, email, password, fullName, status });
    await ActivityLog.create({ username: 'Master', type: 'admin', description: `Kullanıcı eklendi: ${username}` });
    return res.status(201).json({ user: user.toSafeObject() });
  }

  // ─── KULLANICI GÜNCELLE (master) ──────────────────────────────
  if (action === 'update' && req.method === 'PUT') {
    const auth = await requireMaster(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });

    const { status, role, plan, planExpiry, violationCount, newPassword } = req.body;
    if (status)   user.status = status;
    if (role)     user.role = role;
    if (plan)     user.plan = plan;
    if (planExpiry) user.planExpiry = new Date(planExpiry);
    if (violationCount !== undefined) user.violationCount = violationCount;
    if (newPassword) {
      if (newPassword.length < 6) return res.status(400).json({ error: 'Şifre en az 6 karakter' });
      user.password = newPassword; // pre-save hash'leyecek
    }
    await user.save();
    await ActivityLog.create({ username: 'Master', type: 'admin', description: `${user.username} güncellendi` });
    return res.json({ user: user.toSafeObject() });
  }

  // ─── KULLANICI SİL (master) ───────────────────────────────────
  if (action === 'delete' && req.method === 'DELETE') {
    const auth = await requireMaster(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ error: 'Kullanıcı bulunamadı' });
    await ActivityLog.create({ username: 'Master', type: 'admin', description: `${user.username} silindi` });
    return res.json({ message: 'Kullanıcı silindi' });
  }

  // ─── KENDİ PROFİLİNİ GÜNCELLE ────────────────────────────────
  if (action === 'profile' && req.method === 'PUT') {
    const auth = await verifyToken(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { fullName, profilePhoto, currentPassword, newPassword } = req.body;
    const user = auth.user;

    if (fullName) user.fullName = fullName;
    if (profilePhoto) user.profilePhoto = profilePhoto;
    if (newPassword) {
      if (!currentPassword) return res.status(400).json({ error: 'Mevcut şifre gerekli' });
      const ok = await user.verifyPassword(currentPassword);
      if (!ok) return res.status(401).json({ error: 'Mevcut şifre hatalı' });
      if (newPassword.length < 6) return res.status(400).json({ error: 'Yeni şifre en az 6 karakter' });
      user.password = newPassword;
    }
    await user.save();
    return res.json({ user: user.toSafeObject() });
  }

  // ─── AKTİVİTE LOGU (master) ───────────────────────────────────
  if (action === 'activity' && req.method === 'GET') {
    const auth = await requireMaster(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const { type, limit = 100 } = req.query;
    const filter = type && type !== 'all' ? { type } : {};
    const logs = await ActivityLog.find(filter).sort({ createdAt: -1 }).limit(Number(limit));
    return res.json({ logs });
  }

  return res.status(404).json({ error: 'Geçersiz işlem' });
};
