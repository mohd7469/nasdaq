import axios from 'axios';
import moment from 'moment';
import { connectDB, getAppConfig, getBotsConfig } from './db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        await connectDB();
        const appConfig = await getAppConfig();
        const botsConfig = await getBotsConfig();

        //////////////////////////////////////////////////
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const protocol = req.headers['x-forwarded-proto'] || 'https';
        if (host) {
            const baseUrl = `${protocol}://${host}`;
            console.log(`Registering Webhooks..`);
            for (const bot of botsConfig) {
                if (!bot.token) continue;
                try {
                    const webhookUrl = `${baseUrl}/api/send?bot=${bot.botId}`;
                    await axios.post(`https://api.telegram.org/bot${bot.token}/setWebhook`, {
                        url: webhookUrl,
                        secret_token: appConfig.webhookSecret
                    });
                    console.log(`${bot.botId}:: ${webhookUrl}`);
                } catch (err) {
                    console.error(`Webhook registration failed for ${bot.botId}:`, err.message);
                }
            }
        }
        //////////////////////////////////////////////////

        return res.status(200).json({
            status: 'OK',
            message: 'Serverless webhooks running',
            uptime: moment.duration(process.uptime(), 'seconds').humanize() + ' ago',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        console.error('Index API Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}