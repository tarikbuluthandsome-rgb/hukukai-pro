// ============================================================
// api/telegram-webhook.js — HukukAI Pro Telegram Bot
// ============================================================
// Kurulum: Telegram'a webhook kaydet:
// https://api.telegram.org/bot{TOKEN}/setWebhook?url=https://hukukai.pro/api/telegram-webhook
// ============================================================

const { connectDB } = require('../lib/db');
const User = require('../models/User');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8725385830:AAHrmcgNNpvZApD9wJZMA5v-VMjCOMmCgEs';
const CHAT_ID   = process.env.TELEGRAM_CHAT_ID   || '1575763358';
const API_URL   = `https://api.telegram.org/bot${BOT_TOKEN}`;

// Telegram'a mesaj gönder
async function sendMessage(chatId, text, extra = {}) {
    await fetch(`${API_URL}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...extra })
    });
}

// Komut işleyiciler
const commands = {

    // /start veya /yardim
    async start(chatId) {
        await sendMessage(chatId, `⚖️ <b>HukukAI Pro Admin Bot</b>\n\nKullanılabilir komutlar:\n\n👥 <b>Kullanıcı Yönetimi</b>\n/bekleyenler — Onay bekleyen kayıtlar\n/onayla [kullaniciadi] — Kullanıcı onayla\n/reddet [kullaniciadi] — Kullanıcı reddet\n/kullanicilar — Aktif kullanıcı listesi\n\n📊 <b>İstatistik</b>\n/istatistik — Sistem istatistikleri\n/durum — Sunucu durumu`);
    },

    // /bekleyenler
    async bekleyenler(chatId) {
        await connectDB();
        const pending = await User.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(10);
        if (!pending.length) {
            await sendMessage(chatId, '✅ Onay bekleyen kullanıcı yok.');
            return;
        }
        let msg = `⏳ <b>Onay Bekleyenler (${pending.length})</b>\n\n`;
        pending.forEach((u, i) => {
            const tarih = new Date(u.createdAt).toLocaleDateString('tr-TR');
            msg += `${i+1}. <b>${u.username}</b>\n   📧 ${u.email}\n   👤 ${u.fullName || '-'}\n   📅 ${tarih}\n\n`;
        });
        msg += `Onaylamak için: <code>/onayla [kullaniciadi]</code>`;
        await sendMessage(chatId, msg);
    },

    // /onayla [kullaniciadi]
    async onayla(chatId, args) {
        if (!args) { await sendMessage(chatId, '❌ Kullanım: /onayla [kullaniciadi]'); return; }
        await connectDB();
        const user = await User.findOne({ username: args.trim(), status: 'pending' });
        if (!user) {
            await sendMessage(chatId, `❌ "${args}" kullanıcısı bulunamadı veya zaten onaylı.`);
            return;
        }
        user.status = 'approved';
        user.approvedAt = new Date();
        await user.save();

        await sendMessage(chatId, `✅ <b>${user.username}</b> onaylandı!\n📧 ${user.email}\n👤 ${user.fullName || '-'}`);

        // Kullanıcıya bildirim gönder (e-posta varsa)
        // await sendApprovalEmail(user.email, user.fullName);
    },

    // /reddet [kullaniciadi]
    async reddet(chatId, args) {
        if (!args) { await sendMessage(chatId, '❌ Kullanım: /reddet [kullaniciadi]'); return; }
        await connectDB();
        const user = await User.findOne({ username: args.trim(), status: 'pending' });
        if (!user) {
            await sendMessage(chatId, `❌ "${args}" kullanıcısı bulunamadı.`);
            return;
        }
        user.status = 'rejected';
        await user.save();
        await sendMessage(chatId, `🚫 <b>${user.username}</b> reddedildi.`);
    },

    // /kullanicilar
    async kullanicilar(chatId) {
        await connectDB();
        const users = await User.find({ status: 'approved' }).sort({ createdAt: -1 }).limit(15);
        if (!users.length) { await sendMessage(chatId, 'Henüz onaylı kullanıcı yok.'); return; }
        let msg = `👥 <b>Aktif Kullanıcılar (${users.length})</b>\n\n`;
        users.forEach((u, i) => {
            const tarih = new Date(u.createdAt).toLocaleDateString('tr-TR');
            msg += `${i+1}. <b>${u.username}</b> — ${u.email} (${tarih})\n`;
        });
        await sendMessage(chatId, msg);
    },

    // /istatistik
    async istatistik(chatId) {
        await connectDB();
        const [toplam, onaylı, bekleyen, reddedilen] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ status: 'approved' }),
            User.countDocuments({ status: 'pending' }),
            User.countDocuments({ status: 'rejected' }),
        ]);
        const bugun = new Date(); bugun.setHours(0,0,0,0);
        const bugunKayit = await User.countDocuments({ createdAt: { $gte: bugun } });

        await sendMessage(chatId,
            `📊 <b>HukukAI Pro İstatistikleri</b>\n\n` +
            `👥 Toplam kayıt: <b>${toplam}</b>\n` +
            `✅ Onaylı: <b>${onaylı}</b>\n` +
            `⏳ Bekleyen: <b>${bekleyen}</b>\n` +
            `🚫 Reddedilen: <b>${reddedilen}</b>\n` +
            `📅 Bugün kayıt: <b>${bugunKayit}</b>`
        );
    },

    // /durum
    async durum(chatId) {
        const uptime = Math.floor(process.uptime());
        const mem = process.memoryUsage();
        await sendMessage(chatId,
            `🖥️ <b>Sistem Durumu</b>\n\n` +
            `⚡ Uptime: ${uptime}s\n` +
            `💾 RAM: ${Math.round(mem.rss / 1024 / 1024)}MB\n` +
            `🌐 Node: ${process.version}\n` +
            `✅ Durum: Çalışıyor`
        );
    }
};

module.exports = async (req, res) => {
    // Sadece POST kabul et
    if (req.method !== 'POST') {
        return res.status(200).json({ ok: true, info: 'Telegram Webhook aktif' });
    }

    try {
        const { message } = req.body;
        if (!message || !message.text) return res.status(200).json({ ok: true });

        const chatId = message.chat.id.toString();
        const text   = message.text.trim();

        // Sadece yetkili chat'ten gelen komutları işle
        if (chatId !== CHAT_ID) {
            await sendMessage(chatId, '⛔ Bu bot sadece yetkili kullanıcılara açıktır.');
            return res.status(200).json({ ok: true });
        }

        // Komutu parse et
        const [rawCmd, ...argParts] = text.split(' ');
        const cmd  = rawCmd.replace('/', '').toLowerCase().split('@')[0]; // /onayla@botname → onayla
        const args = argParts.join(' ');

        if (commands[cmd]) {
            await commands[cmd](chatId, args);
        } else {
            await commands.start(chatId);
        }

    } catch (err) {
        console.error('Telegram webhook error:', err);
    }

    res.status(200).json({ ok: true });
};
