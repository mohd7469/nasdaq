import axios from 'axios';
import config from './config.json' with { type: 'json' };
const { WEBHOOK_SECRET, BOTS_CONFIG } = config;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    try {
        const ticker = "MNQZ2026"
        const { qty, side, action, tp, sl } = req.body;
        const tradeType = `${side.toUpperCase()}_${action.toUpperCase()}`;

        switch (tradeType) {
            case 'LONG_ENTRY':
                console.log(`${ticker}: Long Opened`);
                break;

            case 'LONG_EXIT':
                console.log(`${ticker}: Long Closed`);
                break;

            case 'SHORT_ENTRY':
                console.log(`${ticker}: Short Opened`);
                break;

            case 'SHORT_EXIT':
                console.log(`${ticker}: Short Closed`);
                break;

            default:
                return res.status(400).json({ success: false, message: 'Invalid Action Type' });
        }

        return res.status(200).json({
            status: 'OK',
            success: true,
            message: `${ticker}: ${qty} ${side} futures contract ${action.toUpperCase() === 'ENTRY' ? 'opened' : 'closed'} at ${new Date().toISOString()}`
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}