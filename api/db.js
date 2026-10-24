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
        console.log("MongoDB connected successfully");
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
    userName: { type: String, required: false, default: '' },
    isActive: { type: Boolean, required: false, default: false },
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

// Reusable Core Update Function (Sare updates ishi ke through honge taake code DRY rahy aur order maintain rahy)
async function updateUser(botId, chatId, updateFields = {}) {
    await connectDB();
    const existingUser = await User.findOne({ chatId, botId });
    if (!existingUser) return null;

    const userData = {
        role: updateFields.role !== undefined ? updateFields.role : existingUser.role,
        chatId: chatId,
        botId: botId,
        userInfo: updateFields.userInfo !== undefined ? updateFields.userInfo : existingUser.userInfo,
        userName: updateFields.userName !== undefined ? updateFields.userName : existingUser.userName,
        isActive: updateFields.isActive !== undefined ? updateFields.isActive : existingUser.isActive,
        updatedAt: new Date()
    };

    return await User.findOneAndReplace(
        { chatId, botId },
        userData,
        { returnDocument: 'after' }
    );
}

// Create or Update user (Reusable implementation)
export async function saveOrUpdateUser(botId, chatId, userInfo = {}, role = 'user') {
    await connectDB();
    const existingUser = await User.findOne({ chatId, botId });

    if (!existingUser) {
        const userData = {
            role: role,
            chatId: chatId,
            botId: botId,
            userInfo: userInfo,
            userName: '',
            isActive: false,
            updatedAt: new Date()
        };
        return await User.create(userData);
    }

    return await updateUser(botId, chatId, { role, userInfo });
}

// Read: Get all users of specific bot
export async function getUsersForBot(botId) {
    await connectDB();
    return await User.find({ botId, isActive: true });
}

// Activate or Deactivate User (Reusable implementation)
export async function setUserActiveStatus(botId, chatId, status) {
    return await updateUser(botId, chatId, { isActive: status });
}

// Manual Update: Set or update userName manually (Reusable implementation)
export async function setUserName(botId, chatId, name) {
    return await updateUser(botId, chatId, { userName: name });
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
    }

    await saveOrUpdateUser(bots[0], DEFAULT_CHAT_ID, { first_name: 'mohd' }, 'admin');
    await saveOrUpdateUser(bots[1], DEFAULT_CHAT_ID, { first_name: 'mohd' }, 'admin');

    await setUserActiveStatus(bots[0], DEFAULT_CHAT_ID, true);
    await setUserActiveStatus(bots[1], DEFAULT_CHAT_ID, true);

    await setUserName(bots[0], DEFAULT_CHAT_ID, 'mohd');
    await setUserName(bots[1], DEFAULT_CHAT_ID, 'mohd');

    await setUserName(bots[0], '8973124597', 'khurram')
    await setUserName(bots[1], '8973124597', 'khurram')
})();