import { Bot, webhookCallback } from "node-telegram-bot-api";
import { ALERT_BOT_TOKEN, LOG_BOT_TOKEN, WEBHOOK_SECRET, CHAT_ID } from './env.js';

let chatId = CHAT_ID;
const alertBot = new Bot(ALERT_BOT_TOKEN);
const logBot = new Bot(LOG_BOT_TOKEN);

alertBot.command("start", (ctx) => {
    chatId = ctx.chat.id;
    console.log(`AlertBot: ${ctx.chat.id}: ${ctx.message?.text}`);
    ctx.reply(`Got it! Aapka chatId: ${ctx.chat.id}`);
});

logBot.command("start", (ctx) => {
    chatId = ctx.chat.id;
    console.log(`LogBot: ${ctx.chat.id}: ${ctx.message?.text}`);
    ctx.reply(`Got it! Aapka chatId: ${ctx.chat.id}`);
});

const alertHandler = webhookCallback(alertBot, { secretToken: WEBHOOK_SECRET });
const logHandler = webhookCallback(logBot, { secretToken: WEBHOOK_SECRET });

export async function sendAlert(text = 'Test Alert') {
    await alertBot.api.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

export async function sendLog(text = 'Test Log') {
    await logBot.api.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const botType = req.query?.type;

    if (botType === 'alert') {
        return await alertHandler(req, res);
    } else if (botType === 'log') {
        return await logHandler(req, res);
    }

    return res.status(400).json({ error: 'Invalid bot type specified in query parameters' });
}