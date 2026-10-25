import mongoose from 'mongoose';

const DB_NAME = 'nasdaq-database';

// Global cache for Serverless environments (Vercel)
let cached = global.mongoose;
if (!cached) {
    cached = global.mongoose = { conn: null, promise: null };
}

// 1. Centralized DB connection
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

// ==========================================
// SCHEMAS & MODELS (Strict collection mappings)
// ==========================================

// Schema key order maintain karne ke liye helper function
export function sortDocBySchema(doc, schema) {
    if (!doc || typeof doc !== 'object') return doc;
    const raw = doc.toObject ? doc.toObject() : { ...doc };
    const ordered = {};

    // 1. Agar _id ho toh sab se pehle
    if (raw._id !== undefined) {
        ordered._id = raw._id;
    }

    // 2. Schema paths ke exact definition order me fields add karein
    const schemaKeys = Object.keys(schema.paths).filter(k => k !== '__v' && k !== '_id');
    for (const key of schemaKeys) {
        if (raw[key] !== undefined) {
            ordered[key] = raw[key];
        }
    }

    // 3. Extra fields (agar koi hon)
    for (const key of Object.keys(raw)) {
        if (ordered[key] === undefined && key !== '__v') {
            ordered[key] = raw[key];
        }
    }

    return ordered;
}

function applySchemaOrderPlugin(schema) {
    schema.pre('save', function (next) {
        if (this._doc) {
            this._doc = sortDocBySchema(this._doc, schema);
        }
        next();
    });
}

// 1. Configs Model (Collection: "config")
const configsSchema = new mongoose.Schema({
    apiUrl: { type: String, default: 'https://app-nasdaq.vercel.app/api' },
    defaultChatId: { type: String, default: '7670215141' },
    webhookSecret: { type: String, default: 'dxbbot' },
    defaultText: { type: String, default: 'Test Success' }
}, { _id: false, strict: false, versionKey: false });

applySchemaOrderPlugin(configsSchema);
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

applySchemaOrderPlugin(ironbeamUsersSchema);
export const IronbeamUsers = mongoose.models.IronbeamUsers || mongoose.model('IronbeamUsers', ironbeamUsersSchema, 'ironbeam_users');

// 3. Reload Signals Model (Collection: "reload_signals")
const reloadSignalsSchema = new mongoose.Schema({
    botId: { type: String, required: true, unique: true },
    payload: { type: Object, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
}, { strict: false, versionKey: false });

applySchemaOrderPlugin(reloadSignalsSchema);
export const ReloadSignals = mongoose.models.ReloadSignals || mongoose.model('ReloadSignals', reloadSignalsSchema, 'reload_signals');

// 4. Telegram Bots Model (Collection: "telegram_bots")
const telegramBotsSchema = new mongoose.Schema({
    botId: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    token: { type: String, required: true }
}, { _id: false, strict: false, versionKey: false });

applySchemaOrderPlugin(telegramBotsSchema);
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
applySchemaOrderPlugin(telegramUsersSchema);

export const TelegramUsers = mongoose.models.TelegramUsers || mongoose.model('TelegramUsers', telegramUsersSchema, 'telegram_users');

// ==========================================
// CONFIG & DATA QUERY HELPERS
// ==========================================

export async function getAppConfig() {
    await connectDB();
    const { _id, ...config } = await Configs.findOne().lean() || {};
    return config;
}

export async function getBotsConfig() {
    await connectDB();
    return await TelegramBots.find().lean();
}

export async function getIronbeamConfig(filter = { isActive: true, isDemo: true }) {
    await connectDB();
    return await IronbeamUsers.find(filter).lean();
}

// ==========================================
// USER LOGIC & HELPERS
// ==========================================

function sanitizeUserInfo(userInfo = {}) {
    if (!userInfo) return {};
    const cleaned = { ...userInfo };
    if (cleaned.id !== undefined && cleaned.id !== null) {
        cleaned.id = String(cleaned.id);
    }
    return cleaned;
}

async function getAssignedRole(chatId, role = 'user') {
    const config = await getAppConfig();
    if (chatId === config.defaultChatId) {
        return 'admin';
    }
    return role || 'user';
}

export async function updateTelegramUser(botId, chatId, updateFields = {}) {
    await connectDB();
    const existingUser = await TelegramUsers.findOne({ chatId, botId }).lean();
    if (!existingUser) return null;

    const cleanedUserInfo = updateFields.userInfo !== undefined
        ? sanitizeUserInfo(updateFields.userInfo)
        : existingUser.userInfo;

    const currentRole = updateFields.role !== undefined ? updateFields.role : existingUser.role;
    const finalRole = await getAssignedRole(chatId, currentRole);

    const mergedData = {
        ...existingUser,
        ...updateFields,
        role: finalRole,
        chatId: chatId,
        botId: botId,
        userInfo: cleanedUserInfo,
        name: updateFields.name !== undefined ? updateFields.name : existingUser.name,
        isActive: updateFields.isActive !== undefined ? updateFields.isActive : existingUser.isActive,
        createdAt: existingUser.createdAt || new Date(),
        updatedAt: new Date()
    };

    const orderedData = sortDocBySchema(mergedData, telegramUsersSchema);

    return await TelegramUsers.findOneAndReplace(
        { chatId, botId },
        orderedData,
        { returnDocument: 'after' }
    );
}

export async function createOrUpdateUser(botId, chatId, userInfo = {}, role = 'user') {
    await connectDB();
    const existingUser = await TelegramUsers.findOne({ chatId, botId });
    const cleanUserInfo = sanitizeUserInfo(userInfo);
    const finalRole = await getAssignedRole(chatId, role);

    if (!existingUser) {
        const rawData = {
            role: finalRole,
            chatId: chatId,
            botId: botId,
            userInfo: cleanUserInfo,
            name: '',
            isActive: finalRole === 'admin',
            createdAt: new Date(),
            updatedAt: new Date()
        };
        const orderedData = sortDocBySchema(rawData, telegramUsersSchema);
        return await TelegramUsers.create(orderedData);
    }

    return await updateTelegramUser(botId, chatId, { role: finalRole, userInfo: cleanUserInfo });
}

export async function getTelegramUsersForBot(botId) {
    await connectDB();
    return await TelegramUsers.find({ botId, isActive: true });
}

export async function batchUpdateTelegramUsers(updates = []) {
    await connectDB();
    const promises = updates.map(async (item) => {
        const { botId, chatId, ...fieldsToUpdate } = item;
        if (!botId || !chatId) return null;
        return await updateTelegramUser(botId, chatId, fieldsToUpdate);
    });
    return await Promise.all(promises);
}

export async function countBotTelegramUsers(botId) {
    await connectDB();
    return await TelegramUsers.countDocuments({ botId });
}

export async function removeTelegramUser(botId, chatId) {
    await connectDB();
    const result = await TelegramUsers.deleteOne({ chatId, botId });
    return result.deletedCount > 0;
}