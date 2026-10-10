import moment from 'moment';
import { Bot } from 'node-telegram-bot-api';
import { run } from 'node-telegram-bot-api/node';

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

await run(alertBot);
await run(logBot);

export async function sendAlert(text = 'Test Alert') {
    await alertBot.api.sendMessage({ text, parse_mode: 'HTML' });
}

export async function sendLog(text = 'Test Log') {
    await logBot.api.sendMessage({ text, parse_mode: 'HTML' });
}

export default async function handler(req, res) {
    // Open CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    let type;
    let text;

    try {

        switch (req.method) {
            case 'OPTIONS':
                return res.status(200).end();
            case 'POST':
                type = req?.body?.type;
                text = req?.body?.text;
                break;
            case 'GET':
                type = req?.query?.type;
                text = req?.query?.text;
                break;
        }

        if (text !== undefined && text === '') {
            console.error("text is empty");
            throw new Error("text is empty");
        }

        if (type !== undefined && type === '') {
            console.error("type is empty");
            throw new Error("type is empty");
        }

        switch (type) {
            case 'alert':
                await sendAlert(text);
                break;
            case 'log':
                await sendLog(text);
                break;
            default:
                await sendAlert(text);
                await sendLog(text);
        }

    } catch (err) {
        console.error(`${type} Error:`, err.message);
        return res.status(500).json({ error: err.message });
    }

    return res.status(200).json({
        status: 'OK',
        uptime: moment.duration(process.uptime(), 'seconds').humanize() + ' ago',
        timestamp: new Date().toISOString()
    });
}