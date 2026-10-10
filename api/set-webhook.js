import TelegramBot from 'node-telegram-bot-api';
import { ALERT_BOT_TOKEN, LOG_BOT_TOKEN, WEBHOOK_SECRET } from '../env.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { type } = req.query;

    if (!type || (type !== 'alert' && type !== 'log')) {
        return res.status(400).json({ error: 'Invalid or missing type e.g: ?type=alert|log' });
    }

    const token = type === 'alert' ? ALERT_BOT_TOKEN : LOG_BOT_TOKEN;

    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const webhookUrl = `${protocol}://${host}/api/bot?type=${type}`;

    try {
        const bot = new TelegramBot(token, { polling: false });

        // node-telegram-bot-api ka official setWebHook method
        const result = await bot.setWebHook(webhookUrl, {
            secret_token: WEBHOOK_SECRET
        });

        return res.status(200).json({
            success: true,
            botType: type,
            webhookUrl: webhookUrl,
            telegramResponse: result
        });

    } catch (err) {
        console.error('Webhook set error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}