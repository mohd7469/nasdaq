import cors from './cors.js';
import axios from 'axios';
import moment from 'moment';

import * as db from '../mongo/db.js';

const [config, bots] = await Promise.all([
    db.getAppConfig(),
    db.getBotsConfig()
]);

const initDefaultTelegramUsersAccess = async () => {
    try {
        for (const bot of bots) {
            await db.createOrUpdateUser(bot.botId, config.defaultChatId, { first_name: 'mohd' }, 'admin');
        }

        await db.batchUpdateTelegramUsers([
            ...bots.map(bot => ({
                botId: bot.botId,
                isActive: true,
                chatId: config.defaultChatId,
                name: 'mohd'
            })),
            ...bots.map(bot => ({
                botId: bot.botId,
                isActive: true,
                chatId: '',
                name: ''
            })),
        ]);

        console.log("User Updated successfully");

        // -------------------------------------------------------------
        // EXAMPLE MANUAL OPERATIONS (Zaroorat ke mutabiq use karein):
        // -------------------------------------------------------------
        // 1. Check all users:
        // const users = await db.TelegramUsers.find().lean();
        // console.log("Telegram Users:", users);
        //
        // 2. Modify specific user:
        // await db.updateTelegramUser('dxbmnq_bot', '7670215141', { isActive: true });
        //
        // 3. Delete user:
        // await db.removeTelegramUser('dxbmnq_bot', '123456');
        // -------------------------------------------------------------

    } catch (error) {
        console.error("Error in localhost execution:", error);
    } finally {
        process.exit(0);
    }
}

const addInitialData = async () => {
    try {
        // db.Configs Collection
        await db.Configs.deleteMany({});
        await db.Configs.create({}); // default schema values initialize

        // Ironbeam Users Collection
        await db.IronbeamUsers.deleteMany({});
        await db.IronbeamUsers.insertMany([
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
        await db.ReloadSignals.deleteMany({});
        await db.ReloadSignals.create({
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
        await db.TelegramBots.deleteMany({});
        await db.TelegramBots.insertMany([
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
        await db.TelegramUsers.deleteMany({});
        await db.TelegramUsers.insertMany([
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

        console.log("Initial seed data added successfully!");
        process.exit(0);
    } catch (error) {
        console.error("Error adding initial data:", error);
        process.exit(1);
    }
}

const testkWebhook = async (text = 'typing') => {
    try {
        for (const bot of bots) {
            await axios.post(`${config.apiUrl}/send`, { bot, text });
        }
    } catch (err) {
        console.error('Webhook Error:', err?.message);
    }
}

const handleTrade = async (payload) => {
    try {
        await axios.post(`${config.apiUrl}/trade`, payload);
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

process.exit(0);