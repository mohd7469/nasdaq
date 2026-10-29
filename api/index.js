import cors from './cors.js';
import axios from 'axios';
import { getTimezone } from './utils.js';

import * as db from './mongo/db.js';

export default async function handler(req, res) {
    if (cors(req, res)) {
        return;
    }

    try {
        if (req.method !== 'GET') {
            return res.status(405).json({ success: false, error: 'Method Not Allowed' });
        }

        return await handleGet(req, res);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

async function handleGet(req, res) {
    const [config, bots] = await Promise.all([
        db.getAppConfig(),
        db.getBotsConfig()
    ]);

    await registerWebhooks(req, config, bots);

    return res.status(200).json({
        success: true,
        message: 'Serverless webhook running..',
        uptime: `${getTimezone().duration(process.uptime(), 'seconds').humanize()} ago`,
        timestamp: new Date().toISOString()
    });

}

async function registerWebhooks(req, config, bots) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (!host) return;

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${protocol}://${host}`;

    const registrations = bots
        .filter(bot => bot?.token)
        .map(async (bot) => {
            try {
                const webhookUrl = `${baseUrl}/api/send?bot=${bot.botId}`;
                await axios.post(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
                    url: webhookUrl,
                    secret_token: config.webhookSecret
                });
            } catch (err) {
                console.error(`Webhook registration failed for ${bot.botId}:`, err.message);
            }
        });

    await Promise.all(registrations);
}