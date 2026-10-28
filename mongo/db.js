import * as mongo from './index.js';

function toArray(data) {
    if (!data) return [];
    return Array.isArray(data) ? data : [data];
}

async function sanitizeUserInfo(userInfo = {}) {
    if (!userInfo) return {};
    const cleaned = { ...userInfo };
    if (cleaned.id !== undefined && cleaned.id !== null) {
        cleaned.id = String(cleaned.id);
    }
    return cleaned;
}

async function getAssignedRole(chatId, role = 'user') {
    const config = await getAppConfig();
    return chatId === config.defaultChatId ? 'admin' : (role || 'user');
}

// ----------------------------------------------------
// Config
// ----------------------------------------------------

export async function resetAppConfig(data = []) {
    await mongo._deleteMany(mongo.Configs, {});
    return await mongo._createMany(mongo.Configs, toArray(data));
}

export async function getAppConfig() {
    const configDoc = await mongo._read(mongo.Configs, {});
    if (!configDoc) return {};
    const { _id, ...config } = configDoc;
    return config;
}

// ----------------------------------------------------
// Telegram Bots
// ----------------------------------------------------

export async function resetIronbeamUsers(data = []) {
    await mongo._deleteMany(mongo.IronbeamUsers, {});
    return await mongo._createMany(mongo.IronbeamUsers, toArray(data));
}

export async function getIronbeamConfig(filter = { isActive: true, isDemo: true }) {
    return await mongo._readMany(mongo.IronbeamUsers, filter);
}

// ----------------------------------------------------
// Telegram Bots
// ----------------------------------------------------

export async function getBotsConfig() {
    return await mongo._readMany(mongo.TelegramBots, {});
}

export async function resetTelegramBots(data = []) {
    await mongo._deleteMany(mongo.TelegramBots, {});
    return await mongo._createMany(mongo.TelegramBots, toArray(data));
}


// ----------------------------------------------------
// Telegram Reload
// ----------------------------------------------------

export async function resetTelegramReload(data = []) {
    await mongo._deleteMany(mongo.TelegramReload, {});
    return await mongo._createMany(mongo.TelegramReload, toArray(data));
}

export async function consumeTelegramReload(filter = {}) {
    return await mongo._findOneAndDelete(mongo.TelegramReload, filter);
}

export async function upsertTelegramReload(botId, payload) {
    const existingSignal = await mongo._read(mongo.TelegramReload, { botId });
    const now = new Date();

    const reloadDoc = {
        botId,
        payload,
        createdAt: existingSignal ? existingSignal.createdAt : now,
        updatedAt: now
    };

    return await mongo._replace(
        mongo.TelegramReload,
        { botId },
        reloadDoc,
        { upsert: true, returnDocument: 'after' }
    );
}

// ----------------------------------------------------
// Telegram Users
// ----------------------------------------------------

export async function resetTelegramUsers(data = []) {
    await mongo._deleteMany(mongo.TelegramUsers, {});
    return await mongo._createMany(mongo.TelegramUsers, toArray(data));
}

export async function getTelegramUser(botId, chatId, filter = {}) {
    return await mongo._read(mongo.TelegramUsers, { chatId: String(chatId), botId, ...filter });
}

export async function getTelegramUsersForBot(botId) {
    return await mongo._readMany(mongo.TelegramUsers, { botId, isActive: true });
}

export async function countBotTelegramUsers(botId) {
    return await mongo._count(mongo.TelegramUsers, { botId });
}

export async function updateTelegramUser(botId, chatId, updateFields = {}) {
    const existingUser = await mongo._read(mongo.TelegramUsers, { chatId, botId });
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
        chatId,
        botId,
        userInfo: cleanedUserInfo,
        name: updateFields.name !== undefined ? updateFields.name : existingUser.name,
        isActive: updateFields.isActive !== undefined ? updateFields.isActive : existingUser.isActive,
        createdAt: existingUser.createdAt || new Date(),
        updatedAt: new Date()
    };

    delete mergedData._id;

    return await mongo._replace(
        mongo.TelegramUsers,
        { chatId, botId },
        mergedData,
        { returnDocument: 'after' }
    );
}

export async function createOrUpdateUser(botId, chatId, userInfo = {}, role = 'user') {
    const existingUser = await mongo._read(mongo.TelegramUsers, { chatId, botId });
    const cleanUserInfo = sanitizeUserInfo(userInfo);
    const finalRole = await getAssignedRole(chatId, role);

    if (!existingUser) {
        return await mongo._create(mongo.TelegramUsers, {
            role: finalRole,
            chatId,
            botId,
            userInfo: cleanUserInfo,
            name: '',
            isActive: finalRole === 'admin',
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }

    return await updateTelegramUser(botId, chatId, { role: finalRole, userInfo: cleanUserInfo });
}

export async function batchUpdateTelegramUsers(updates = []) {
    const promises = updates.map(async ({ botId, chatId, ...fieldsToUpdate }) => {
        if (!botId || !chatId) return null;
        return await updateTelegramUser(botId, chatId, fieldsToUpdate);
    });
    return await Promise.all(promises);
}

export async function removeTelegramUser(botId, chatId) {
    return await mongo._delete(mongo.TelegramUsers, { chatId, botId });
}

// ----------------------------------------------------
// Trading Signals
// ----------------------------------------------------

export async function processTradingSignal(signalId, payload) {
    try {
        const existingSignal = await mongo._read(mongo.TradingSignals, { id: signalId });
        if (existingSignal) {
            return false;
        }

        await mongo._create(mongo.TradingSignals, {
            ...payload,
            createdAt: new Date()
        });
        return true;
    } catch (error) {
        if (error.code === 11000) {
            return false;
        }
        throw error;
    }
}

export async function getTradingSignals(options = { sort: { timestamp: 1 } }) {
    return await mongo._readMany(mongo.TradingSignals, {}, { sort: options.sort });
}
