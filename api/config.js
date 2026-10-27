import cors from './cors.js';
import axios from 'axios';
import moment from 'moment';

import * as db from '../db/operations.js';

export default async function handler(req, res) {
    if (cors(req, res)) {
        return;
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, error: 'Method not allowed' });
    }

    try {
        await db.connect();
        const config = await db.getAppConfig();
        const bots = await db.TelegramBots.find({}, 'botId name').lean();

        return res.status(200).json({
            success: true,
            apiUrl: config.apiUrl,
            defaultChatId: config.defaultChatId,
            defaultText: config.defaultText,
            bots: bots.map(({ botId, name }) => ({ botId, name }))
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
