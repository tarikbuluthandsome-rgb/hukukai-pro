// api/dilekce.js  →  Vercel: /api/dilekce
const connectDB = require('../lib/db');
const Dilekce = require('../models/Dilekce');
const User = require('../models/User');
const { ActivityLog } = require('../models/Dilekce');
const { verifyToken, requireMaster } = require('../middleware/auth');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  await connectDB();
  const { action, id } = req.query;
  const auth = await verifyToken(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const isMaster = auth.user.role === 'master' || auth.user === 'master';
  const userId = isMaster ? null : auth.user._id;

  // ─── KAYDET ──────────────────────────────────────────────────
  if (action === 'save' && req.method === 'POST') {
    const { content, davaTuru, title, davaciAd, davalıAd, mahkeme } = req.body;
    if (!content) return res.status(400).json({ error: 'İçerik boş olamaz' });

    const dilekce = await Dilekce.create({
      userId: isMaster ? '000000000000000000000000' : userId,
      username: isMaster ? 'Master' : auth.user.username,
      content, davaTuru, title: title || `${davaTuru || 'Dilekçe'} - ${new Date().toLocaleDateString('tr-TR')}`,
      davaciAd, davalıAd, mahkeme
    });

    // Kullanıcının dilekçe sayacını artır
    if (!isMaster) await User.findByIdAndUpdate(userId, { $inc: { dilekceCount: 1 } });
    await ActivityLog.create({
      userId: isMaster ? null : userId,
      username: isMaster ? 'Master' : auth.user.username,
      type: 'dilekce',
      description: `Dilekçe kaydedildi: ${dilekce.title}`
    });

    return res.status(201).json({ dilekce });
  }

  // ─── LİSTELE ─────────────────────────────────────────────────
  if (action === 'list' && req.method === 'GET') {
    const { page = 1, limit = 20, davaTuru, search } = req.query;
    const filter = isMaster ? {} : { userId };
    if (davaTuru) filter.davaTuru = davaTuru;
    if (search) filter.$or = [
      { title: { $regex: search, $options: 'i' } },
      { davaciAd: { $regex: search, $options: 'i' } },
    ];
    filter.isArchived = { $ne: true };

    const [items, total] = await Promise.all([
      Dilekce.find(filter).select('-content').sort({ createdAt: -1 }).skip((page-1)*limit).limit(Number(limit)),
      Dilekce.countDocuments(filter)
    ]);
    return res.json({ items, total, pages: Math.ceil(total / limit) });
  }

  // ─── TEK KAYIT OKU ───────────────────────────────────────────
  if (action === 'get' && req.method === 'GET') {
    const dilekce = await Dilekce.findById(id);
    if (!dilekce) return res.status(404).json({ error: 'Dilekçe bulunamadı' });
    if (!isMaster && String(dilekce.userId) !== String(userId)) return res.status(403).json({ error: 'Erişim yok' });
    return res.json({ dilekce });
  }

  // ─── SİL ─────────────────────────────────────────────────────
  if (action === 'delete' && req.method === 'DELETE') {
    const dilekce = await Dilekce.findById(id);
    if (!dilekce) return res.status(404).json({ error: 'Bulunamadı' });
    if (!isMaster && String(dilekce.userId) !== String(userId)) return res.status(403).json({ error: 'Erişim yok' });
    await dilekce.deleteOne();
    return res.json({ message: 'Silindi' });
  }

  // ─── İSTATİSTİK (master) ─────────────────────────────────────
  if (action === 'stats' && req.method === 'GET') {
    if (!isMaster) return res.status(403).json({ error: 'Yetki yok' });
    const [total, byType, today] = await Promise.all([
      Dilekce.countDocuments(),
      Dilekce.aggregate([{ $group: { _id: '$davaTuru', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }]),
      Dilekce.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0,0,0,0)) } })
    ]);
    return res.json({ total, byType, today });
  }

  return res.status(404).json({ error: 'Geçersiz işlem' });
};
