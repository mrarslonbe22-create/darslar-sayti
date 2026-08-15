// Click.uz "Prepare" va "Complete" so'rovlarini qabul qiluvchi webhook.
// Bu — BOSHLANG'ICH SKELET. Ishga tushirishdan oldin Click'ning rasmiy
// hujjatlarini albatta o'qing: https://docs.click.uz
// va sandbox rejimida to'liq test qiling.
//
// Kerakli Environment Variable'lar (Vercel → Settings → Environment Variables):
//   CLICK_SECRET_KEY               — Click Merchant Cabinet'dan
//   FIREBASE_SERVICE_ACCOUNT_JSON  — Firebase Admin SDK service account (JSON, bitta qatorda)

import crypto from 'crypto';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getDb(){
  if(!getApps().length){
    const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    initializeApp({ credential: cert(svc) });
  }
  return getFirestore();
}

const CLICK_ERROR = { SUCCESS:0, SIGN_FAILED:-1, ALREADY_PAID:-4, TRANS_NOT_FOUND:-6, USER_NOT_FOUND:-5 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  const db = getDb();
  const p = req.body;
  const secret = process.env.CLICK_SECRET_KEY;

  try{
    // action: 0 = Prepare, 1 = Complete
    if (String(p.action) === '0') {
      // --- PREPARE ---
      const signString = `${p.click_trans_id}${p.service_id}${secret}${p.merchant_trans_id}${p.amount}${p.action}${p.sign_time}`;
      const sign = crypto.createHash('md5').update(signString).digest('hex');
      if (sign !== p.sign_string) {
        return res.json({ error: CLICK_ERROR.SIGN_FAILED, error_note: 'Sign xato' });
      }
      const paymentSnap = await db.collection('payments').doc(p.merchant_trans_id).get();
      if (!paymentSnap.exists) {
        return res.json({ error: CLICK_ERROR.TRANS_NOT_FOUND, error_note: 'Order topilmadi' });
      }
      return res.json({
        click_trans_id: p.click_trans_id,
        merchant_trans_id: p.merchant_trans_id,
        merchant_prepare_id: p.merchant_trans_id,
        error: CLICK_ERROR.SUCCESS,
        error_note: 'OK'
      });
    }

    if (String(p.action) === '1') {
      // --- COMPLETE ---
      const signString = `${p.click_trans_id}${p.service_id}${secret}${p.merchant_trans_id}${p.merchant_prepare_id}${p.amount}${p.action}${p.sign_time}`;
      const sign = crypto.createHash('md5').update(signString).digest('hex');
      if (sign !== p.sign_string) {
        return res.json({ error: CLICK_ERROR.SIGN_FAILED, error_note: 'Sign xato' });
      }
      const paymentRef = db.collection('payments').doc(p.merchant_trans_id);
      const paymentSnap = await paymentRef.get();
      if (!paymentSnap.exists) {
        return res.json({ error: CLICK_ERROR.TRANS_NOT_FOUND, error_note: 'Order topilmadi' });
      }
      const payment = paymentSnap.data();
      if (payment.status === 'paid') {
        return res.json({ error: CLICK_ERROR.ALREADY_PAID, error_note: 'Allaqachon to\'langan' });
      }
      // To'lovni tasdiqlash va foydalanuvchini Pro qilish
      await paymentRef.update({ status: 'paid', paidAt: Date.now(), clickTransId: p.click_trans_id });
      const proUntil = Date.now() + payment.days * 86400000;
      await db.collection('users').doc(payment.phone).update({ isPro: true, proUntil });

      return res.json({
        click_trans_id: p.click_trans_id,
        merchant_trans_id: p.merchant_trans_id,
        merchant_confirm_id: p.merchant_trans_id,
        error: CLICK_ERROR.SUCCESS,
        error_note: 'OK'
      });
    }

    return res.json({ error: -3, error_note: 'Noma\'lum action' });
  }catch(e){
    console.error(e);
    return res.status(500).json({ error: -8, error_note: 'Server xatosi' });
  }
}
