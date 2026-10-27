import cors from './cors.js';
import axios from 'axios';
import moment from 'moment';

import * as db from '../db/operations.js';

const RELOAD_COMMANDS = new Set(['reload', 'refresh', '/reload', '/refresh']);

export default async function handler(req, res) {
    if (cors(req, res)) {
        return;
    }

    try {
        const appConfig = await db.getAppConfig();
        const botsConfig = await db.getBotsConfig();

        const botId = req.query?.bot;
        if (req.method === 'POST' && req.body?.message && botId) {
            return await handleTelegramWebhook(req, res, { appConfig, botsConfig, botId });
        }

        return await handleClientDispatch(req, res, { appConfig, botsConfig });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

async function handleTelegramWebhook(req, res, { appConfig, botsConfig, botId }) {
    const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
    if (secretHeader !== appConfig.webhookSecret) {
        return res.status(401).json({ success: false, error: 'Unauthorized secret token' });
    }

    const botConfig = botsConfig.find(b => b.botId === botId);
    if (!botConfig) {
        return res.status(404).json({ success: false, error: 'Bot ID not found in database' });
    }

    const message = req.body.message;
    const chatId = String(message.chat.id);
    const text = message.text || '';
    const userInfo = message.from || {};
    const cleanText = text.trim().toLowerCase();

    if (cleanText.startsWith('/start')) {
        const userRecord = await db.createOrUpdateUser(botId, chatId, userInfo);
        const isActive = Boolean(userRecord?.isActive);
        const responseText = isActive
            ? `[${chatId}] Connected, send <b>/stop</b> to disconnect`
            : `[${chatId}] Request sent..`;

        await sendTelegramMessage(botConfig.token, chatId, responseText);
        const savedChatsCount = await db.countBotTelegramUsers(botId);
        return res.status(200).json({ success: true, savedChatsCount, userInfo });
    }

    if (cleanText.startsWith('/stop')) {
        await db.removeTelegramUser(botId, chatId);
        const responseText = `[${chatId}] Disconnected, send <b>/start</b> to connect again`;
        await sendTelegramMessage(botConfig.token, chatId, responseText);
        const savedChatsCount = await db.countBotTelegramUsers(botId);
        return res.status(200).json({ success: true, savedChatsCount });
    }

    if (RELOAD_COMMANDS.has(cleanText)) {
        await db.createOrUpdateUser(botId, chatId, userInfo);

        const reloadPayload = {
            bot: botId,
            botName: botConfig.name,
            command: cleanText,
            chatId,
            from: userInfo,
            timestamp: Date.now()
        };

        await db.upsertReloadSignal(botId, reloadPayload);

        const responseText = `[${botConfig.name}] Reload signal received: "${text}" from ${chatId}`;
        return res.status(200).json({ success: true, message: responseText, reload: reloadPayload });
    }

    const userRecord = await db.getTelegramUser(botId, chatId);
    const isActive = Boolean(userRecord?.isActive);
    const responseText = isActive
        ? `[${chatId}] Connected, send <b>/stop</b> to disconnect`
        : `[${chatId}] In progress..`;

    await sendTelegramMessage(botConfig.token, chatId, responseText);
    await db.createOrUpdateUser(botId, chatId, userInfo);
    const savedChatsCount = await db.countBotTelegramUsers(botId);

    return res.status(200).json({ success: true, savedChatsCount, userInfo });
}

async function handleClientDispatch(req, res, { appConfig, botsConfig }) {
    const text = req.body?.text !== undefined ? req.body.text : req.query?.text;
    const bot = req.body?.bot !== undefined ? req.body.bot : req.query?.bot;
    const chatId = req.body?.chatId !== undefined ? req.body.chatId : req.query?.chatId;

    if (text === '') throw new Error('text is missing');
    if (bot === '') throw new Error('bot is missing');
    if (chatId === '') throw new Error('chatId is missing');

    const finalMessage = text || appConfig.defaultText;
    const isTyping = Boolean(text && (text.startsWith('...') || text.startsWith('typing')));

    const targetBots = bot ? (Array.isArray(bot) ? bot : [bot]) : botsConfig.map(b => b.botId);
    const targetChatIds = chatId ? (Array.isArray(chatId) ? chatId : [chatId]) : [];

    for (const bId of targetBots) {
        if (!botsConfig.some(b => b.botId === bId)) {
            return res.status(400).json({ success: false, error: `Invalid or missing bot identifier: ${bId}` });
        }
    }

    const filterActiveUsers = await resolveActiveRecipients(targetBots, targetChatIds, botsConfig);

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

async function resolveActiveRecipients(targetBots, targetChatIds, botsConfig) {
    const recipients = [];

    for (const bId of targetBots) {
        const botObj = botsConfig.find(b => b.botId === bId);
        const token = botObj?.token;
        if (!token) continue;

        if (targetChatIds.length > 0) {
            for (const id of targetChatIds) {
                const user = await db.getTelegramUser(bId, id, { isActive: true });
                if (user) {
                    recipients.push({ bId, token, chatId: user.chatId });
                }
            }
        } else {
            const users = await db.getTelegramUsersForBot(bId);
            for (const u of users) {
                recipients.push({ bId, token, chatId: u.chatId });
            }
        }
    }

    return recipients;
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
            const resMsg = await sendTelegramMessage(target.token, target.chatId, message);
            results[target.bId].push({ chatId: target.chatId, result: resMsg });
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
        console.error(`Failed sending ACTION to [${chatId}]:`, err.message);
    }
}