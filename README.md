# Bilimdon — Bilim va malaka oshirish platformasi

Bu sayt: darsliklar, fan testlari, DTM testlari, umumiy reyting, AI maslahat va
ustozlar uchun admin panel (test/darslik qo'shish) funksiyalariga ega.

Ma'lumotlar **Firebase Firestore**'da saqlanadi — shuning uchun barcha
foydalanuvchilar (turli qurilma, turli brauzer) bir xil ma'lumotlarni ko'radi.

---

## 1-qadam: Firebase loyihasi yaratish (bepul)

1. https://console.firebase.google.com ga kiring (Google hisobingiz bilan).
2. **"Add project" / "Loyiha qo'shish"** tugmasini bosing, nom bering (masalan `bilimdon`), davom eting.
3. Chap menyudan **Build → Firestore Database** ga o'ting → **Create database**.
   - Rejim: **Start in test mode** ni tanlang (30 kun ochiq bo'ladi, keyin xavfsizlik
     qoidalarini o'zgartirish kerak — pastga qarang).
   - Mintaqa (location): istalgan, masalan `eur3`.
4. Chap menyudan **Project settings (⚙️)** → pastga tushib **"Your apps"** bo'limida
   **`</>` (Web)** belgisini bosing.
5. Ilova nomini kiriting (masalan `bilimdon-web`) → **Register app**.
6. Sizga `firebaseConfig` obyekti ko'rsatiladi — shu qiymatlarni nusxalab,
   loyihadagi **`firebase-config.js`** fayliga joylashtiring:

```js
export const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "bilimdon-xxxx.firebaseapp.com",
  projectId: "bilimdon-xxxx",
  storageBucket: "bilimdon-xxxx.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef"
};
```

### Firestore xavfsizlik qoidalari (rules)

Test rejimi 30 kundan keyin yopiladi. Firestore → **Rules** bo'limiga o'ting va
quyidagini joylashtiring (bu — soddalashtirilgan, hammaga o'qish/yozishga ruxsat
beruvchi qoida; jiddiy loyiha uchun buni Firebase Authentication bilan
qattiqlashtirish tavsiya etiladi):

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

**Muhim:** parollar hozircha oddiy matn (plain text) holida Firestore'da
saqlanadi — bu faqat o'quv/demo loyiha uchun mos. Haqiqiy, ommaviy foydalanuvchilar
uchun **Firebase Authentication** (Email/Parol yoki Telefon orqali) ga o'tish tavsiya
etiladi.

---

## 2-qadam: GitHub'ga yuklash

```bash
cd bilimdon-site
git init
git add .
git commit -m "Bilimdon platformasi"
git branch -M main
git remote add origin https://github.com/FOYDALANUVCHI_NOMI/bilimdon.git
git push -u origin main
```

(Avval GitHub'da bo'sh repository yarating: https://github.com/new)

---

## 3-qadam: Vercel'ga ulash

1. https://vercel.com ga GitHub hisobingiz bilan kiring.
2. **Add New → Project** → GitHub repository'ngizni tanlang (`bilimdon`).
3. Framework: **Other** (build sozlamalari kerak emas, static sayt).
4. **AI maslahat** funksiyasi ishlashi uchun (ixtiyoriy):
   - **Settings → Environment Variables** ga o'ting.
   - Nom: `ANTHROPIC_API_KEY`, qiymat: Anthropic Console'dan olingan API kalitingiz
     (https://console.anthropic.com).
   - Bu kalit brauzerga hech qachon chiqmaydi — faqat `api/ai-advice.js`
     serverless funksiyasi ichida ishlatiladi.
5. **Deploy** tugmasini bosing. Bir necha soniyadan so'ng sayt tayyor bo'ladi
   (masalan `https://bilimdon.vercel.app`).

Har safar GitHub'ga yangi commit yuborganingizda, Vercel avtomatik qayta
deploy qiladi.

---

## Sayt tuzilishi

```
bilimdon-site/
├── index.html          — asosiy sahifa
├── style.css            — barcha dizayn
├── app.js               — sayt mantig'i (Firebase bilan)
├── firebase-config.js   — Firebase kalitlaringiz (o'zingiz to'ldirasiz)
├── api/
│   └── ai-advice.js     — AI maslahat uchun Vercel serverless funksiya
└── README.md            — shu fayl
```

## Funksiyalar

- **Ro'yxatdan o'tish / Kirish** — ism, familiya, telefon, parol, rol (o'quvchi/ustoz)
- **Darsliklar** — fan bo'yicha, matn + video havola (YouTube) + rasm havolasi
- **Fan testlari** — 3 ta javobli savollar, qiyinlik darajasi (oson/o'rta/qiyin), taymer
- **DTM testlari** — 45 daqiqalik umumiy testlar
- **Umumiy reyting** — barcha foydalanuvchilar natijalari bo'yicha
- **AI maslahat** — foydalanuvchi natijalariga qarab shaxsiy tavsiya (Claude API orqali)
- **Admin panel** (faqat "ustoz" roli) — darslik/test qo'shish, testlar statistikasi
- **Yutuq nishonlari (badge)** — faollik va natijalarga qarab avtomatik beriladi

## Keyingi rivojlantirish g'oyalari

- Firebase Authentication bilan xavfsizroq login (parolni hash'lamasdan saqlash — hozirgi kamchilik)
- Savol banki: bir xil testni tasodifiy tartibda ko'rsatish
- Har bir savol bo'yicha statistika (qaysi savolda ko'proq xato qilishadi)
- Push-bildirishnomalar (yangi test qo'shilganda)
- O'quvchi profilida progress grafigi (vaqt bo'yicha natijalar o'sishi)
- Ustoz o'quvchilarga alohida vazifa biriktirishi (guruhlar)
