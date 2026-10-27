import cors from './cors.js';
import axios from 'axios';
import moment from 'moment';

import * as db from '../mongo/db.js';

const RELOAD_COMMANDS = new Set(['reload', 'refresh', '/reload', '/refresh']);

export default async function handler(req, res) {
    if (cors(req, res)) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return await handleGet(req, res);
        }

        return await handlePost(req, res);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

async function handleGet(req, res) {
    const targetBot = req.query?.bot;
    const filter = targetBot ? { botId: targetBot } : {};
    const reloadDoc = await db.consumeReloadSignal(filter);

    return res.status(200).json(Boolean(reloadDoc));
}

async function handlePost(req, res) {
    const appConfig = await db.getAppConfig();
    const secretHeader = req.headers['x-telegram-bot-api-secret-token'];

    if (secretHeader && secretHeader !== appConfig.webhookSecret) {
        return res.status(401).json({ success: false, error: 'Unauthorized secret token' });
    }

    const message = req.body?.message;
    if (!message?.text) {
        return res.status(200).json({ success: true, message: 'Ignored, not a text message' });
    }

    const rawText = message.text.trim();
    const cleanText = rawText.toLowerCase();

    if (!RELOAD_COMMANDS.has(cleanText)) {
        return res.status(409).json({
            success: false,
            message: `Text "${rawText}" is not a reload command`
        });
    }

    const botId = req.query?.bot;
    const chatId = String(message.chat.id);
    const userInfo = message.from || {};
    const botsConfig = await db.getBotsConfig();
    const botConfig = botId ? botsConfig.find(b => b.botId === botId) : null;

    if (botId) {
        await db.createOrUpdateUser(botId, chatId, userInfo);
    }

    const reloadPayload = {
        bot: botId || 'unknown',
        botName: botConfig ? botConfig.name : (botId || 'Unknown Bot'),
        command: rawText,
        chatId,
        from: userInfo,
        timestamp: Date.now()
    };

    if (botId) {
        await db.upsertReloadSignal(botId, reloadPayload);
    }

    return res.status(200).json({
        success: true,

        message: 'Reload signal stored successfully'
    });
}