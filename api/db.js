import mongoose from 'mongoose';
import config from './config.json' with { type: 'json' };
const { DEFAULT_CHAT_ID, BOTS_CONFIG } = config;

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

// Create or Update user
export async function saveOrUpdateUser(botId, chatId, userInfo = {}, role = 'user') {
    await connectDB();
    return await User.findOneAndUpdate(
        { chatId, botId },
        { role, chatId, botId, userInfo, updatedAt: new Date() },
        { upsert: true, new: true }
    );
}

// Read: Get all users of specific bot
export async function getUsersForBot(botId) {
    await connectDB();
    return await User.find({ botId, isActive: true });
}

// Activate or Deactivate User
export async function setUserActiveStatus(botId, chatId, status) {
    await connectDB();
    return await User.findOneAndUpdate(
        { chatId, botId },
        { isActive: status, updatedAt: new Date() },
        { new: true }
    );
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

    console.log('Initalizing default user for bots');
    const bots = Object.keys(BOTS_CONFIG);

    await saveOrUpdateUser(bots[0], DEFAULT_CHAT_ID, { first_name: 'Mohammad'}, 'admin');
    await saveOrUpdateUser(bots[1], DEFAULT_CHAT_ID, { first_name: 'Mohammad'}, 'admin');

    await setUserActiveStatus(bots[0], DEFAULT_CHAT_ID, true);
    await setUserActiveStatus(bots[1], DEFAULT_CHAT_ID, true);
})();