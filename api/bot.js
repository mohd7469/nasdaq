import { Bot, webhookCallback } from "node-telegram-bot-api";

let chatId = '7670215141';
const alertBot = new Bot('8883267489:AAGwp4ayOjgzhOwMK2To6njUvlA5mHuC1W4');
const logBot = new Bot('8846747499:AAF0JUr6JgRDzq9t7E-LKUL6rzTcTlPuvNY');

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

const alertHandler = webhookCallback(alertBot, 'std/http', { secretToken: 'dxbbot' });
const logHandler = webhookCallback(logBot, 'std/http', { secretToken: 'dxbbot' });

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // /api/bot?type=alert)
    const botType = req.query?.type;

    if (botType === 'alert') {
        return await alertHandler(req, res);
    } else if (botType === 'log') {
        return await logHandler(req, res);
    }

    return res.status(400).json({ error: 'Invalid bot type specified in query parameters' });
}