import * as db from './index.js';

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
// Signal Operations
// ----------------------------------------------------

export async function checkAndSaveSignal(signalId, payload) {
    try {
        const existingSignal = await db._read(db.TelegramSignals, { id: signalId });
        if (existingSignal) {
            return false;
        }

        await db._create(db.TelegramSignals, {
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

export async function getAllSignals(options = { sort: { timestamp: 1 } }) {
    return await db._readMany(db.TelegramSignals, {}, { sort: options.sort });
}

// ----------------------------------------------------
// Config Operations
// ----------------------------------------------------

export async function getAppConfig() {
    const configDoc = await db._read(db.Configs, {});
    if (!configDoc) return {};
    const { _id, ...config } = configDoc;
    return config;
}

export async function getBotsConfig() {
    return await db._readMany(db.TelegramBots, {});
}

export async function getIronbeamConfig(filter = { isActive: true, isDemo: true }) {
    return await db._readMany(db.IronbeamUsers, filter);
}

// ----------------------------------------------------
// Telegram User Operations
// ----------------------------------------------------

export async function getTelegramUser(botId, chatId, filter = {}) {
    return await db._read(db.TelegramUsers, { chatId: String(chatId), botId, ...filter });
}

export async function getTelegramUsersForBot(botId) {
    return await db._readMany(db.TelegramUsers, { botId, isActive: true });
}

export async function countBotTelegramUsers(botId) {
    return await db._count(db.TelegramUsers, { botId });
}

export async function updateTelegramUser(botId, chatId, updateFields = {}) {
    const existingUser = await db._read(db.TelegramUsers, { chatId, botId });
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

    return await db._replace(
        db.TelegramUsers,
        { chatId, botId },
        mergedData,
        { returnDocument: 'after' }
    );
}

export async function createOrUpdateUser(botId, chatId, userInfo = {}, role = 'user') {
    const existingUser = await db._read(db.TelegramUsers, { chatId, botId });
    const cleanUserInfo = sanitizeUserInfo(userInfo);
    const finalRole = await getAssignedRole(chatId, role);

    if (!existingUser) {
        return await db._create(db.TelegramUsers, {
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
    return await db._delete(db.TelegramUsers, { chatId, botId });
}

// ----------------------------------------------------
// Reload Signal Operations
// ----------------------------------------------------

export async function consumeReloadSignal(filter = {}) {
    return await db._findOneAndDelete(db.ReloadSignals, filter);
}

export async function upsertReloadSignal(botId, payload) {
    const existingSignal = await db._read(db.ReloadSignals, { botId });
    const now = new Date();

    const reloadDoc = {
        botId,
        payload,
        createdAt: existingSignal ? existingSignal.createdAt : now,
        updatedAt: now
    };

    return await db._replace(
        db.ReloadSignals,
        { botId },
        reloadDoc,
        { upsert: true, returnDocument: 'after' }
    );
}

