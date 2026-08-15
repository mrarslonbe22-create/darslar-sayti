// Vercel Serverless Function — AI maslahat (Groq orqali, bepul va tez).
// Ishlashi uchun Vercel loyihangizga GROQ_API_KEY nomli Environment Variable qo'shing.
// Kalitni https://console.groq.com/keys dan bepul olasiz.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Faqat POST so\'rovlar qabul qilinadi' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GROQ_API_KEY sozlanmagan. Vercel Environment Variables bo\'limiga qarang.' });
  }

  try {
    const { firstName, lastName, resultsSummary, question } = req.body;

    const prompt = `Sen ta'lim platformasidagi mehribon va samarali AI o'qituvchi-maslahatchisan. Foydalanuvchi: ${firstName} ${lastName}.
Uning test natijalari: ${resultsSummary}.
Foydalanuvchining savoli: "${question || "Aniq savol yo'q — umumiy natijalarim asosida menga qaysi fanlarga ko'proq e'tibor qaratishim kerakligini va qanday o'qishni maslahat ber."}"
O'zbek tilida, iliq va qisqa (150-220 so'z), amaliy tavsiyalar bilan javob ber. Ro'yxat va aniq qadamlardan foydalan.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'Groq API xatosi: ' + errText });
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    return res.status(200).json({ text: text || "Kechirasiz, javob olinmadi." });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
