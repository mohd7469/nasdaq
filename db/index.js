import mongoose from 'mongoose';

const DB_NAME = 'nasdaq-database';

let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

// ----------------------------------------------------
// Schemas Initialization
// ----------------------------------------------------

const configsSchema = new mongoose.Schema({
    apiUrl: { type: String, default: 'https://app-nasdaq.vercel.app/api' },
    defaultChatId: { type: String, default: '7670215141' },
    webhookSecret: { type: String, default: 'dxbbot' },
    defaultText: { type: String, default: 'Test Success' }
}, { _id: false, strict: false, versionKey: false });

configsSchema.index({ apiUrl: 1 }, { unique: true });

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

ironbeamUsersSchema.index({ accountId: 1 }, { unique: true });

const reloadSignalsSchema = new mongoose.Schema({
    botId: { type: String, required: true, unique: true },
    payload: { type: Object, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { strict: false, versionKey: false });

reloadSignalsSchema.index({ botId: 1 }, { unique: true });

const telegramBotsSchema = new mongoose.Schema({
    botId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    token: { type: String, required: true }
}, { _id: false, strict: false, versionKey: false });

telegramBotsSchema.index({ botId: 1 }, { unique: true });

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

telegramSignalsSchema.index({ id: 1 }, { unique: true });

// ----------------------------------------------------
// Models Initialization
// ----------------------------------------------------

export const Configs = mongoose.models.Configs || mongoose.model('Configs', configsSchema, 'config');
export const IronbeamUsers = mongoose.models.IronbeamUsers || mongoose.model('IronbeamUsers', ironbeamUsersSchema, 'ironbeam_users');
export const ReloadSignals = mongoose.models.ReloadSignals || mongoose.model('ReloadSignals', reloadSignalsSchema, 'reload_signals');
export const TelegramBots = mongoose.models.TelegramBots || mongoose.model('TelegramBots', telegramBotsSchema, 'telegram_bots');
export const TelegramUsers = mongoose.models.TelegramUsers || mongoose.model('TelegramUsers', telegramUsersSchema, 'telegram_users');
export const TelegramSignals = mongoose.models.TelegramSignals || mongoose.model('TelegramSignals', telegramSignalsSchema, 'telegram_signals');

// ----------------------------------------------------
// DB Connection Initializer
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

        cached.promise = mongoose.connect(uri, { dbName: DB_NAME }).then((m) => m);
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

export * from './operations.js';
