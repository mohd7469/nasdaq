import cors from './cors.js';
import axios from 'axios';
import moment from 'moment';

import * as db from '../db/operations.js';

export default async function handler(req, res) {
    if (cors(req, res)) {
        return;
    }

    try {
        const config = await db.getAppConfig();
        const bots = await db.getBotsConfig();

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
