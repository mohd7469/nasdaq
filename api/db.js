import mongoose from 'mongoose';
import config from './config.json' with { type: 'json' };
const { DEFAULT_CHAT_ID, BOTS_CONFIG } = config;

const bots = Object.keys(BOTS_CONFIG);

let isConnected = false;

// Centralized DB connection
export async function connectDB() {
    if (isConnected) return;
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            dbName: 'telegram_bots'
        });
        isConnected = true;
        console.log("MongoDB connected");
    } catch (error) {
        console.error("MongoDB connection error:", error);
        throw error;
    }
}

const userSchema = new mongoose.Schema({
    role: { type: String, required: true, default: 'user' },
    chatId: { type: String, required: true },
    botId: { type: String, required: true },
    userInfo: { type: Object, required: false, default: {} },
    name: { type: String, required: false, default: '' },
    isActive: { type: Boolean, required: false, default: false },
    createdAt: { type: Date, required: false, default: Date.now },
    updatedAt: { type: Date, required: false, default: Date.now }
});
userSchema.index({ chatId: 1, botId: 1 }, { unique: true });
export const User = mongoose.models.User || mongoose.model('User', userSchema);


const reloadSchema = new mongoose.Schema({
    botId: { type: String, required: true, unique: true },
    payload: { type: Object, required: true },
    updatedAt: { type: Date, default: Date.now }
});
export const ReloadSignal = mongoose.models.ReloadSignal || mongoose.model('ReloadSignal', reloadSchema);

// Helper function to sanitize userInfo and ensure id is always a String
function sanitizeUserInfo(userInfo = {}) {
    if (!userInfo) return {};
    const cleaned = { ...userInfo };
    if (cleaned.id !== undefined && cleaned.id !== null) {
        cleaned.id = String(cleaned.id); // Long ya Number ko safe String bana dega
    }
    return cleaned;
}

// Reusable Core Update Function
async function updateUser(botId, chatId, updateFields = {}) {
    await connectDB();
    const existingUser = await User.findOne({ chatId, botId });
    if (!existingUser) return null;

    const cleanedUserInfo = updateFields.userInfo !== undefined
        ? sanitizeUserInfo(updateFields.userInfo)
        : existingUser.userInfo;

    const userData = {
        role: updateFields.role !== undefined ? updateFields.role : existingUser.role,
        chatId: chatId,
        botId: botId,
        userInfo: cleanedUserInfo,
        name: updateFields.name !== undefined ? updateFields.name : existingUser.name,
        isActive: updateFields.isActive !== undefined ? updateFields.isActive : existingUser.isActive,
        createdAt: existingUser.createdAt || new Date(),
        updatedAt: new Date()
    };

    return await User.findOneAndReplace(
        { chatId, botId },
        userData,
        { returnDocument: 'after' }
    );
}

// Create or Update user (Upsert implementation)
export async function createOrUpdateUser(botId, chatId, userInfo = {}, role = 'user') {
    await connectDB();
    const existingUser = await User.findOne({ chatId, botId });
    const cleanUserInfo = sanitizeUserInfo(userInfo);

    if (!existingUser) {
        const userData = {
            role: role,
            chatId: chatId,
            botId: botId,
            userInfo: cleanUserInfo,
            name: '',
            isActive: false,
            createdAt: new Date(),
            updatedAt: new Date()
        };
        return await User.create(userData);
    }

    return await updateUser(botId, chatId, { role, userInfo: cleanUserInfo });
}

// Read: Get all users of specific bot
export async function getUsersForBot(botId) {
    await connectDB();
    return await User.find({ botId, isActive: true });
}

// Batch Update Users Method (Multiple users ko aik sath update karne ke liye)
export async function batchUpdateUsers(updates = []) {
    await connectDB();
    const promises = updates.map(async (item) => {
        const { botId, chatId, ...fieldsToUpdate } = item;
        if (!botId || !chatId) return null;
        return await updateUser(botId, chatId, fieldsToUpdate);
    });
    return await Promise.all(promises);
}

// Read: Count total users of specific bot
export async function countBotUsers(botId) {
    await connectDB();
    return await User.countDocuments({ botId });
}

// Delete: Remove specific user
export async function removeUser(botId, chatId) {
    await connectDB();
    const result = await User.deleteOne({ chatId, botId });
    return result.deletedCount > 0;
}

(async () => {
    if (!isConnected) {
        await connectDB();
        console.log("MongoDB init");
    }

    await createOrUpdateUser(bots[0], DEFAULT_CHAT_ID, { first_name: 'mohd' }, 'admin');
    await createOrUpdateUser(bots[1], DEFAULT_CHAT_ID, { first_name: 'mohd' }, 'admin');

    await batchUpdateUsers([
        { botId: bots[0], isActive: true, chatId: DEFAULT_CHAT_ID, name: 'mohd' },
        { botId: bots[1], isActive: true, chatId: DEFAULT_CHAT_ID, name: 'mohd' },
        { botId: bots[0], isActive: true, chatId: '', name: '' },
        { botId: bots[1], isActive: true, chatId: '', name: '' },
    ]);
})();