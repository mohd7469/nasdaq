import cors from './cors.js';
import axios from 'axios';
import moment from 'moment';

import {
    connectDB,
    getAppConfig,
    getBotsConfig
} from '../db/operations.js';

export default async function handler(req, res) {
    if (cors(req, res)) {
        return;
    }

    try {
        await connectDB();
        const appConfig = await getAppConfig();
        const botsConfig = await getBotsConfig();

        await registerWebhooks(req, appConfig, botsConfig);

        return res.status(200).json({
            success: true,
            status: 'OK',
            message: 'Serverless webhooks running',
            uptime: `${moment.duration(process.uptime(), 'seconds').humanize()} ago`,
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

async function registerWebhooks(req, appConfig, botsConfig) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    if (!host) return;

    const protocol = req.headers['x-forwarded-proto'] || 'https';
    const baseUrl = `${protocol}://${host}`;

    const registrations = botsConfig
        .filter(bot => bot?.token)
        .map(async (bot) => {
            try {
                const webhookUrl = `${baseUrl}/api/send?bot=${bot.botId}`;
                await axios.post(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
                    url: webhookUrl,
                    secret_token: appConfig.webhookSecret
                });
            } catch (err) {
                console.error(`Webhook registration failed for ${bot.botId}:`, err.message);
            }
        });

    await Promise.all(registrations);
}