// api/config.js  →  Vercel: /api/config
const connectDB = require('../lib/db');
const { SiteConfig } = require('../models/Dilekce');
const { requireMaster } = require('../middleware/auth');

// Public config key'leri (herkes okuyabilir)
const PUBLIC_KEYS = ['siteLogo', 'monthlyPrice', 'yearlyPrice', 'contactPhone', 'siteTitle', 'siteName'];

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  await connectDB();

  // ─── PUBLIC CONFIG OKU ────────────────────────────────────────
  if (req.method === 'GET') {
    const { key } = req.query;
    if (key) {
      if (!PUBLIC_KEYS.includes(key)) return res.status(403).json({ error: 'Bu config okuma yetki gerektirir' });
      const cfg = await SiteConfig.findOne({ key });
      return res.json({ key, value: cfg ? cfg.value : null });
    }
    // Tüm public config'leri döndür
    const configs = await SiteConfig.find({ key: { $in: PUBLIC_KEYS } });
    const result = {};
    configs.forEach(c => result[c.key] = c.value);
    return res.json(result);
  }

  // ─── CONFIG GÜNCELLE (master) ─────────────────────────────────
  if (req.method === 'POST') {
    const auth = await requireMaster(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });

    const updates = req.body; // { key: value, ... }
    const ops = Object.entries(updates).map(([key, value]) =>
      SiteConfig.findOneAndUpdate({ key }, { value }, { upsert: true, new: true })
    );
    await Promise.all(ops);
    return res.json({ message: 'Config güncellendi', updated: Object.keys(updates) });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
