import { connectDB, getAppConfig, getBotsConfig, createOrUpdateUser, ReloadSignals } from './db.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-Bot-Api-Secret-Token');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        await connectDB();
        const appConfig = await getAppConfig();
        const botsConfig = await getBotsConfig();

        // =====================================================================
        // 1. CLIENT CHECK (GET):
        // =====================================================================
        if (req.method === 'GET') {
            const targetBot = req.query?.bot;
            const filter = targetBot ? { botId: targetBot } : {};

            // Database se reload signal dhoondain aur foran delete (consume) kardein
            const reloadDoc = await ReloadSignals.findOneAndDelete(filter);

            if (reloadDoc) {
                return res.status(200).json(true);
            }

            return res.status(200).json(false);
        }

        // =====================================================================
        // 2. TELEGRAM WEBHOOK (POST): Telegram bot se user message aane par
        // =====================================================================
        if (req.method === 'POST') {
            const botId = req.query?.bot;
            const secretHeader = req.headers['x-telegram-bot-api-secret-token'];

            if (secretHeader && secretHeader !== appConfig.webhookSecret) {
                return res.status(401).json({ error: 'Unauthorized secret token' });
            }

            const message = req.body?.message;
            if (!message || !message.text) {
                return res.status(200).json({ status: 'Ignored, not a text message' });
            }

            const rawText = message.text.trim();
            const cleanText = rawText.toLowerCase();
            const chatId = String(message.chat.id);
            const userInfo = message.from || {};
            const botConfig = botId ? botsConfig.find(b => b.botId === botId) : null;

            const reloadCommands = ['reload', 'refresh', '/reload', '/refresh'];

            if (reloadCommands.includes(cleanText)) {
                if (botId) {
                    await createOrUpdateUser(botId, chatId, userInfo);
                }

                const reloadPayload = {
                    bot: botId || 'unknown',
                    botName: botConfig ? botConfig.name : (botId || 'Unknown Bot'),
                    command: rawText,
                    chatId: chatId,
                    from: userInfo,
                    timestamp: Date.now()
                };

                if (botId) {
                    await ReloadSignals.findOneAndUpdate(
                        { botId },
                        { botId, payload: reloadPayload, updatedAt: new Date() },
                        { upsert: true, new: true }
                    );
                }

                console.log(`[Reload] Triggered by ${botId} (${rawText}) from chat ${chatId}`);

                return res.status(200).json({
                    status: 'OK',
                    message: 'Reload signal stored successfully'
                });
            }

            return res.status(200).json({
                status: 'Ignored',
                message: `Text "${rawText}" is not a reload command`
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (err) {
        console.error('Reload API Error:', err.message);
        return res.status(500).json({ error: err.message });
    }
}