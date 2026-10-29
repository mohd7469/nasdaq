import cors from './cors.js';
import * as db from '../mongo/db.js';
import * as ib from './ironbeam/_index.js';

export default async function handler(req, res) {
    if (cors(req, res)) {
        return;
    }

    try {
        if (req.method === 'GET') {
            return await handleGet(req, res);
        }

        return await handlePost(req, res);
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

async function handleGet(req, res) {
    try {
        const signals = await db.getTradingSignals({ sort: { timestamp: 1 } });
        return res.status(200).json({ success: true, signals });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

async function handlePost(req, res) {
    const ironbeamUsers = await db.getIronbeamConfig({ isActive: true, isDemo: true });
    if (!ironbeamUsers?.length) {
        return res.status(404).json({
            success: false,
            message: 'No active Ironbeam accounts found matching criteria (isActive: true, isDemo: true)'
        });
    }

    const { id, timestamp, action, side, price, tp, sl, orderType, sandbox } = req.body || {};

    if (!action) {
        return res.status(400).json({ success: false, message: '"action" parameter is required' });
    }

    const normalizedAction = action.toUpperCase();
    if (normalizedAction !== 'ENTRY' && normalizedAction !== 'EXIT') {
        return res.status(400).json({ success: false, message: '"action" must be ENTRY or EXIT.' });
    }

    if (normalizedAction === 'ENTRY' && side?.toUpperCase() !== 'LONG' && side?.toUpperCase() !== 'SHORT') {
        return res.status(400).json({ success: false, message: '"side" must be LONG or SHORT.' });
    }

    // for api testing - temporary bypass signal expiration/trigger check 
    if (!sandbox && id) {
        const validationResult = ib.validateSignal({ timestamp, id, action, side, body: req.body });
        if (!validationResult.isValid) {
            return res.status(validationResult.status).json(validationResult.payload);
        }

        const isNewSignal = await ib.storeSignal(id, req.body);
        if (!isNewSignal) {
            return res.status(200).json({
                success: false,
                signalId: id,
                message: 'Signal already processed'
            });
        }
    }

    const results = await Promise.all(
        ironbeamUsers.map(user => executeTradeForUser(user, { action: normalizedAction, side, price, tp, sl, orderType }))
    );

    const successfulCount = results.filter(r => r.success).length;

    return res.status(200).json({
        success: successfulCount > 0,
        message: `Position active on ${successfulCount}/${ironbeamUsers.length} accounts`,
        results
    });
}

async function executeTradeForUser(ibConfig, { action, side, price, tp, sl, orderType }) {
    try {
        const token = await ib.getAuthToken(ibConfig);

        if (action === 'ENTRY') {
            await ib.flattenAll(token, ibConfig);

            const { orderType: resolvedOrderType, marketPrice } = await ib.determineOrderType(token, ibConfig, { side, price }, orderType);
            let resolvedEntryPrice = price;

            if (resolvedOrderType === 'MARKET') {
                if (marketPrice !== null) {
                    resolvedEntryPrice = marketPrice;
                }
            }

            const payload = ib.generatePayload(ibConfig, { side, resolvedEntryPrice, tp, sl }, resolvedOrderType);
            const orderResult = await ib.placeOrder(token, payload, ibConfig);

            if (!orderResult.success) {
                return {
                    success: false,
                    accountId: ibConfig.accountId,
                    symbol: ibConfig.symbol,
                    message: orderResult.message || 'Order rejected',
                    details: orderResult
                };
            }

            return {
                accountId: ibConfig.accountId,
                symbol: ibConfig.symbol,
                success: true,
                message: `${ibConfig.symbol}: 1 ${side} futures contract opened on account [${ibConfig.accountId}] at ${new Date().toISOString()}`,
                details: orderResult.data
            };
        }

        if (action === 'EXIT') {
            await ib.flattenAll(token, ibConfig);
            return {
                success: true,
                accountId: ibConfig.accountId,
                symbol: ibConfig.symbol,
                message: `[${ibConfig.accountId}] Positions cleared at ${new Date().toISOString()}`
            };
        }

        throw new Error(`Unsupported action: ${action}`);
    } catch (err) {
        return {
            success: false,
            accountId: ibConfig.accountId,
            symbol: ibConfig.symbol,
            error: err.message
        };
    }
}


