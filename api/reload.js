import '../logger.js';

import cors from '../cors.js';
import axios from 'axios';
import moment from 'moment';

import * as db from '../mongo/db.js';

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
        console.error(err.stack);
        return res.status(500).json({ success: false, error: err.message });
    }
}

async function handleGet(req, res) {
    const targetBot = req.query?.bot;
    const filter = targetBot ? { botId: targetBot } : {};
    const reloadDoc = await db.consumeTelegramReload(filter);

    return res.status(200).json(Boolean(reloadDoc));
}