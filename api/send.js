import axios from 'axios';
import {
    saveOrUpdateUser,
    getUsersForBot,
    countBotUsers,
    removeUser,
    ReloadSignal
} from './db.js';
import config from './config.json' with { type: 'json' };
const { DEFAULT_TEXT, BOTS_CONFIG, WEBHOOK_SECRET, DEFAULT_CHAT_ID } = config;

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
        console.error(`Failed to send to chatId ${chatId}:`, err.response?.data || err.message);
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
        console.error(`Failed to send chat action to chatId ${chatId}:`, err.message);
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
        // ==========================================
        // SCENARIO A: TELEGRAM SE WEBHOOK UPDATE AAYE (POST)
        // ==========================================
        const botId = req.query?.bot;
        if (req.method === 'POST' && req.body && req.body.message && botId) {
            const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
            if (secretHeader !== WEBHOOK_SECRET) {
                return res.status(401).json({ error: 'Unauthorized secret token' });
            }

            const botConfig = BOTS_CONFIG[botId];
            if (!botConfig) {
                return res.status(404).json({ error: 'Bot ID not found in config' });
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
                    await saveOrUpdateUser(botId, chatId, userInfo);
                    console.log(`[${chatId}] awaiting activation,`, userInfo);
                    await sendTelegramMessage(botConfig.token, chatId, `[${chatId}] awaiting activation, send <b>/stop</b> to disconnect.`);
                    const totalUsers = await countBotUsers(botId);
                    return res.status(200).json({ status: 'OK', savedChatsCount: totalUsers, userInfo });
                }

                case cleanText.startsWith('/stop'): {
                    const isDeleted = await removeUser(botId, chatId);
                    if (isDeleted) {
                        console.log(`[${chatId}] disconnected for [${botConfig.name}]`);
                    } else {
                        console.log(`[${chatId}] not found for [${botConfig.name}]`);
                    }

                    await sendTelegramMessage(botConfig.token, chatId, `[${chatId}] disconnected, send <b>/start</b> to connect again.`);
                    const totalUsers = await countBotUsers(botId);
                    return res.status(200).json({ status: 'OK', savedChatsCount: totalUsers });
                }

                case reloadCommands.includes(cleanText): {
                    await saveOrUpdateUser(botId, chatId, userInfo);

                    const reloadPayload = {
                        bot: botId,
                        botName: botConfig.name,
                        command: cleanText,
                        chatId: chatId,
                        from: userInfo,
                        timestamp: Date.now()
                    };

                    await ReloadSignal.findOneAndUpdate(
                        { botId },
                        { botId, payload: reloadPayload, updatedAt: new Date() },
                        { upsert: true, new: true }
                    );

                    console.log(`[${botConfig.name}] Reload command received & saved to DB: "${text}" from ${chatId}`);
                    return res.status(200).json({ status: 'OK', message: 'Reload signal recorded in DB', reload: reloadPayload });
                }

                default: {
                    await saveOrUpdateUser(botId, chatId, userInfo);
                    console.log(`[${botConfig.name}] Message received & User updated: ${chatId}`, userInfo);

                    const totalUsers = await countBotUsers(botId);
                    return res.status(200).json({ status: 'OK', savedChatsCount: totalUsers, userInfo });
                }
            }
        }


        // ==========================================
        // SCENARIO B: CLIENT SIDE SE CALLING (GET / POST)
        // ==========================================

        const targetBot = req.body?.bot !== undefined ? req.body.bot : req.query?.bot;
        const botText = req.body?.text !== undefined ? req.body.text : req.query?.text;

        const chatAction = req.body?.action || req.query?.action;
        console.log('chatAction::', chatAction);
        if (chatAction === 'typing' || chatAction.startsWith('..')) {
            if (targetBot) {
                const targetConfig = BOTS_CONFIG[targetBot];
                if (targetConfig) {
                    const users = await getUsersForBot(targetBot);
                    console.log('Action::', chatAction, users);
                    for (const u of users) {
                        await sendTelegramChatAction(targetConfig.token, u.chatId, chatAction);
                    }
                }
            } else {
                for (const [bId, cfg] of Object.entries(BOTS_CONFIG)) {
                    const users = await getUsersForBot(bId);
                    for (const u of users) {
                        await sendTelegramChatAction(cfg.token, u.chatId, chatAction);
                    }
                }
            }
            return res.status(200).json({ success: true, action: chatAction });
        }

        if (botText !== undefined && botText === '') {
            console.error("text is missing");
            throw new Error("text is missing");
        }

        if (targetBot !== undefined && targetBot === '') {
            console.error("bot is missing");
            throw new Error("bot is missing");
        }

        // Broadcast to all bots if no targetBot specified
        if (targetBot === undefined && (req.method === 'GET' || req.body?.bot === undefined)) {
            const results = {};
            const textToSend = botText || DEFAULT_TEXT;

            for (const [bId, config] of Object.entries(BOTS_CONFIG)) {
                results[bId] = [];
                const users = await getUsersForBot(bId);
                const chats = users.map(u => u.chatId);

                for (const chatId of chats) {
                    const resMsg = await sendTelegramMessage(config.token, chatId, textToSend);
                    results[bId].push({ chatId, result: resMsg });
                }
            }
            return res.status(200).json({ success: true, scope: 'broadcast', results });
        }

        const targetConfig = BOTS_CONFIG[targetBot];
        if (!targetConfig) {
            return res.status(400).json({ error: `Invalid or missing bot identifier: ${targetBot}` });
        }

        const usersForBot = await getUsersForBot(targetBot);
        const chatsForBot = usersForBot.map(u => u.chatId);

        if (chatsForBot.length === 0) {
            return res.status(200).json({
                success: true,
                message: `No chat IDs registered for ${targetConfig.name} yet. Send /start to the bot first!`
            });
        }

        const finalMessage = botText || DEFAULT_TEXT;
        console.log('finalMessage:', finalMessage);

        const broadcastResults = [];
        for (const chatId of chatsForBot) {
            const resMsg = await sendTelegramMessage(targetConfig.token, chatId, finalMessage);
            broadcastResults.push({ chatId, result: resMsg });
        }

        return res.status(200).json({
            success: true,
            bot: targetBot,
            botName: targetConfig.name,
            sentText: finalMessage,
            results: broadcastResults
        });

    } catch (err) {
        console.error('Server Handler Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}