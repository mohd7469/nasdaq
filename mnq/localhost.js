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

const MONGODB_URI = "mongodb+srv://awais3227443:BTKJwrtq5qyFAqkd@nasdaq-cluster.sc8gf1s.mongodb.net/?retryWrites=true&w=majority";

async function addInitialData() {
    try {
        await mongoose.connect(MONGODB_URI, {
            dbName: 'nasdaq-database'
        });
        console.log("Database connected!");

        // Config Collection
        const Config = mongoose.models.Config || mongoose.model('Config', new mongoose.Schema({}, { strict: false, versionKey: false }), 'config');
        await Config.deleteMany({});
        await Config.create({
            apiUrl: "https://app-nasdaq.vercel.app/api",
            defaultChatId: "7670215141",
            webhookSecrete: "dxbbot",
            defaultText: "Test Success",
            createdAt: new Date(),
            updatedAt: new Date()
        });


        // Ironbeam Users Collection
        const IronbeamUser = mongoose.models.IronbeamUser || mongoose.model('IronbeamUser', new mongoose.Schema({}, { strict: false, versionKey: false }), 'ironbeam_users');
        await IronbeamUser.deleteMany({});
        await IronbeamUser.create({
            isDemo: true,
            apiUrl: "https://demo.ironbeamapi.com/v2",
            accountId: "51429427",
            username: "51429427",
            password: "Awais51429427",
            apiKey: "24993c8742f046c2a53fa9edb6634819",
            symbol: "XCME:MNQ.Z26",
            isActive: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });


        // Reload Signals Collection
        const ReloadSignal = mongoose.models.ReloadSignal || mongoose.model('ReloadSignal', new mongoose.Schema({}, { strict: false, versionKey: false }), 'reload_signals');
        await ReloadSignal.deleteMany({});
        await ReloadSignal.create({
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
        const TelegramBot = mongoose.models.TelegramBot || mongoose.model('TelegramBot', new mongoose.Schema({}, { strict: false, versionKey: false }), 'telegram_bots');
        await TelegramBot.deleteMany({});
        await TelegramBot.insertMany([
            {
                botId: "dxbmnq_bot",
                name: "Nasdaq Alert",
                token: "8883267489:AAFeXTRqVpMR4-gG1Adi76NTqmtrDCJUj2A",
                createdAt: new Date(),
                updatedAt: new Date()
            },
            {
                botId: "dxblog_bot",
                name: "Nasdaq Logs",
                token: "8846747499:AAECpWSsjXSjzWDgAp5-8iMslCis8iFJYi8",
                createdAt: new Date(),
                updatedAt: new Date()
            }
        ]);


        // Telegram Users Collection
        const TelegramUser = mongoose.models.TelegramUser || mongoose.model('TelegramUser', new mongoose.Schema({}, { strict: false, versionKey: false }), 'telegram_users');
        await TelegramUser.deleteMany({});
        await TelegramUser.insertMany([
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