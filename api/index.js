import moment from 'moment';
import { WEBHOOK_SECRET } from './env.js';

// Deployment / Initialization ke waqt webhook auto-register karne ka function
export async function registerWebhooks(req) {
    try {
        
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