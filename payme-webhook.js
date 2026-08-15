// Payme (Paycom) JSON-RPC webhook skeleti.
// Bu — BOSHLANG'ICH SKELET. To'liq holat-mashinasi (state machine) va
// xatolik kodlari uchun rasmiy hujjatni albatta o'qing:
// https://developer.help.paycom.uz
// va sandbox rejimida to'liq test qiling.
//
// Kerakli Environment Variable'lar:
//   PAYME_MERCHANT_KEY              — Payme Merchant Cabinet'dan
//   FIREBASE_SERVICE_ACCOUNT_JSON   — Firebase Admin SDK service account (JSON)

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

function getDb(){
  if(!getApps().length){
    const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    initializeApp({ credential: cert(svc) });
  }
  return getFirestore();
}

const PAYME_ERRORS = {
  TRANS_NOT_FOUND: { code: -31003, message: 'Transaction not found' },
  ORDER_NOT_FOUND: { code: -31050, message: 'Order not found' },
  INVALID_AMOUNT: { code: -31001, message: 'Invalid amount' },
  CANT_DO: { code: -31008, message: "Can't perform operation" }
};

function checkAuth(req){
  const auth = req.headers['authorization'] || '';
  const expected = 'Basic ' + Buffer.from('Paycom:' + process.env.PAYME_MERCHANT_KEY).toString('base64');
  return auth === expected;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!checkAuth(req)) {
    return res.json({ error: { code: -32504, message: 'Ruxsat yo\'q' } });
  }
  const db = getDb();
  const { method, params, id } = req.body;

  try{
    if (method === 'CheckPerformTransaction') {
      const orderId = params.account.order_id;
      const paySnap = await db.collection('payments').doc(orderId).get();
      if (!paySnap.exists) return res.json({ id, error: PAYME_ERRORS.ORDER_NOT_FOUND });
      const payment = paySnap.data();
      if (payment.amount * 100 !== params.amount) return res.json({ id, error: PAYME_ERRORS.INVALID_AMOUNT });
      return res.json({ id, result: { allow: true } });
    }

    if (method === 'CreateTransaction') {
      const orderId = params.account.order_id;
      const paySnap = await db.collection('payments').doc(orderId).get();
      if (!paySnap.exists) return res.json({ id, error: PAYME_ERRORS.ORDER_NOT_FOUND });
      await db.collection('payments').doc(orderId).update({
        paymeTransId: params.id, status: 'processing'
      });
      return res.json({ id, result: { create_time: Date.now(), transaction: params.id, state: 1 } });
    }

    if (method === 'PerformTransaction') {
      const paymentsSnap = await db.collection('payments').where('paymeTransId','==',params.id).get();
      if (paymentsSnap.empty) return res.json({ id, error: PAYME_ERRORS.TRANS_NOT_FOUND });
      const doc = paymentsSnap.docs[0];
      const payment = doc.data();
      if (payment.status !== 'paid') {
        const proUntil = Date.now() + payment.days * 86400000;
        await doc.ref.update({ status: 'paid', paidAt: Date.now() });
        await db.collection('users').doc(payment.phone).update({ isPro: true, proUntil });
      }
      return res.json({ id, result: { transaction: params.id, perform_time: Date.now(), state: 2 } });
    }

    if (method === 'CheckTransaction') {
      const paymentsSnap = await db.collection('payments').where('paymeTransId','==',params.id).get();
      if (paymentsSnap.empty) return res.json({ id, error: PAYME_ERRORS.TRANS_NOT_FOUND });
      const payment = paymentsSnap.docs[0].data();
      return res.json({ id, result: {
        create_time: payment.createdAt, perform_time: payment.paidAt || 0, cancel_time: 0,
        transaction: params.id, state: payment.status==='paid'? 2 : 1, reason: null
      }});
    }

    if (method === 'CancelTransaction') {
      const paymentsSnap = await db.collection('payments').where('paymeTransId','==',params.id).get();
      if (paymentsSnap.empty) return res.json({ id, error: PAYME_ERRORS.TRANS_NOT_FOUND });
      const doc = paymentsSnap.docs[0];
      await doc.ref.update({ status: 'cancelled', cancelledAt: Date.now() });
      return res.json({ id, result: { transaction: params.id, cancel_time: Date.now(), state: -1 } });
    }

    return res.json({ id, error: PAYME_ERRORS.CANT_DO });
  }catch(e){
    console.error(e);
    return res.json({ id, error: { code: -32400, message: 'Server xatosi' } });
  }
}
