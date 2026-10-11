import axios from 'axios';
import moment from 'moment';
import { WEBHOOK_SECRET, BOTS_CONFIG } from './env.js';

// Deployment / Initialization ke waqt webhook auto-register karne ka function
export async function registerWebhooks(req) {
    console.log(`Registering webhook..`);
    try {
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';

        if (!host) return;

        const baseUrl = `${protocol}://${host}`;

        for (const [botId, config] of Object.entries(BOTS_CONFIG)) {
            if (!config.token || config.token.includes('HERE')) continue;

            // Har bot ka webhook URL uske specific ?bot=botId ke sath register hoga
            const webhookUrl = `${baseUrl}/api/send?bot=${botId}`;
            console.log(webhookUrl);

            await axios.post(`https://api.telegram.org/bot${config.token}/setWebhook`, {
                url: webhookUrl,
                secret_token: WEBHOOK_SECRET
            });
            console.log(`Register Webhook:: ${botId}: ${webhookUrl}`);
        }
    } catch (err) {
        console.error("Register Webhook Error:", err.message);
    }
}

export default async function handler(req, res) {
    // Open CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Background mein webhooks register karwa dein taaki request slow na ho
    registerWebhooks(req).catch(() => { });

    return res.status(200).json({
        status: 'OK',
        message: 'Serverless webhooks running',
        uptime: moment.duration(process.uptime(), 'seconds').humanize() + ' ago',
        timestamp: new Date().toISOString()
    });
}