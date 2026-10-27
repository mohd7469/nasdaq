import mongoose from 'mongoose';

const DB_NAME = 'nasdaq-database';

// Global cache for Serverless environments (Vercel)
let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

// ----------------------------------------------------
// SCHEMAS & MODELS (Strict collection mappings)
// ----------------------------------------------------

// 1. Configs Model (Collection: "config")
const configsSchema = new mongoose.Schema({
    apiUrl: { type: String, default: 'https://app-nasdaq.vercel.app/api' },
    defaultChatId: { type: String, default: '7670215141' },
    webhookSecret: { type: String, default: 'dxbbot' },
    defaultText: { type: String, default: 'Test Success' }
}, { _id: false, strict: false, versionKey: false });

export const Configs = mongoose.models.Configs || mongoose.model('Configs', configsSchema, 'config');

// 2. Ironbeam Users Model (Collection: "ironbeam_users")
const ironbeamUsersSchema = new mongoose.Schema({
    isDemo: { type: Boolean, default: true },
    apiUrl: { type: String, default: 'https://demo.ironbeamapi.com/v2' },
    accountId: { type: String, required: true },
    username: { type: String, required: true },
    password: { type: String, required: true },
    apiKey: { type: String, required: true },
    symbol: { type: String, default: 'XCME:MNQ.Z26' },
    isActive: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { strict: false, versionKey: false });

export const IronbeamUsers = mongoose.models.IronbeamUsers || mongoose.model('IronbeamUsers', ironbeamUsersSchema, 'ironbeam_users');

// 3. Reload Signals Model (Collection: "reload_signals")
const reloadSignalsSchema = new mongoose.Schema({
    botId: { type: String, required: true, unique: true },
    payload: { type: Object, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { strict: false, versionKey: false });

export const ReloadSignals = mongoose.models.ReloadSignals || mongoose.model('ReloadSignals', reloadSignalsSchema, 'reload_signals');

// 4. Telegram Bots Model (Collection: "telegram_bots")
const telegramBotsSchema = new mongoose.Schema({
    botId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    token: { type: String, required: true }
}, { _id: false, strict: false, versionKey: false });

export const TelegramBots = mongoose.models.TelegramBots || mongoose.model('TelegramBots', telegramBotsSchema, 'telegram_bots');

// 5. Telegram Users Model (Collection: "telegram_users")
const telegramUsersSchema = new mongoose.Schema({
    role: { type: String, required: true, default: 'user' },
    chatId: { type: String, required: true },
    botId: { type: String, required: true },
    userInfo: { type: Object, default: {} },
    name: { type: String, default: '' },
    isActive: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { strict: false, versionKey: false });

telegramUsersSchema.index({ chatId: 1, botId: 1 }, { unique: true });

export const TelegramUsers = mongoose.models.TelegramUsers || mongoose.model('TelegramUsers', telegramUsersSchema, 'telegram_users');

// 6. Telegram Signals Model (Collection: "telegram_signals")
const telegramSignalsSchema = new mongoose.Schema({
    id: { type: String, required: true, unique: true },
    timestamp: { type: String },
    side: { type: String },
    action: { type: String },
    price: { type: Number },
    tp: { type: Number, default: null },
    sl: { type: Number, default: null },
    PKT: { type: String },
    DXB: { type: String },
    createdAt: { type: Date, default: Date.now, expires: 86400 } // 24 ghante baad auto delete
}, { strict: false, versionKey: false });

export const TelegramSignals = mongoose.models.TelegramSignals || mongoose.model('TelegramSignals', telegramSignalsSchema, 'telegram_signals');

// ----------------------------------------------------
// Centralized DB Connection
// ----------------------------------------------------
export async function connectDB() {
    if (cached.conn && mongoose.connection.readyState >= 1) {
        return cached.conn;
    }

    if (!cached.promise) {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        cached.promise = mongoose.connect(uri, {
            dbName: DB_NAME
        }).then((m) => {
            console.log(`Connected to MongoDB (${DB_NAME})`);
            return m;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

// Re-export all centralized database operations
export * from './operations.js';
