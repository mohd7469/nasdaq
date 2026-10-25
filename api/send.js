import axios from 'axios';
import {
    connectDB,
    getAppConfig,
    getBotsConfig,
    TelegramUsers,
    createOrUpdateUser,
    getTelegramUsersForBot,
    countBotTelegramUsers,
    removeTelegramUser,
    ReloadSignals
} from './db.js';

// Telegram API par message bhejne ke liye helper function
async function sendTelegramMessage(token, chatId, text) {
    try {
        const response = await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'HTML'
        });
        return { success: true, data: response.data };
    } catch (err) {
        console.error(`Failed sending MESSAGE to [${chatId}],`, err.response?.data || err.message);
        return { success: false, error: err.response?.data || err.message };
    }
}

// Telegram API par chat action (typing) bhejne ke liye helper function
async function sendTelegramChatAction(token, chatId, action = 'typing') {
    try {
        await axios.post(`https://api.telegram.org/bot${token}/sendChatAction`, {
            chat_id: chatId,
            action: action
        });
    } catch (err) {
        console.error(`Failed sending ACTION to [${chatId}],`, err.message);
    }
}

// Vercel Serverless Main Handler
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        await connectDB();
        const appConfig = await getAppConfig();
        const botsConfig = await getBotsConfig();

        const defaultText = appConfig.defaultText;
        const webhookSecret = appConfig.webhookSecret;

        // ==========================================
        // SCENARIO A: TELEGRAM SE WEBHOOK UPDATE AAYE (POST)
        // ==========================================
        const botId = req.query?.bot;
        if (req.method === 'POST' && req.body && req.body.message && botId) {
            const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
            if (secretHeader !== webhookSecret) {
                return res.status(401).json({ error: 'Unauthorized secret token' });
            }

            const botConfig = botsConfig.find(b => b.botId === botId);
            if (!botConfig) {
                return res.status(404).json({ error: 'Bot ID not found in database' });
            }

            const message = req.body.message;
            const chatId = String(message.chat.id);
            const text = message.text || '';
            const userInfo = message.from || {};

            const cleanText = text.trim().toLowerCase();
            const reloadCommands = ['reload', 'refresh', '/reload', '/refresh'];

            // Command Tarteeb: /start -> /stop -> reload -> default
            switch (true) {
                case cleanText.startsWith('/start'): {
                    const userRecord = await createOrUpdateUser(botId, chatId, userInfo);
                    const isActive = userRecord ? userRecord.isActive : false;

                    const textToSend = isActive
                        ? `[${chatId}] Connected, send <b>/stop</b> to disconnect`
                        : `[${chatId}] Request sent..`;

                    console.log(`[${chatId}] ${isActive ? 'Connected' : 'Request sent..'}`);

                    await sendTelegramMessage(botConfig.token, chatId, textToSend);
                    const totalUsers = await countBotTelegramUsers(botId);
                    return res.status(200).json({ status: 'OK', savedChatsCount: totalUsers, userInfo });
                }

                case cleanText.startsWith('/stop'): {
                    const isDeleted = await removeTelegramUser(botId, chatId);
                    if (isDeleted) {
                        console.log(`[${chatId}] Disconnected for [${botConfig.name}]`);
                    } else {
                        console.log(`[${chatId}] Not found for [${botConfig.name}]`);
                    }

                    const textToSend = `[${chatId}] Disconnected, send <b>/start</b> to connect again`;
                    await sendTelegramMessage(botConfig.token, chatId, textToSend);
                    const totalUsers = await countBotTelegramUsers(botId);
                    return res.status(200).json({ status: 'OK', savedChatsCount: totalUsers });
                }

                case reloadCommands.includes(cleanText): {
                    await createOrUpdateUser(botId, chatId, userInfo);

                    const reloadPayload = {
                        bot: botId,
                        botName: botConfig.name,
                        command: cleanText,
                        chatId: chatId,
                        from: userInfo,
                        timestamp: Date.now()
                    };

                    await ReloadSignals.findOneAndUpdate(
                        { botId },
                        { botId, payload: reloadPayload, updatedAt: new Date() },
                        { upsert: true, new: true }
                    );

                    const textToSend = `[${botConfig.name}] Reload signal received: "${text}" from ${chatId}`;
                    console.log(textToSend);
                    return res.status(200).json({ status: 'OK', message: textToSend, reload: reloadPayload });
                }

                default: {
                    const userRecord = await TelegramUsers.findOne({ chatId, botId });
                    const isActive = userRecord ? userRecord.isActive : false;

                    const textToSend = isActive
                        ? `[${chatId}] Connected, send <b>/stop</b> to disconnect`
                        : `[${chatId}] In progress..`;

                    await sendTelegramMessage(botConfig.token, chatId, textToSend);
                    await createOrUpdateUser(botId, chatId, userInfo);

                    console.log(`[${botConfig.name}] Message received & User updated: ${chatId}`, userInfo);

                    const totalUsers = await countBotTelegramUsers(botId);
                    return res.status(200).json({ status: 'OK', savedChatsCount: totalUsers, userInfo });
                }
            }
        }


        // ==========================================
        // SCENARIO B: CLIENT SIDE SE CALLING (GET / POST)
        // ==========================================

        const text = req.body?.text !== undefined ? req.body.text : req.query?.text;
        const bot = req.body?.bot !== undefined ? req.body.bot : req.query?.bot;
        const chatId = req.body?.chatId !== undefined ? req.body.chatId : req.query?.chatId;

        // Basic validations
        if (text !== undefined && text === '') {
            throw new Error("text is missing");
        }
        if (bot !== undefined && bot === '') {
            throw new Error("bot is missing");
        }
        if (chatId !== undefined && chatId === '') {
            throw new Error("chatId is missing");
        }

        const finalMessage = text || defaultText;
        const isTyping = text && (text.startsWith('...') || text.startsWith('typing'));

        // Target lists tayyar karna
        const targetBots = bot ? (Array.isArray(bot) ? bot : [bot]) : botsConfig.map(b => b.botId);
        const targetChatIds = chatId ? (Array.isArray(chatId) ? chatId : [chatId]) : [];

        // Validate bots existence
        for (const bId of targetBots) {
            if (!botsConfig.some(b => b.botId === bId)) {
                return res.status(400).json({ error: `Invalid or missing bot identifier: ${bId}` });
            }
        }

        // STEP 1: Active users ko filter kar ke list banana
        const filterActiveUsers = [];

        for (const bId of targetBots) {
            const botObj = botsConfig.find(b => b.botId === bId);
            const token = botObj?.token;
            if (!token) continue;

            if (targetChatIds.length > 0) {
                for (const id of targetChatIds) {
                    const user = await TelegramUsers.findOne({ chatId: String(id), botId: bId, isActive: true });
                    if (user) {
                        filterActiveUsers.push({ bId, token, chatId: user.chatId });
                    }
                }
            } else {
                const users = await getTelegramUsersForBot(bId);
                for (const u of users) {
                    filterActiveUsers.push({ bId, token, chatId: u.chatId });
                }
            }
        }

        if (targetChatIds.length > 0 && filterActiveUsers.length === 0) {
            return res.status(404).json({
                success: false,
                error: `User is not active for given chatId`
            });
        }

        // STEP 2: Execution sabse end mein sirf ek hi jagah hogi
        const results = {};

        for (const target of filterActiveUsers) {
            if (!results[target.bId]) results[target.bId] = [];

            if (isTyping) {
                await sendTelegramChatAction(target.token, target.chatId);
                results[target.bId].push({ chatId: target.chatId, action: 'typing' });
            } else {
                const resMsg = await sendTelegramMessage(target.token, target.chatId, finalMessage);
                results[target.bId].push({ chatId: target.chatId, result: resMsg });
            }
        }

        return res.status(200).json({
            success: true,
            action: isTyping ? 'typing' : 'message',
            bot: bot || 'all_bots',
            chatId: chatId || 'all_active_users',
            results
        });

    } catch (err) {
        console.error('Server Handler Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}