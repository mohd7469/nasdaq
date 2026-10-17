import axios from 'axios';
import moment from 'moment';
import config from './config.json' with { type: 'json' };
const { WEBHOOK_SECRET, BOTS_CONFIG } = config;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    //////////////////////////////////////////////////
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    if (host) {
        const baseUrl = `${protocol}://${host}`;
        console.log(`Registering Webhooks..`);
        for (const [botId, config] of Object.entries(BOTS_CONFIG)) {
            if (!config.token) continue;
            try {
                const webhookUrl = `${baseUrl}/api/send?bot=${botId}`;
                await axios.post(`https://api.telegram.org/bot${config.token}/setWebhook`, {
                    url: webhookUrl,
                    secret_token: WEBHOOK_SECRET
                });
                console.log(`${botId}:: ${webhookUrl}`);
            } catch (err) {
                console.error(`Webhook registration failed for ${botId}:`, err.message);
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
}