import axios from 'axios';
import moment from 'moment';

import * as db from '../mongo/db.js';

const [config, bots] = await Promise.all([
    db.getAppConfig(),
    db.getBotsConfig()
]);

const initMongoSeed = async () => {
    try {
        await db.resetAppConfig([
            {
                apiUrl: "https://app-nasdaq.vercel.app/api",
                defaultChatId: "7670215141",
                webhookSecret: process.env.WEBHOOK_SECRET,
                defaultText: "Test Success"
            }
        ]);

        await db.resetIronbeamUsers([
            {
                apiUrl: "https://demo.ironbeamapi.com/v2",
                accountId: "51429427",
                username: "51429427",
                password: "Awais51429427",
                apiKey: "24993c8742f046c2a53fa9edb6634819",
                symbol: "XCME:MNQ.Z26",
                isDemo: true,
                isActive: true
            },
            // {
            //     apiUrl: "https://demo.ironbeamapi.com/v2",
            //     accountId: "",
            //     username: "",
            //     password: "",
            //     apiKey: "",
            //     symbol: "XCME:MNQ.Z26",
            //     isDemo: true,
            //     isActive: false
            // }
        ]);

        await db.resetTelegramBots([
            {
                botId: "dxbmnq_bot",
                name: "Nasdaq Alert",
                token: process.env.NASDAQ_ALERT
            },
            {
                botId: "dxblog_bot",
                name: "Nasdaq Logs",
                token: process.env.NASDAQ_LOGS
            }
        ]);

        // await db.resetTelegramReload([
        //     {
        //         botId: "dxblog_bot",
        //         payload: {
        //             bot: "dxblog_bot",
        //             botName: "Nasdaq Logs",
        //             command: "reload",
        //             chatId: "7670215141",
        //             from: {
        //                 id: "7670215141",
        //                 is_bot: false,
        //                 first_name: "Mohammad",
        //                 username: "dxb786327",
        //                 language_code: "en"
        //             },
        //             timestamp: 1792936165295
        //         }
        //     }
        // ]);

        await db.resetTelegramUsers([
            {
                role: "admin",
                chatId: "7670215141",
                botId: "dxblog_bot",
                userInfo: { first_name: "mohd dxb" },
                name: "mohd dxb",
                isActive: true
            },
            {
                role: "admin",
                chatId: "7670215141",
                botId: "dxbmnq_bot",
                userInfo: { first_name: "mohd dxb" },
                name: "mohd dxb",
                isActive: true
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
                isActive: false
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
                isActive: false
            },
            {
                role: "user",
                chatId: "8973124597",
                botId: "dxbmnq_bot",
                userInfo: {
                    id: "8973124597",
                    is_bot: false,
                    first_name: "Spikes & Net",
                    last_name: "Birds Control",
                    language_code: "en"
                },
                name: "khurram",
                isActive: false
            }
        ]);

        // await db.resetTradingSignals([
        //     {
        //         id: "SHORT_ENTRY_29787.5_2026-10-28T18:45:00.000+05:00",
        //         timestamp: "2026-10-28T18:45:00.000+05:00",
        //         side: "SHORT",
        //         action: "ENTRY",
        //         price: 29787.5,
        //         tp: 29732.25,
        //         sl: 29879.75,
        //         PKT: "Wed, Oct 28, 6:45 PM",
        //         DXB: "Wed, Oct 28, 5:45 PM"
        //     }
        // ]);

        console.log("Init mongo seed success!");
    } catch (error) {
        console.error("Error init mongo seed:", error);
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

(async () => {
    console.log('Starting..')

    await initMongoSeed()

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
})()