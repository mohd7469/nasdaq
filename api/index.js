import moment from 'moment';
import { WEBHOOK_SECRET } from './env.js';

// Deployment / Initialization ke waqt webhook auto-register karne ka function
export async function registerWebhooks(req) {
    try {
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        const baseUrl = `${protocol}://${host}`;

        const bots = [
            { type: 'alert', token: ALERT_BOT_TOKEN },
            { type: 'log', token: LOG_BOT_TOKEN }
        ];

        for (const b of bots) {
            const webhookUrl = `${baseUrl}/api/bot?type=${b.type}`;
            console.log(webhookUrl);
            const telegramUrl = `https://api.telegram.org/bot${b.token}/setWebhook`;

            const response = await fetch(telegramUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: webhookUrl,
                    secret_token: WEBHOOK_SECRET
                })
            });

            const result = await response.json();
            console.log(`Webhook set for ${b.type}:`, result);
        }
    } catch (err) {
        console.error("Auto-register webhook error:", err.message);
    }
}

export default async function handler(req, res) {
    // Open CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    await registerWebhooks(req);

    return res.status(200).json({
        status: 'OK',
        uptime: moment.duration(process.uptime(), 'seconds').humanize() + ' ago',
        timestamp: new Date().toISOString()
    });
}