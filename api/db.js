import mongoose from 'mongoose';

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
    chatId: { type: String, required: true },
    botId: { type: String, required: true },
    userInfo: { type: Object, default: {} },
    updatedAt: { type: Date, default: Date.now }
});
userSchema.index({ botId: 1, chatId: 1 }, { unique: true });
export const User = mongoose.models.User || mongoose.model('User', userSchema);


const reloadSchema = new mongoose.Schema({
    botId: { type: String, required: true, unique: true },
    payload: { type: Object, required: true },
    updatedAt: { type: Date, default: Date.now }
});
export const ReloadSignal = mongoose.models.ReloadSignal || mongoose.model('ReloadSignal', reloadSchema);

// Create or Update user
export async function saveOrUpdateUser(botId, chatId, userInfo) {
    await connectDB();
    return await User.findOneAndUpdate(
        { botId, chatId },
        { botId, chatId, userInfo, updatedAt: new Date() },
        { upsert: true, new: true }
    );
}

// Read: Get all users of specific bot
export async function getUsersForBot(botId) {
    await connectDB();
    return await User.find({ botId });
}

// Read: Count total users of specific bot
export async function countBotUsers(botId) {
    await connectDB();
    return await User.countDocuments({ botId });
}

// Delete: Remove specific user
export async function removeUser(botId, chatId) {
    await connectDB();
    const result = await User.deleteOne({ botId, chatId });
    return result.deletedCount > 0;
}