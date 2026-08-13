// Vercel Serverless Function
// Bu fayl Anthropic API kalitini brauzerdan yashirin holda saqlaydi.
// Ishlashi uchun Vercel loyihangizga ANTHROPIC_API_KEY nomli Environment Variable qo'shing
// (Vercel dashboard → Settings → Environment Variables).

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Faqat POST so\'rovlar qabul qilinadi' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY sozlanmagan. Vercel Environment Variables bo\'limiga qarang.' });
  }

  try {
    const { firstName, lastName, resultsSummary, question } = req.body;

    const prompt = `Sen ta'lim platformasidagi mehribon va samarali AI o'qituvchi-maslahatchisan. Foydalanuvchi: ${firstName} ${lastName}.
Uning test natijalari: ${resultsSummary}.
Foydalanuvchining savoli: "${question || "Aniq savol yo'q — umumiy natijalarim asosida menga qaysi fanlarga ko'proq e'tibor qaratishim kerakligini va qanday o'qishni maslahat ber."}"
O'zbek tilida, iliq va qisqa (150-220 so'z), amaliy tavsiyalar bilan javob ber. Ro'yxat va aniq qadamlardan foydalan.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({ error: 'Anthropic API xatosi: ' + errText });
    }

    const data = await response.json();
    const text = (data.content || []).map(c => c.text || '').join('\n').trim();
    return res.status(200).json({ text: text || "Kechirasiz, javob olinmadi." });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
