import moment from 'moment';

export default async function handler(req, res) {
  const uptimeInSeconds = process.uptime();
  const uptime = moment.duration(uptimeInSeconds, 'seconds').humanize() + ' ago';

  // Completely Open CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS, POST');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'POST') {
    const { text, userId, botToken } = req.body || {};

    if (!text || !userId || !botToken) {
      return res.status(400).json({ success: false, error: "Missing: text | userId | botToken" });
    }

    try {
      const msg = `Log: ${text}`;
      const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

      const telegramRes = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: userId,
          text: msg,
          parse_mode: 'HTML'
        })
      });

      const telegramData = await telegramRes.json();
      console.log("Log Response:", telegramData);

      return res.status(200).json({ success: true, result: telegramData });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }

  return res.status(200).json({
    status: "OK",
    uptime: uptime,
    timestamp: new Date().toISOString()
  });
}