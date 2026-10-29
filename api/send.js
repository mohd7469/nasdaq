import cors from './cors.js';
import axios from 'axios';
import { getTimezone } from '../utils.js';

import * as db from '../mongo/db.js';

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
    const [config, bots] = await Promise.all([
        db.getAppConfig(),
        db.getBotsConfig()
    ]);

    const { text, bot, chatId } = req.query || {};

    if (text !== undefined && text === '') throw new Error('text is missing');
    if (bot !== undefined && bot === '') throw new Error('bot is missing');
    if (chatId !== undefined && chatId === '') throw new Error('chatId is missing');

    const finalMessage = text || config.defaultText;
    const isTyping = Boolean(text && (text.startsWith('...') || text.startsWith('typing')));

    const targetBots = bot ? (Array.isArray(bot) ? bot : [bot]) : bots.map(b => b.botId);
    const targetChatIds = chatId ? (Array.isArray(chatId) ? chatId : [chatId]) : [];

    for (const bId of targetBots) {
        if (!bots.some(b => b.botId === bId)) {
            return res.status(400).json({ success: false, error: `Invalid or missing bot identifier: ${bId}` });
        }
    }

    const filterActiveUsers = await resolveActiveRecipients(targetBots, targetChatIds, bots);

    if (targetChatIds.length > 0 && filterActiveUsers.length === 0) {
        return res.status(404).json({ success: false, error: 'User is not active for given chatId' });
    }

    const results = await dispatchTelegramMessages(filterActiveUsers, finalMessage, isTyping);

    return res.status(200).json({
        success: true,
        action: isTyping ? 'typing' : 'message',
        bot: bot || 'all_bots',
        chatId: chatId || 'all_active_users',
        results
    });
}

async function handlePost(req, res) {
    const [config, bots] = await Promise.all([
        db.getAppConfig(),
        db.getBotsConfig()
    ]);

    const botId = req.query?.bot;
    if (req.body?.message && botId) {
        return await handleTelegramWebhookRequest(req, res, { config, bots, botId });
    }

    const { text, bot, chatId } = req.body || {};

    if (text !== undefined && text === '') throw new Error('text is missing');
    if (bot !== undefined && bot === '') throw new Error('bot is missing');
    if (chatId !== undefined && chatId === '') throw new Error('chatId is missing');

    const finalMessage = text || config.defaultText;
    const isTyping = Boolean(text && (text.startsWith('...') || text.startsWith('typing')));

    const targetBots = bot ? (Array.isArray(bot) ? bot : [bot]) : bots.map(b => b.botId);
    const targetChatIds = chatId ? (Array.isArray(chatId) ? chatId : [chatId]) : [];

    for (const bId of targetBots) {
        if (!bots.some(b => b.botId === bId)) {
            return res.status(400).json({ success: false, error: `Invalid or missing bot identifier: ${bId}` });
        }
    }

    const filterActiveUsers = await resolveActiveRecipients(targetBots, targetChatIds, bots);

    if (targetChatIds.length > 0 && filterActiveUsers.length === 0) {
        return res.status(404).json({ success: false, error: 'User is not active for given chatId' });
    }

    const results = await dispatchTelegramMessages(filterActiveUsers, finalMessage, isTyping);

    return res.status(200).json({
        success: true,
        action: isTyping ? 'typing' : 'message',
        bot: bot || 'all_bots',
        chatId: chatId || 'all_active_users',
        results
    });
}

