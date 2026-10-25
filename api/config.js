import { connectDB, getAppConfig, TelegramBots } from './db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        await connectDB();
        const config = await getAppConfig();
        const bots = await TelegramBots.find({}, 'botId name').lean();

        return res.status(200).json({
            apiUrl: config.apiUrl,
            defaultChatId: config.defaultChatId,
            defaultText: config.defaultText,
            bots: bots.map(b => ({ botId: b.botId, name: b.name }))
        });
    } catch (err) {
        console.error('Config API Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
