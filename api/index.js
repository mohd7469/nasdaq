import moment from 'moment';
import { Api } from 'node-telegram-bot-api';

const USER_ID = '7670215141';
const alertBot = new Api('8721637113:AAE6LY0BgBIYtcsqdo29I2nyp0e63PnTmzo');
const logBot = new Api('8916407832:AAHjG7jtmP4_gdhPgsaika8P0yGMmKZb-I4');

export async function sendAlert(text = 'Test Alert') {
    return alertBot.sendMessage({ chat_id: USER_ID, text: String(text), parse_mode: 'HTML' });
}

export async function sendLog(text = 'Test Log') {
    return logBot.sendMessage({ chat_id: USER_ID, text: String(text), parse_mode: 'HTML' });
}

export default async function handler(req, res) {
    // Open CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    switch (req.method) {
        case 'OPTIONS':
            return res.status(200).end();

        case 'POST': {
            const type = req?.body?.type?.trim();
            const text = req?.body?.text?.trim();

            try {
                switch (type) {
                    case 'log': await sendLog(text); break;
                    case 'alert': await sendAlert(text); break;
                    default: await sendAlert(text); await sendLog(text);
                }
            } catch (err) {
                console.error(`${type} Error:`, err.message);
                return res.status(500).json({ success: false, type, error: err.message });
            }

            return res.status(200).json({
                status: 'OK',
                uptime: moment.duration(process.uptime(), 'seconds').humanize() + ' ago',
                timestamp: new Date().toISOString()
            });
        }

        case 'GET': {
            const type = req?.query?.type?.trim();
            const text = req?.query?.text?.trim();

            try {
                switch (type) {
                    case 'log': await sendLog(text); break;
                    case 'alert': await sendAlert(text); break;
                    default: await sendAlert(text); await sendLog(text);
                }
            } catch (err) {
                console.error(`${type} Error:`, err.message);
                return res.status(500).json({ success: false, type, error: err.message });
            }

            return res.status(200).json({
                status: 'OK',
                uptime: moment.duration(process.uptime(), 'seconds').humanize() + ' ago',
                timestamp: new Date().toISOString()
            });
        }

        default:
            return res.status(405).json({ error: 'Method Not Allowed' });
    }
}