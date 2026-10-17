import axios from 'axios';
import { kv as db } from '@vercel/kv';
import config from './config.json' with { type: 'json' };
const { DEFAULT_TEXT, BOTS_CONFIG, WEBHOOK_SECRET, DEFAULT_CHAT_ID } = config;

// In-memory storage: Har botId ke under uski chat IDs save hongi
// const botChatMap = { dxbmnq_bot: ["7670215141"], dxblog_bot: ["7670215141"] }

// Kisi specific bot aur chatId par message bhejne ke liye
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

// Kisi specific bot se chatId ko remove karne ke liye
async function removeChatId(botId, chatId) {
    try {
        const result = await db.srem(`bot:${botId}:chats`, chatId);

        if (result > 0) {
            console.log(`Chat ID ${chatId} successfully removed.`);
        } else {
            console.log(`Chat ID ${chatId} not exist.`);
        }
    } catch (error) {
        console.error("Error deleting chat ID:", error);
    }
}
// await removeChatId('dxbmnq_bot', DEFAULT_CHAT_ID);

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

            // Vercel db key for this bot's chat IDs
            const dbKey = `bot:${botId}:chats`;

            // Agar user ne /stop bheja hai toh chat ID remove kar dein
            if (text.startsWith('/stop')) {
                await removeChatId(botId, chatId);
                console.log(`[${botConfig.name}] Chat ID removed: ${chatId}`);
                await sendTelegramMessage(botConfig.token, chatId, `Tap <b>/start</b> to subscribe again`);
                const savedChats = await db.smembers(dbKey);
                return res.status(200).json({ status: 'OK', savedChatsCount: savedChats.length });
            }

            // Agar user ne reload / refresh bheja hai
            const cleanText = text.trim().toLowerCase();
            const reloadCommands = ['reload', 'refresh', '/reload', '/refresh'];
            if (reloadCommands.includes(cleanText)) {
                await db.sadd(dbKey, chatId);
                const reloadPayload = {
                    bot: botId,
                    botName: botConfig.name,
                    command: cleanText,
                    chatId: chatId,
                    timestamp: Date.now()
                };
                await db.set(`bot:${botId}:reload`, reloadPayload);
                console.log(`[${botConfig.name}] Reload command received: "${text}" from ${chatId}`);
                return res.status(200).json({ status: 'OK', message: 'Reload signal recorded', reload: reloadPayload });
            }

            // Chat ID save karein (ye db sari duplicate values khud avoid karta hai)
            await db.sadd(dbKey, chatId);
            console.log(`[${botConfig.name}] New Chat ID saved: ${chatId}`);

            // Current stored chats count retrieve karna response ke liye
            const savedChats = await db.smembers(dbKey);

            // Agar user ne /start bheja hai toh welcome/acknowledgment bhej dein
            if (text.startsWith('/start')) {
                await sendTelegramMessage(botConfig.token, chatId, `Connected to ${botConfig.name} tap <b>/stop</b> to leave`);
            }

            return res.status(200).json({ status: 'OK', savedChatsCount: savedChats.length });
        }


        // ==========================================
        // SCENARIO B: CLIENT SIDE SE CALLING (GET / POST)
        // ==========================================

        const targetBot = req.body?.bot !== undefined ? req.body.bot : req.query?.bot;
        const botText = req.body?.text !== undefined ? req.body.text : req.query?.text;

        // Aapki di gayi validations
        if (botText !== undefined && botText === '') {
            console.error("text is missing");
            throw new Error("text is missing");
        }

        if (targetBot !== undefined && targetBot === '') {
            console.error("bot is missing");
            throw new Error("bot is missing");
        }

        if (targetBot === undefined && (req.method === 'GET' || req.body?.bot === undefined)) {
            const results = {};
            const textToSend = botText || DEFAULT_TEXT;

            for (const [bId, config] of Object.entries(BOTS_CONFIG)) {
                results[bId] = [];
                const storedChats = await db.smembers(`bot:${bId}:chats`);
                let chats = storedChats && storedChats.length > 0 ? storedChats : [];
                // if (chats.length === 0 && DEFAULT_CHAT_ID) {
                //     chats = [DEFAULT_CHAT_ID];
                // }
                for (const chatId of chats) {
                    const resMsg = await sendTelegramMessage(config.token, chatId, textToSend);
                    results[bId].push({ chatId, result: resMsg });
                }
            }
            return res.status(200).json({ success: true, scope: 'broadcast', results });
        }

        // Selected bot validation
        const targetConfig = BOTS_CONFIG[targetBot];
        if (!targetConfig) {
            return res.status(400).json({ error: `Invalid or missing bot identifier: ${targetBot}` });
        }

        const storedChatsForBot = await db.smembers(`bot:${targetBot}:chats`);
        let chatsForBot = storedChatsForBot && storedChatsForBot.length > 0 ? storedChatsForBot : [];
        // if (chatsForBot.length === 0 && DEFAULT_CHAT_ID) {
        //     chatsForBot = [DEFAULT_CHAT_ID];
        // }

        if (chatsForBot.length === 0) {
            return res.status(200).json({
                success: true,
                message: `No chat IDs registered for ${targetConfig.name} yet. Send /start to the bot first!`
            });
        }

        // Text determine karna (Custom diya ho ya default "Test Success")
        const finalMessage = botText || DEFAULT_TEXT;

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