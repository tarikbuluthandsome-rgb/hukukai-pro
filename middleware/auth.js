// middleware/auth.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const connectDB = require('../lib/db');

const JWT_SECRET = process.env.JWT_SECRET || 'hukukai_super_secret_2026';

// JWT token oluştur
function signToken(payload, expiresIn = '8h') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

// Token doğrula - Vercel API route'larında kullanılır
async function verifyToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { error: 'Token bulunamadı', status: 401 };
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    await connectDB();
    const user = await User.findById(decoded.id);
    if (!user) return { error: 'Kullanıcı bulunamadı', status: 401 };
    if (user.status === 'blocked') return { error: 'Hesabınız engellendi', status: 403 };
    return { user };
  } catch (err) {
    return { error: 'Geçersiz veya süresi dolmuş token', status: 401 };
  }
}

// Master yetkisi kontrolü
async function requireMaster(req) {
  const result = await verifyToken(req);
  if (result.error) return result;
  if (result.user.role !== 'master') return { error: 'Master yetkisi gerekli', status: 403 };
  return result;
}

module.exports = { signToken, verifyToken, requireMaster };
