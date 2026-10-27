import {
    connectDB,
    Configs,
    IronbeamUsers,
    ReloadSignals,
    TelegramBots,
    TelegramUsers,
    TelegramSignals
} from './index.js';

// ==========================================
// SIGNAL OPERATIONS
// ==========================================

export async function checkAndSaveSignal(signalId, payload) {
    await connectDB();
    try {
        const existingSignal = await TelegramSignals.findOne({ id: signalId }).lean();
        if (existingSignal) {
            return false; // Signal pehle se process ho chuka hai
        }

        await TelegramSignals.create({
            ...payload,
            createdAt: new Date()
        });
        return true; // Naya signal hai, execute hoga
    } catch (error) {
        if (error.code === 11000) {
            return false; // Duplicate key error handling
        }
        throw error;
    }
}

export async function getAllSignals(options = { sort: { timestamp: 1 } }) {
    await connectDB();
    return await TelegramSignals.find().sort(options.sort).lean();
}

// ==========================================
// CONFIG & DATA QUERY HELPERS
// ==========================================

export async function getAppConfig() {
    await connectDB();
    const configDoc = await Configs.findOne().lean();
    if (!configDoc) return {};
    const { _id, ...config } = configDoc;
    return config;
}

export async function getBotsConfig() {
    await connectDB();
    return await TelegramBots.find().lean();
}

export async function getBotsSummary() {
    await connectDB();
    return await TelegramBots.find({}, 'botId name').lean();
}

export async function getIronbeamConfig(filter = { isActive: true, isDemo: true }) {
    await connectDB();
    return await IronbeamUsers.find(filter).lean();
}

// ==========================================
// USER LOGIC & OPERATIONS
// ==========================================

export async function getTelegramUser(botId, chatId, filter = {}) {
    await connectDB();
    return await TelegramUsers.findOne({ chatId: String(chatId), botId, ...filter }).lean();
}

export async function getTelegramUsersForBot(botId) {
    await connectDB();
    return await TelegramUsers.find({ botId, isActive: true });
}

export async function countBotTelegramUsers(botId) {
    await connectDB();
    return await TelegramUsers.countDocuments({ botId });
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

    delete mergedData._id;

    return await TelegramUsers.findOneAndReplace(
        { chatId, botId },
        mergedData,
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
        return await TelegramUsers.create(rawData);
    }

    return await updateTelegramUser(botId, chatId, { role: finalRole, userInfo: cleanUserInfo });
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

export async function removeTelegramUser(botId, chatId) {
    await connectDB();
    const result = await TelegramUsers.deleteOne({ chatId, botId });
    return result.deletedCount > 0;
}

// ==========================================
// RELOAD SIGNAL OPERATIONS
// ==========================================

export async function consumeReloadSignal(filter = {}) {
    await connectDB();
    return await ReloadSignals.findOneAndDelete(filter);
}

export async function upsertReloadSignal(botId, payload) {
    await connectDB();
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

// ==========================================
// INTERNAL HELPERS
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
