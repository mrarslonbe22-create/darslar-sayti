// Click va Payme orqali to'lov qabul qilish uchun sozlamalar.
// Qiymatlarni Click Merchant Cabinet (https://merchant.click.uz) va
// Payme Merchant Cabinet (https://business.payme.uz) dan olasiz.
// Batafsil: README.md dagi "To'lov tizimlarini ulash" bo'limi.

export const paymentConfig = {
  click: {
    merchantId: "YOUR_CLICK_MERCHANT_ID",
    serviceId: "YOUR_CLICK_SERVICE_ID",
    // Click checkout havolasi shu yerga qaytaradi (to'lovdan keyin)
    returnUrl: "https://YOUR_SITE_DOMAIN.vercel.app/premium-success"
  },
  payme: {
    merchantId: "YOUR_PAYME_MERCHANT_ID"
  },
  // Tarif rejalari (narx so'mda)
  plans: [
    { id: "monthly", label: "1 oylik", price: 25000, days: 30 },
    { id: "quarterly", label: "3 oylik", price: 65000, days: 90 },
    { id: "yearly", label: "1 yillik", price: 220000, days: 365 }
  ]
};
