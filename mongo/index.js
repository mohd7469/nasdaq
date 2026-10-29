import mongoose from 'mongoose';
import { getTimezone } from '../utils.js';

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
    webhookSecret: { type: String, default: process.env.WEBHOOK_SECRET },
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
    createdAt: { type: Date, default: () => getTimezone().toDate() },
    updatedAt: { type: Date, default: null }
}, { strict: false, versionKey: false });

ironbeamUsersSchema.index({ accountId: 1 }, { unique: true });

const telegramBotsSchema = new mongoose.Schema({
    botId: { type: String, required: true },
    name: { type: String, required: true },
    token: { type: String, required: true }
}, { _id: false, strict: false, versionKey: false });

telegramBotsSchema.index({ botId: 1 }, { unique: true });

const telegramReloadSchema = new mongoose.Schema({
    botId: { type: String, required: true },
    payload: { type: Object, required: true },
    createdAt: { type: Date, default: () => getTimezone().toDate() },
    updatedAt: { type: Date, default: null }
}, { strict: false, versionKey: false });

telegramReloadSchema.index({ botId: 1 }, { unique: true });

const telegramUsersSchema = new mongoose.Schema({
    role: { type: String, required: true, default: 'user' },
    chatId: { type: String, required: true },
    botId: { type: String, required: true },
    userInfo: { type: Object, default: {} },
    name: { type: String, default: '' },
    isActive: { type: Boolean, default: false },
    createdAt: { type: Date, default: () => getTimezone().toDate() },
    updatedAt: { type: Date, default: null }
}, { strict: false, versionKey: false });

telegramUsersSchema.index({ chatId: 1, botId: 1 }, { unique: true });

const tradingSignalsSchema = new mongoose.Schema({
    id: { type: String, required: true },
    timestamp: { type: String },
    side: { type: String },
    action: { type: String },
    price: { type: Number },
    tp: { type: Number, default: null },
    sl: { type: Number, default: null },
    PKT: { type: String },
    DXB: { type: String },
    createdAt: { type: Date, default: () => getTimezone().toDate(), expires: 3 * 24 * 60 * 60 } // 3 din baad auto delete
}, { strict: false, versionKey: false });

tradingSignalsSchema.index({ id: 1 }, { unique: true });
tradingSignalsSchema.index({ timestamp: 1 });

// ----------------------------------------------------
// Models Initialization
// ----------------------------------------------------

export const Configs = mongoose.models.Configs || mongoose.model('Configs', configsSchema, 'config');
export const IronbeamUsers = mongoose.models.IronbeamUsers || mongoose.model('IronbeamUsers', ironbeamUsersSchema, 'ironbeam_users');
export const TelegramBots = mongoose.models.TelegramBots || mongoose.model('TelegramBots', telegramBotsSchema, 'telegram_bots');
export const TelegramReload = mongoose.models.TelegramReload || mongoose.model('TelegramReload', telegramReloadSchema, 'telegram_reload');
export const TelegramUsers = mongoose.models.TelegramUsers || mongoose.model('TelegramUsers', telegramUsersSchema, 'telegram_users');
export const TradingSignals = mongoose.models.TradingSignals || mongoose.model('TradingSignals', tradingSignalsSchema, 'trading_signals');

// ----------------------------------------------------
// DB Connection Initializer
// ----------------------------------------------------

async function connect() {
    if (cached.conn && mongoose.connection.readyState >= 1) {
        return cached.conn;
    }

    if (!cached.promise) {
        const uri = process.env.MONGODB_URI;
        if (!uri) {
            throw new Error('MONGODB_URI is not defined in environment variables');
        }

        cached.promise = mongoose.connect(uri, {
            dbName: DB_NAME,
            maxPoolSize: 10,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000
        }).then((m) => m);
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        throw e;
    }

    return cached.conn;
}

export async function _create(Model, payload) {
    await connect();
    return await Model.create({
        ...payload,
        createdAt: payload.createdAt || getTimezone().toDate(),
        updatedAt: payload.updatedAt !== undefined ? payload.updatedAt : null
    });
}

export async function _createMany(Model, payloads = []) {
    await connect();
    const dataWithTimestamps = payloads.map(item => ({
        ...item,
        createdAt: item.createdAt || getTimezone().toDate(),
        updatedAt: item.updatedAt !== undefined ? item.updatedAt : null
    }));
    return await Model.insertMany(dataWithTimestamps);
}

export async function _read(Model, filter = {}, options = {}) {
    await connect();
    let query = Model.findOne(filter);
    if (options.sort) query = query.sort(options.sort);
    if (options.select) query = query.select(options.select);
    return await query.lean();
}

export async function _readMany(Model, filter = {}, options = {}) {
    await connect();
    let query = Model.find(filter);
    if (options.sort) query = query.sort(options.sort);
    if (options.limit) query = query.limit(options.limit);
    if (options.skip) query = query.skip(options.skip);
    return await query.lean();
}

export async function _update(Model, filter = {}, updateData = {}, options = { new: true }) {
    await connect();
    return await Model.findOneAndUpdate(
        filter,
        { ...updateData, updatedAt: getTimezone().toDate() },
        options
    ).lean();
}

export async function _updateMany(Model, filter = {}, updateData = {}) {
    await connect();
    return await Model.updateMany(
        filter,
        { ...updateData, updatedAt: getTimezone().toDate() }
    );
}

export async function _delete(Model, filter = {}) {
    await connect();
    const result = await Model.deleteOne(filter);
    return result.deletedCount > 0;
}

export async function _deleteMany(Model, filter = {}) {
    await connect();
    const result = await Model.deleteMany(filter);
    return result.deletedCount;
}

export async function _upsert(Model, filter = {}, updateData = {}) {
    await connect();
    return await Model.findOneAndUpdate(
        filter,
        {
            $set: { ...updateData, updatedAt: getTimezone().toDate() },
            $setOnInsert: { createdAt: getTimezone().toDate() }
        },
        { new: true, upsert: true }
    ).lean();
}

export async function _count(Model, filter = {}) {
    await connect();
    return await Model.countDocuments(filter);
}

export async function _replace(Model, filter = {}, replacement = {}, options = {}) {
    await connect();
    return await Model.findOneAndReplace(filter, replacement, options);
}

export async function _findOneAndDelete(Model, filter = {}) {
    await connect();
    return await Model.findOneAndDelete(filter);
}

