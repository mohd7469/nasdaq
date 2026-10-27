import {
    connect,
    Configs,
    IronbeamUsers,
    ReloadSignals,
    TelegramBots,
    TelegramUsers,
    TelegramSignals
} from './index.js';

// ----------------------------------------------------
// Signal Operations
// ----------------------------------------------------

export async function checkAndSaveSignal(signalId, payload) {
    await connect();
    try {
        const existingSignal = await TelegramSignals.findOne({ id: signalId }).lean();
        if (existingSignal) {
            return false;
        }

        await TelegramSignals.create({
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
    await connect();
    return await TelegramSignals.find().sort(options.sort).lean();
}

// ----------------------------------------------------
// Config Operations
// ----------------------------------------------------

export async function getAppConfig() {
    await connect();
    const configDoc = await Configs.findOne().lean();
    if (!configDoc) return {};
    const { _id, ...config } = configDoc;
    return config;
}

export async function getBotsConfig() {
    await connect();
    return await TelegramBots.find().lean();
}

export async function getIronbeamConfig(filter = { isActive: true, isDemo: true }) {
    await connect();
    return await IronbeamUsers.find(filter).lean();
}

// ----------------------------------------------------
// Telegram User Operations
// ----------------------------------------------------

export async function getTelegramUser(botId, chatId, filter = {}) {
    await connect();
    return await TelegramUsers.findOne({ chatId: String(chatId), botId, ...filter }).lean();
}

export async function getTelegramUsersForBot(botId) {
    await connect();
    return await TelegramUsers.find({ botId, isActive: true });
}

export async function countBotTelegramUsers(botId) {
    await connect();
    return await TelegramUsers.countDocuments({ botId });
}

export async function updateTelegramUser(botId, chatId, updateFields = {}) {
    await connect();
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
        chatId,
        botId,
        userInfo: cleanedUserInfo,
        name: updateFields.name !== undefined ? updateFields.name : existingUser.name,
        isActive: updateFields.isActive !== undefined ? updateFields.isActive : existingUser.isActive,
        createdAt: existingUser.createdAt || new Date(),
        updatedAt: new Date()
    };

    delete mergedData._id;

    return await TelegramUsers.findOneAndReplace(
        { chatId, botId },
        mergedData,
        { returnDocument: 'after' }
    );
}

export async function createOrUpdateUser(botId, chatId, userInfo = {}, role = 'user') {
    await connect();
    const existingUser = await TelegramUsers.findOne({ chatId, botId });
    const cleanUserInfo = sanitizeUserInfo(userInfo);
    const finalRole = await getAssignedRole(chatId, role);

    if (!existingUser) {
        return await TelegramUsers.create({
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
    await connect();
    const promises = updates.map(async ({ botId, chatId, ...fieldsToUpdate }) => {
        if (!botId || !chatId) return null;
        return await updateTelegramUser(botId, chatId, fieldsToUpdate);
    });
    return await Promise.all(promises);
}

export async function removeTelegramUser(botId, chatId) {
    await connect();
    const result = await TelegramUsers.deleteOne({ chatId, botId });
    return result.deletedCount > 0;
}

// ----------------------------------------------------
// Reload Signal Operations
// ----------------------------------------------------

export async function consumeReloadSignal(filter = {}) {
    await connect();
    return await ReloadSignals.findOneAndDelete(filter);
}

export async function upsertReloadSignal(botId, payload) {
    await connect();
    const existingSignal = await ReloadSignals.findOne({ botId }).lean();
    const now = new Date();

    const reloadDoc = {
        botId,
        payload,
        createdAt: existingSignal ? existingSignal.createdAt : now,
        updatedAt: now
    };

    return await ReloadSignals.findOneAndReplace(
        { botId },
        reloadDoc,
        { upsert: true, returnDocument: 'after' }
    );
}

// ----------------------------------------------------
// Internal Helpers
// ----------------------------------------------------

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
    return chatId === config.defaultChatId ? 'admin' : (role || 'user');
}
