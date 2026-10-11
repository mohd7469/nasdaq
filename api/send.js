import axios from 'axios';
import { DEFAULT_TEXT, BOTS_CONFIG, WEBHOOK_SECRET, DEFAULT_CHAT_ID } from './env.js';

// In-memory storage: Har botId ke under uski chat IDs save hongi
// { dxbmnq_bot: ["7670215141"], dxblog_bot: ["7670215141"] }
const botChatMap = {};

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
        const botParam = req.query?.bot;
        if (req.method === 'POST' && req.body && req.body.message && botParam) {
            const secretHeader = req.headers['x-telegram-bot-api-secret-token'];
            if (secretHeader !== WEBHOOK_SECRET) {
                return res.status(401).json({ error: 'Unauthorized secret token' });
            }

            const botConfig = BOTS_CONFIG[botParam];
            if (!botConfig) {
                return res.status(404).json({ error: 'Bot ID not found in config' });
            }

            const message = req.body.message;
            const chatId = String(message.chat.id);
            const text = message.text || '';

            // Bot ke mapping mein array initialize karein agar nahi hai
            if (!botChatMap[botParam]) {
                botChatMap[botParam] = [];
            }

            // Chat ID save karein (duplicates avoid karne ke liye)
            if (!botChatMap[botParam].includes(chatId)) {
                botChatMap[botParam].push(chatId);
                console.log(`[${botConfig.name}] New Chat ID saved: ${chatId}`);
            }

            // Agar user ne /start bheja hai toh welcome/acknowledgment bhej dein
            if (text.startsWith('/start')) {
                await sendTelegramMessage(botConfig.token, chatId, `Your are now subscribed to ${botConfig.name}.`);
            }

            return res.status(200).json({ status: 'OK', savedChatsCount: botChatMap[botParam].length });
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
                let chats = botChatMap[bId] && botChatMap[bId].length > 0 ? botChatMap[bId] : [];
                if (chats.length === 0 && DEFAULT_CHAT_ID) {
                    chats = [DEFAULT_CHAT_ID];
                }
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

        let chatsForBot = botChatMap[targetBot] && botChatMap[targetBot].length > 0 ? botChatMap[targetBot] : [];
        if (chatsForBot.length === 0 && DEFAULT_CHAT_ID) {
            chatsForBot = [DEFAULT_CHAT_ID];
        }

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