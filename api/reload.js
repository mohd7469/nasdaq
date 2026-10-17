import { kv as db } from '@vercel/kv';
import config from './config.json' with { type: 'json' };

const { BOTS_CONFIG, WEBHOOK_SECRET } = config;

export default async function handler(req, res) {
    // CORS headers taake browser/test.js se fetch block na ho
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // =====================================================================
        // 1. CLIENT CHECK (GET): https://app-nasdaq.vercel.app/api/reload
        // =====================================================================
        if (req.method === 'GET') {
            const targetBot = req.query?.bot || 'dxblog_bot';
            const dbKey = `bot:${targetBot}:reload`;
            const isReload = await db.get(dbKey);

            if (isReload) {
                await db.del(dbKey); // Flag consume ho gaya, agli dafa false aayega
                return res.status(200).json(true);
            }

            return res.status(200).json(false);
        }

        // =====================================================================
        // 2. TELEGRAM WEBHOOK (POST): Telegram bot se user message aane par
        // =====================================================================
        if (req.method === 'POST') {
            const botId = req.query?.bot;
            const secretHeader = req.headers['x-telegram-bot-api-secret-token'];

            // Optional secret token verification
            if (secretHeader && secretHeader !== WEBHOOK_SECRET) {
                return res.status(401).json({ error: 'Unauthorized secret token' });
            }

            const message = req.body?.message;
            if (!message || !message.text) {
                return res.status(200).json({ status: 'Ignored, not a text message' });
            }

            const rawText = message.text.trim();
            const cleanText = rawText.toLowerCase();
            const chatId = String(message.chat.id);
            const botConfig = botId ? BOTS_CONFIG[botId] : null;

            // Target commands: reload, refresh, /reload, /refresh
            const reloadCommands = ['reload', 'refresh', '/reload', '/refresh'];

            if (reloadCommands.includes(cleanText)) {
                const reloadPayload = {
                    bot: botId || 'unknown',
                    botName: botConfig ? botConfig.name : (botId || 'Unknown Bot'),
                    command: rawText,
                    chatId: chatId,
                    timestamp: Date.now()
                };

                // KV Database mein reload trigger save karein
                if (botId) {
                    await db.set(`bot:${botId}:reload`, reloadPayload);
                }

                console.log(`[Reload] Triggered by ${botId} (${rawText}) from chat ${chatId}`);

                return res.status(200).json({
                    status: 'OK',
                    message: 'Reload signal stored successfully in KV'
                });
            }

            return res.status(200).json({
                status: 'Ignored',
                message: `Text "${rawText}" is not a reload command`
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('Reload API Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}
