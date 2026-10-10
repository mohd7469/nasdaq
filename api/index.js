import moment from 'moment';
import { sendAlert, sendLog } from './bot.js';

export default async function handler(req, res) {
    // Open CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    let type;
    let text;

    try {

        switch (req.method) {
            case 'OPTIONS':
                return res.status(200).end();
            case 'POST':
                type = req?.body?.type;
                text = req?.body?.text;
                break;
            case 'GET':
                type = req?.query?.type;
                text = req?.query?.text;
                break;
        }

        if (text !== undefined && text === '') {
            console.error("text is empty");
            throw new Error("text is empty");
        }

        if (type !== undefined && type === '') {
            console.error("type is empty");
            throw new Error("type is empty");
        }

        switch (type) {
            case 'alert':
                await sendAlert(text);
                break;
            case 'log':
                await sendLog(text);
                break;
            default:
                await sendAlert(text);
                await sendLog(text);
        }

    } catch (err) {
        console.error(`${type} Error:`, err.message);
        return res.status(500).json({ error: err.message });
    }

    return res.status(200).json({
        status: 'OK',
        uptime: moment.duration(process.uptime(), 'seconds').humanize() + ' ago',
        timestamp: new Date().toISOString()
    });
}