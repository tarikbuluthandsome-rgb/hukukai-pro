// api/email.js  →  Vercel: /api/email
const { verifyToken, requireMaster } = require('../middleware/auth');
const connectDB = require('../lib/db');
const User = require('../models/User');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = 'info@hukukai.pro';
const FROM_NAME = 'HukukAI Pro';

async function sendEmail({ to, subject, html }) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: `${FROM_NAME} <${FROM_EMAIL}>`,
      to: [to],
      subject,
      html
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'Mail gönderilemedi');
  return data;
}

function templateKayitOnay(fullName) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:20px"><div style="background:#dc2626;padding:20px;border-radius:8px 8px 0 0;text-align:center"><h1 style="color:white;margin:0">HukukAI Pro</h1></div><div style="background:white;padding:30px;border-radius:0 0 8px 8px"><h2 style="color:#1e293b">Merhaba ${fullName},</h2><p style="color:#475569">Hesabınız <strong style="color:#16a34a">onaylandı!</strong></p><div style="text-align:center;margin:30px 0"><a href="https://hukukai.pro" style="background:#dc2626;color:white;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold">Giris Yap</a></div></div></div>`;
}

function templateKayitBekleme(fullName, username) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:20px"><div style="background:#dc2626;padding:20px;border-radius:8px 8px 0 0;text-align:center"><h1 style="color:white;margin:0">HukukAI Pro</h1></div><div style="background:white;padding:30px;border-radius:0 0 8px 8px"><h2 style="color:#1e293b">Merhaba ${fullName},</h2><p style="color:#475569">Kayit talebiniz alindi. Kullanici adiniz: <strong>${username}</strong></p><p style="color:#475569">Yonetici onayi bekleniyor.</p></div></div>`;
}

function templateMasterYeniKayit(fullName, username, email) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:20px"><div style="background:#1e293b;padding:20px;border-radius:8px 8px 0 0;text-align:center"><h1 style="color:white;margin:0">Yeni Kayit Talebi</h1></div><div style="background:white;padding:30px;border-radius:0 0 8px 8px"><p>Ad: ${fullName}</p><p>Kullanici: ${username}</p><p>Email: ${email}</p><a href="https://hukukai.pro" style="background:#dc2626;color:white;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold">Admin Panele Git</a></div></div>`;
}

function templateSifreSifirla(fullName, yeniSifre) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f8fafc;padding:20px"><div style="background:#dc2626;padding:20px;border-radius:8px 8px 0 0;text-align:center"><h1 style="color:white;margin:0">HukukAI Pro</h1></div><div style="background:white;padding:30px;border-radius:0 0 8px 8px"><h2 style="color:#1e293b">Merhaba ${fullName},</h2><p>Yeni sifreniz: <strong style="font-size:20px">${yeniSifre}</strong></p><a href="https://hukukai.pro" style="background:#dc2626;color:white;padding:12px 30px;border-radius:6px;text-decoration:none;font-weight:bold">Giris Yap</a></div></div>`;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  await connectDB();
  const { action } = req.query;

  if (action === 'kayit-bildirim') {
    const { fullName, username, email, masterEmail } = req.body;
    try {
      await sendEmail({ to: email, subject: 'HukukAI Pro - Kayit Talebiniz Alindi', html: templateKayitBekleme(fullName, username) });
      if (masterEmail) await sendEmail({ to: masterEmail, subject: 'HukukAI Pro - Yeni Kayit: ' + username, html: templateMasterYeniKayit(fullName, username, email) });
      return res.json({ message: 'Mailler gonderildi' });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (action === 'onay-mail') {
    const auth = await requireMaster(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Kullanici bulunamadi' });
    try {
      await sendEmail({ to: user.email, subject: 'HukukAI Pro - Hesabiniz Onaylandi!', html: templateKayitOnay(user.fullName || user.username) });
      return res.json({ message: 'Onay maili gonderildi' });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  if (action === 'sifre-sifirla') {
    const auth = await requireMaster(req);
    if (auth.error) return res.status(auth.status).json({ error: auth.error });
    const { userId } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'Kullanici bulunamadi' });
    const yeniSifre = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-4).toUpperCase();
    user.password = yeniSifre;
    await user.save();
    try {
      await sendEmail({ to: user.email, subject: 'HukukAI Pro - Sifreniz Sifirlandi', html: templateSifreSifirla(user.fullName || user.username, yeniSifre) });
      return res.json({ message: 'Sifre sifirlandi ve mail gonderildi' });
    } catch (err) { return res.status(500).json({ error: err.message }); }
  }

  return res.status(404).json({ error: 'Gecersiz islem' });
};
