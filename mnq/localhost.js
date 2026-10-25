// import axios from 'axios';

const response = await fetch('https://raw.githubusercontent.com/mohd7469/nasdaq/refs/heads/main/api/config.json');
const config = await response.json();
const bots = Object.keys(config.BOTS_CONFIG);

// const API_URL = 'http://localhost:3000/api';
const API_URL = config.API_URL;

const testkWebhook = async (text = 'typing') => {
    try {
        for (const bot of bots) {
            await axios.post(`${API_URL}/send`, { bot, text });
        }
    } catch (err) {
        console.error('Webhook Error:', err?.message);
    }
}

const handleTrade = async (payload) => {
    try {
        await axios.post(`${API_URL}/trade`, payload);
    } catch (err) {
        console.error('Trade Error:', err?.message);
    }
}

// testkWebhook(`...`)

// handleTrade({
//     "timestamp": "2026-10-26T18:30:00.000+05:00",
//     "side": "LONG",
//     "action": "ENTRY",
//     "price": ,
//     "tp": ,
//     "sl": ,
// })
// handleTrade({
//     "action": "EXIT"
// })

// handleTrade({
//     "timestamp": "2026-10-26T18:30:00.000+05:00",
//     "side": "SHORT",
//     "action": "ENTRY",
//     "price": ,
//     "tp": ,
//     "sl": ,
// })
// handleTrade({
//     "action": "EXIT"
// })

import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

async function addInitialData() {
    try {
        await mongoose.connect(MONGODB_URI, {
            dbName: 'nasdaq-database'
        });
        console.log("Database connected!");

        // Configs Collection
        const Configs = mongoose.models.Configs || mongoose.model('Configs', new mongoose.Schema({}, { strict: false, versionKey: false }), 'config');
        await Configs.deleteMany({});
        await Configs.create({
            apiUrl: "https://app-nasdaq.vercel.app/api",
            defaultChatId: "7670215141",
            webhookSecret: "dxbbot",
            defaultText: "Test Success"
        });


        // Ironbeam Users Collection
        const IronbeamUsers = mongoose.models.IronbeamUsers || mongoose.model('IronbeamUsers', new mongoose.Schema({}, { strict: false, versionKey: false }), 'ironbeam_users');
        await IronbeamUsers.deleteMany({});
        await IronbeamUsers.insertMany([
            {
                isDemo: true,
                apiUrl: "https://demo.ironbeamapi.com/v2",
                accountId: "51429427",
                username: "51429427",
                password: "Awais51429427",
                apiKey: "24993c8742f046c2a53fa9edb6634819",
                symbol: "XCME:MNQ.Z26",
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ]);


        // Reload Signals Collection
        const ReloadSignals = mongoose.models.ReloadSignals || mongoose.model('ReloadSignals', new mongoose.Schema({}, { strict: false, versionKey: false }), 'reload_signals');
        await ReloadSignals.deleteMany({});
        await ReloadSignals.create({
            botId: "dxblog_bot",
            payload: {
                bot: "dxblog_bot",
                botName: "Nasdaq Logs",
                command: "reload",
                chatId: "7670215141",
                from: {
                    id: 7670215141,
                    is_bot: false,
                    first_name: "Mohammad",
                    username: "dxb786327",
                    language_code: "en"
                },
                timestamp: 1792936165295
            },
            createdAt: new Date(),
            updatedAt: new Date()
        });


        // Telegram Bots Collection
        const TelegramBots = mongoose.models.TelegramBots || mongoose.model('TelegramBots', new mongoose.Schema({}, { strict: false, versionKey: false }), 'telegram_bots');
        await TelegramBots.deleteMany({});
        await TelegramBots.insertMany([
            {
                botId: "dxbmnq_bot",
                name: "Nasdaq Alert",
                token: "8883267489:AAFeXTRqVpMR4-gG1Adi76NTqmtrDCJUj2A"
            },
            {
                botId: "dxblog_bot",
                name: "Nasdaq Logs",
                token: "8846747499:AAECpWSsjXSjzWDgAp5-8iMslCis8iFJYi8"
            }
        ]);


        // Telegram Users Collection
        const TelegramUsers = mongoose.models.TelegramUsers || mongoose.model('TelegramUsers', new mongoose.Schema({}, { strict: false, versionKey: false }), 'telegram_users');
        await TelegramUsers.deleteMany({});
        await TelegramUsers.insertMany([
            {
                role: "admin",
                chatId: "7670215141",
                botId: "dxbmnq_bot",
                userInfo: {
                    "first_name": "mohd dxb",
                },
                name: "mohd dxb",
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                role: "admin",
                chatId: "7670215141",
                botId: "dxblog_bot",
                userInfo: {
                    "first_name": "mohd dxb",
                },
                name: "mohd dxb",
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                role: "user",
                chatId: "8651160508",
                botId: "dxbmnq_bot",
                userInfo: {
                    id: "8651160508",
                    is_bot: false,
                    first_name: "Bilal",
                    last_name: "Ahsan",
                    language_code: "en"
                },
                name: "bilal telenor",
                isActive: false,
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                role: "user",
                chatId: "1558836474",
                botId: "dxbmnq_bot",
                userInfo: {
                    id: "1558836474",
                    is_bot: false,
                    first_name: "Mohammad",
                    username: "mohd786327",
                    language_code: "en"
                },
                name: "awais jazz",
                isActive: false,
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ]);


        process.exit(0);
    } catch (error) {
        console.error("Error adding data:", error);
        process.exit(1);
    }
}

addInitialData();