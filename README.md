# Bilimdon 2.0 — Bilim va malaka oshirish platformasi

Mobil ilova uslubidagi (pastki navigatsiyali) ta'lim platformasi: darsliklar, testlar,
DTM, Savolnoma (qo'lda yozilgan javoblarni rasmga olib yuborish), yangiliklar,
reyting, AI maslahat, ustozlar uchun admin panel va **Premium obuna** (Click/Payme).

---

## 1-qadam: Firebase (bepul ma'lumotlar bazasi)

1. https://console.firebase.google.com → **Add project** → nom bering (masalan `bilimdon`).
2. **Build → Firestore Database → Create database** → **Start in test mode**.
3. **Project settings (⚙️) → Your apps → `</>` (Web)** → ilova qo'shing.
4. Ko'rsatilgan `firebaseConfig` qiymatlarini **`firebase-config.js`** fayliga joylashtiring.

### Firestore xavfsizlik qoidalari

Test rejimi 30 kundan keyin yopiladi. **Firestore → Rules**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Eslatma:** parollar hozircha oddiy matn holida saqlanadi (demo/o'quv loyiha darajasida).
Katta miqyosda foydalanish uchun Firebase Authentication'ga o'tish tavsiya etiladi.

---

## 2-qadam: GitHub'ga yuklash

```bash
cd bilimdon-site
git init
git add .
git commit -m "Bilimdon 2.0"
git branch -M main
git remote add origin https://github.com/FOYDALANUVCHI_NOMI/bilimdon.git
git push -u origin main
```

---

## 3-qadam: Vercel'ga deploy

1. https://vercel.com → GitHub bilan kiring → **Add New → Project** → repo tanlang.
2. Framework: **Other**.
3. **Deploy** tugmasini bosing.

---

## 4-qadam: To'lov tizimlarini ulash (Click / Payme)

Bu qadam **ixtiyoriy** — ulamasangiz ham sayt ishlayveradi, faqat "Premium" tugmalari
demo havola ochadi (haqiqiy to'lov o'tmaydi).

### 4.1 Click.uz

1. https://merchant.click.uz da hisob oching (yuridik/jismoniy shaxs sifatida).
2. Yangi xizmat (**Service**) yarating — bu sizga `service_id` va `merchant_id` beradi.
3. **Merchant Cabinet → Settings** dan `SECRET_KEY` oling.
4. `payment-config.js` faylida `merchantId` va `serviceId` ni to'ldiring.
5. Vercel → Settings → Environment Variables:
   - `CLICK_SECRET_KEY` = Click SECRET_KEY
   - `FIREBASE_SERVICE_ACCOUNT_JSON` = Firebase Admin SDK kaliti (pastga qarang)
6. Click Merchant Cabinet'da webhook manzilini kiriting:
   `https://SIZNING-SAYTINGIZ.vercel.app/api/click-webhook`

### 4.2 Payme

1. https://business.payme.uz da hisob oching, kassa (**Merchant**) yarating.
2. `merchant_id` va `Test key` / `Kalit` oling.
3. `payment-config.js` da `payme.merchantId` ni to'ldiring.
4. Vercel Environment Variables:
   - `PAYME_MERCHANT_KEY` = Payme kaliti
5. Payme Merchant Cabinet'da webhook (Callback URL) manzilini kiriting:
   `https://SIZNING-SAYTINGIZ.vercel.app/api/payme-webhook`

### 4.3 Firebase Admin SDK kaliti (webhooklar uchun)

1. Firebase Console → **Project settings → Service accounts**.
2. **Generate new private key** → JSON fayl yuklab olinadi.
3. Uning butun mazmunini **bitta qatorga** aylantirib (masalan https://jsonformatter.org/json-minify
   orqali), Vercel'da `FIREBASE_SERVICE_ACCOUNT_JSON` nomli Environment Variable sifatida saqlang.

**Muhim:** `api/click-webhook.js` va `api/payme-webhook.js` — bu **boshlang'ich skeletlar**.
Ishga tushirishdan oldin:
- Click va Payme'ning rasmiy hujjatlarini albatta o'qing (imzo formulasi vaqt o'tishi bilan
  o'zgarishi mumkin).
- **Sandbox/test rejimida** to'liq sinab ko'ring.
- Xohlasangiz, keyingi suhbatda shu webhooklarni birga sozlab, sinovdan o'tkazishimiz mumkin.

---

## 5-qadam: AI maslahat funksiyasini ulash (Groq — bepul)

1. https://console.groq.com ga kiring (Google hisobi bilan ro'yxatdan o'tish mumkin).
2. Chap menyudan **API Keys → Create API Key** → nom bering → kalitni nusxalang.
3. Vercel → loyihangiz → **Settings → Environment Variables**:
   - Nom: `GROQ_API_KEY`, qiymat: nusxalagan kalitingiz (`gsk_...` bilan boshlanadi).
4. **Deployments** bo'limidan oxirgi deploy'ni oching → **Redeploy** tugmasini bosing
   (Environment Variable qo'shgandan keyin qayta deploy qilmasangiz, o'zgarish kuchga kirmaydi).

Groq bepul limitlari vaqti-vaqti bilan o'zgarib turadi — juda ko'p so'rov yuborilsa,
birozdan keyin qayta urinib ko'rish kerak bo'lishi mumkin. Bu — https://console.groq.com/docs/rate-limits
sahifasida ko'rsatilgan.

---

## Loyiha tuzilishi

```
bilimdon-site/
├── index.html
├── style.css
├── app.js                    — asosiy dastur mantig'i
├── firebase-config.js        — Firebase kalitlari
├── payment-config.js         — Click/Payme kalitlari va tarif rejalari
├── package.json              — firebase-admin (webhooklar uchun)
├── api/
│   ├── ai-advice.js          — AI maslahat (Groq API — bepul)
│   ├── click-webhook.js      — Click to'lov tasdiqlash
│   └── payme-webhook.js      — Payme to'lov tasdiqlash
└── README.md
```

## Funksiyalar (v2.0)

**Bepul fanlar:** Matematika, Ona tili, Tarix
**Premium fanlar (🔒):** Fizika, Kimyo, Biologiya, Ingliz tili, Geografiya, Informatika

- 🏠 **Asosiy** — statistikalar, kalendar, haftaning g'olibi, fanlar
- 📷 **Savolnoma** — qo'lda yozilgan javoblarni rasmga olib yuborish, admin tekshiradi
- 📰 **Yangilik** — e'lonlar va yangiliklar lentasi (admin tomonidan qo'shiladi)
- ⊞ **Ko'proq** — Fanlar, Saralangan, Arxiv, Reyting (bugungi/umumiy), Statistika, Yutuqlarim, AI maslahat, DTM
- 👤 **Profil** — shaxsiy ma'lumotlar, bildirishnomalar, Premium obuna, admin panel (ustozlar uchun)
- ⭐ **Premium** — Click/Payme orqali oylik/choraklik/yillik obuna
- 🛠️ **Admin panel** — darslik, test, DTM, yangilik qo'shish, savolnomalarni tekshirish, statistika

## Keyingi rivojlantirish g'oyalari

- Firebase Authentication bilan xavfsizroq login
- Push-bildirishnoma (haqiqiy, Firebase Cloud Messaging orqali)
- Referal tizimi (do'stni taklif qilish uchun bonus kunlar)
- Sertifikat generatsiya (PDF)
- Ota-ona kuzatuv rejimi
- Og'zaki (ovozli) AI savol-javob
