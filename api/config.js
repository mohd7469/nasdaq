import cors from './cors.js';

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
    const [config, bots] = await Promise.all([
        db.getAppConfig(),
        db.getBotsConfig()
    ]);

    return res.status(200).json({
        success: true,
        apiUrl: config.apiUrl,
        defaultChatId: config.defaultChatId,
        defaultText: config.defaultText,
        bots: bots.map(({ botId, name }) => ({ botId, name }))
    });
}