async function handleTelegramWebhookRequest(req, res, { config, bots, botId }) {
    const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
    if (secretHeader !== config.webhookSecret) {
        return res.status(401).json({ success: false, error: 'Unauthorized secret token' });
    }

    const botConfig = bots.find(b => b.botId === botId);
    if (!botConfig) {
        return res.status(404).json({ success: false, error: 'Bot ID not found in database' });
    }

    const message = req.body.message;
    const chatId = String(message.chat.id);
    const text = message.text || '';
    const userInfo = message.from || {};
    const cleanText = text.trim().toLowerCase();

    if (cleanText.startsWith('/stop')) {
        await db.removeTelegramUser(botId, chatId);
        const responseText = `[${chatId}] Disconnected, send <b>/start</b> to connect again`;
        await sendTelegramMessage(botConfig.token, chatId, responseText);
        const savedChatsCount = await db.countBotTelegramUsers(botId);
        return res.status(200).json({ success: true, savedChatsCount });
    }

    const userRecord = await db.createOrUpdateUser(botId, chatId, userInfo);
    const isActive = Boolean(userRecord?.isActive);

    if (cleanText.startsWith('/start')) {
        const responseText = isActive
            ? `[${chatId}] Connected, send <b>/stop</b> to disconnect`
            : `[${chatId}] Request sent..`;

        await sendTelegramMessage(botConfig.token, chatId, responseText);
        const savedChatsCount = await db.countBotTelegramUsers(botId);
        return res.status(200).json({ success: true, savedChatsCount, userInfo });
    }

    const RELOAD_COMMANDS = new Set(['reload', 'refresh', '/reload', '/refresh']);

    if (RELOAD_COMMANDS.has(cleanText)) {
        const reloadPayload = {
            bot: botId,
            botName: botConfig.name,
            command: cleanText,
            chatId,
            from: userInfo,
            timestamp: Date.now()
        };

        await db.upsertTelegramReload(botId, reloadPayload);

        const responseText = `[${botConfig.name}] Reload signal received: "${text}" from ${chatId}`;
        return res.status(200).json({ success: true, message: responseText, reload: reloadPayload });
    }

    const responseText = isActive
        ? `[${chatId}] Connected, send <b>/stop</b> to disconnect`
        : `[${chatId}] In progress..`;

    await sendTelegramMessage(botConfig.token, chatId, responseText);
    const savedChatsCount = await db.countBotTelegramUsers(botId);

    return res.status(200).json({ success: true, savedChatsCount, userInfo });
}

async function resolveActiveRecipients(targetBots, targetChatIds, bots) {
    const fetchPromises = targetBots.map(async (bId) => {
        const botObj = bots.find(b => b.botId === bId);
        const token = botObj?.token;
        if (!token) return [];

        let users = [];

        if (targetChatIds.length > 0) {
            const results = await Promise.all(
                targetChatIds.map(id => db.getTelegramUser(bId, id, { isActive: true }))
            );
            users = results.filter(Boolean);
        } else {
            users = (await db.getTelegramUsersForBot(bId)) || [];
        }

        return users.map(user => ({ bId, token, chatId: user.chatId }));
    });

    const nestedRecipients = await Promise.all(fetchPromises);
    return nestedRecipients.flat();
}

async function dispatchTelegramMessages(recipients, message, isTyping) {
    const results = {};

    for (const target of recipients) {
        if (!results[target.bId]) {
            results[target.bId] = [];
        }

        if (isTyping) {
            await sendTelegramChatAction(target.token, target.chatId);
            results[target.bId].push({ chatId: target.chatId, action: 'typing' });
        } else {
            const responseText = await sendTelegramMessage(target.token, target.chatId, message);
            results[target.bId].push({ chatId: target.chatId, result: responseText });
        }
    }

    return results;
}

async function sendTelegramMessage(token, chatId, text) {
    try {
        const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text,
            parse_mode: 'HTML'
        });
        return { success: true, data: response.data };
    } catch (err) {
        return { success: false, error: err.response?.data || err.message };
    }
}

async function sendTelegramChatAction(token, chatId, action = 'typing') {
    try {
        await axios.post(`https://api.telegram.org/bot${token}/sendChatAction`, {
            chat_id: chatId,
            action
        });
    } catch (err) {
        return { success: false, error: err.response?.data || `Failed sending ACTION to [${chatId}]: ${err.message}` };
    }
}