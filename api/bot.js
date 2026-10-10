import { Bot, registerExpressWebhook } from "node-telegram-bot-api";
import { ALERT_BOT_TOKEN, LOG_BOT_TOKEN, WEBHOOK_SECRET, CHAT_ID } from '../env.js';

let chatId = CHAT_ID;

const alertBot = new Bot(ALERT_BOT_TOKEN);
const logBot = new Bot(LOG_BOT_TOKEN);

alertBot.command("start", (ctx) => {
    chatId = String(ctx.chat.id);
    console.log(`AlertBot Start: ${chatId}`);
    ctx.reply(`Got it! Aapka chatId: ${chatId}`);
});

logBot.command("start", (ctx) => {
    chatId = String(ctx.chat.id);
    console.log(`LogBot Start: ${chatId}`);
    ctx.reply(`Got it! Aapka chatId: ${chatId}`);
});

export async function sendAlert(text = 'Test Alert') {
    await alertBot.api.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

export async function sendLog(text = 'Test Log') {
    await logBot.api.sendMessage(chatId, text, { parse_mode: 'HTML' });
}

// Structural stand-in handlers jaise example mein bataya gaya hai
let alertHandler, logHandler;

const fakeAlertApp = {
    post(path, handler) {
        alertHandler = handler;
    }
};

const fakeLogApp = {
    post(path, handler) {
        logHandler = handler;
    }
};

registerExpressWebhook(alertBot, fakeAlertApp, {
    path: "/",
    secretToken: WEBHOOK_SECRET,
});

registerExpressWebhook(logBot, fakeLogApp, {
    path: "/",
    secretToken: WEBHOOK_SECRET,
});

// Vercel Serverless Handler
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const botType = req.query?.type;

    if (botType === 'alert' && alertHandler) {
        return await alertHandler(req, res);
    } else if (botType === 'log' && logHandler) {
        return await logHandler(req, res);
    }

    return res.status(400).json({ error: 'Invalid or missing bot type parameter (?type=alert|log)' });
}