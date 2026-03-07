# HukukAI Pro — Tam Deployment Rehberi
## Namecheap + MongoDB Atlas + Vercel

---

## 1. MONGODB ATLAS KURULUMU (5 dakika)

1. **https://cloud.mongodb.com** → ücretsiz hesap
2. **Create Project** → "hukukai"
3. **Create Cluster** → M0 FREE (512MB yeterli)
4. **Database Access** → Add Database User
   - Username: `hukukai_admin`
   - Password: güçlü şifre (kaydedin!)
   - Role: `Atlas Admin`
5. **Network Access** → Add IP Address → `0.0.0.0/0` (Allow from anywhere)
6. **Connect** → Drivers → Node.js → connection string kopyalayın:
   ```
   mongodb+srv://hukukai_admin:SIFRE@cluster0.xxxxx.mongodb.net/hukukai?retryWrites=true&w=majority
   ```

---

## 2. VERCEL KURULUMU (3 dakika)

### A) GitHub'a push
```bash
cd hukukai-app
git init
git add .
git commit -m "HukukAI Pro v1.0"
git remote add origin https://github.com/KULLANICI/hukukai-pro.git
git push -u origin main
```

### B) Vercel'de import
1. **https://vercel.com** → New Project → Import dari GitHub
2. `hukukai-pro` repo'yu seçin
3. **Framework Preset**: Other
4. **Root Directory**: `./` (hukukai-app klasörü değil, root)

### C) Environment Variables (ÇOK ÖNEMLİ)
Vercel Dashboard → Settings → Environment Variables:

| Key | Value |
|-----|-------|
| `MONGODB_URI` | mongodb+srv://... (Atlas'tan kopyaladığınız) |
| `JWT_SECRET` | En az 64 karakter rastgele string |
| `MASTER_KEY` | At.630109 (veya değiştirin) |
| `MASTER_JWT` | Ta630109 (veya değiştirin) |
| `EMAIL_USER` | Gmail adresiniz (opsiyonel) |
| `EMAIL_PASS` | Gmail App Password (opsiyonel) |

**JWT Secret oluşturmak için:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### D) Deploy
```bash
vercel --prod
```
veya Vercel dashboard'dan otomatik deploy.

---

## 3. NAMECHEAP DOMAIN BAĞLAMA (5 dakika)

1. Vercel'de: Settings → Domains → Add Domain → `hukukai.com.tr`
2. Vercel size DNS kayıtlarını verecek (A veya CNAME)
3. Namecheap → Domain List → Manage → Advanced DNS:
   - **A Record**: `@` → Vercel IP
   - **CNAME**: `www` → `cname.vercel-dns.com`
4. SSL otomatik aktif olacak (Let's Encrypt)

---

## 4. İLK MASTER KULLANICI OLUŞTURMA

Deployment sonrası MongoDB'ye ilk master kullanıcıyı seed edin:

```bash
# MongoDB Atlas Shell veya Compass ile:
db.users.insertOne({
  username: "admin",
  email: "admin@hukukai.com.tr",
  password: "$2a$12$...", # bcrypt hash - aşağıdaki script ile oluşturun
  fullName: "Master Admin",
  role: "master",
  status: "active",
  createdAt: new Date()
})
```

**bcrypt hash oluşturma:**
```bash
node -e "const b=require('bcryptjs'); b.hash('SIFRENIZ',12).then(h=>console.log(h))"
```

---

## 5. GOOGLE ARAMA LOGOSU (SEO)

Site logonuzun Google aramalarında görünmesi için:

### A) `public/` klasörüne ekleyin:
- `logo.png` (512x512, PNG)
- `logo-192.png` (192x192, PWA)
- `favicon.ico`

### B) HTML `<head>`'e ekleyin (zaten eklendi):
```html
<meta property="og:image" content="https://hukukai.com.tr/logo.png">
<link rel="icon" href="/favicon.ico">
```

### C) Google Search Console:
1. https://search.google.com/search-console
2. Sitenizi ekleyin → DNS doğrulama
3. Sitemap gönderin: `https://hukukai.com.tr/sitemap.xml`

### D) Logoyu kodla sync tutun:
Master panelinden logo değiştirildiğinde `/api/config` endpoint'ine kaydediliyor.
Gerçek web aramasında logo için **statik bir dosya** gerekli.
Logonuzu `public/logo.png` olarak da kaydedin ve `og:image`'ı bu URL'e işaret ettirin.

---

## 6. PROJE DOSYA YAPISI

```
hukukai-app/
├── api/
│   ├── auth.js        # Giriş/kayıt/token
│   ├── users.js       # Kullanıcı yönetimi
│   ├── dilekce.js     # Dilekçe CRUD
│   └── config.js      # Site ayarları
├── lib/
│   └── db.js          # MongoDB bağlantısı
├── middleware/
│   └── auth.js        # JWT doğrulama
├── models/
│   ├── User.js        # Kullanıcı modeli
│   └── Dilekce.js     # Dilekçe + ActivityLog modeli
├── public/
│   ├── index.html     # Ana uygulama (hukukai.html → buraya kopyalanacak)
│   ├── logo.png       # Site logosu
│   └── favicon.ico
├── .env.example       # Örnek environment variables
├── vercel.json        # Vercel routing config
└── package.json
```

---

## 7. KURULUM SONRASI KONTROL LİSTESİ

- [ ] MongoDB Atlas cluster aktif
- [ ] Vercel'de tüm env variables eklendi
- [ ] Domain Vercel'e bağlandı (SSL aktif)
- [ ] API endpoints çalışıyor: `https://domain.com/api/auth?action=me`
- [ ] Master giriş çalışıyor
- [ ] Kullanıcı kaydı ve admin onayı çalışıyor
- [ ] Dilekçe kayıt ve listeleme çalışıyor
- [ ] Logo yükleme ve favicon güncelleme çalışıyor
- [ ] Google Search Console'a site eklendi

---

## 8. SONRAKI ADIMLAR (Opsiyonel)

### E-posta Bildirimleri (Gmail ile):
- Kayıt onayı: Kullanıcıya "hesabınız onaylandı" maili
- Master'a: "Yeni kayıt talebi var"
- Gmail App Password: Google Account → Security → 2FA → App Passwords

### Ödeme Entegrasyonu (İyzico):
- TR'de en yaygın: iyzico.com
- Sandbox API key ücretsiz
- Ödeme sonrası `user.plan = 'monthly'` ve `user.planExpiry` set edilir

### PWA (Mobil Uygulama):
```json
// public/manifest.json
{
  "name": "HukukAI Pro",
  "short_name": "HukukAI",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#050814",
  "theme_color": "#dc2626",
  "icons": [{"src":"/logo-192.png","sizes":"192x192"},{"src":"/logo-512.png","sizes":"512x512"}]
}
```

---

## HIZLI KOMUTLAR

```bash
# Local test
npm install
node -e "require('dotenv').config(); require('./lib/db')()" # DB bağlantı test
node server.js

# Vercel deploy
vercel --prod

# MongoDB'deki kullanıcıları gör (Atlas Compass ile)
# Collection: users
# Index: username, email (unique)
```
