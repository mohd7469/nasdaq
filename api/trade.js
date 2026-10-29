import cors from './cors.js';
import * as db from '../mongo/db.js';
import * as ib from './ironbeam/_index.js';

import { isWeekend, isMaintenanceWindow, validateAction, validateSide } from '../utils.js';

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
    const { id, timestamp, action, side, price, tp, sl, orderType, sandbox } = req.body || {};

    if (!action) {
        return res.status(400).json({ success: false, message: '"action" parameter is required' });
    }

    const normalizedAction = validateAction(action);
    if (normalizedAction.error) {
        return res.status(400).json({ success: false, message: normalizedAction.error });
    }

    const normalizedSide = validateSide(normalizedAction.value, side);
    if (normalizedSide.error) {
        return res.status(400).json({ success: false, message: normalizedSide.error });
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

    if (isWeekend()) {
        return res.status(200).json({
            success: false,
            message: 'Market is closed on weekends'
        });
    }

    if (isMaintenanceWindow()) {
        return res.status(200).json({
            success: true,
            message: 'Trade execution skipped due to maintenance window (2:00 AM - 3:00 AM).'
        });
    }

    const ironbeamUsers = await ib.getTradingAccounts();
    if (!ironbeamUsers?.length) {
        return res.status(404).json({
            success: false,
            message: 'No active Ironbeam accounts found matching criteria (isActive: true, isDemo: true)'
        });
    }

    const results = await Promise.all(
        ironbeamUsers.map(user => executeTradeForUser(user, {
            action: normalizedAction.value,
            side: normalizedSide.value,
            price,
            tp,
            sl,
            orderType
        }))
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

            if (resolvedOrderType === 'MARKET' && marketPrice !== null) {
                resolvedEntryPrice = marketPrice;
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
                message: `${ibConfig.symbol}: 1 ${side} futures contract opened on account [${ibConfig.accountId}] at ${getTimezone().toISOString()}`,
                details: orderResult.data
            };
        }

        if (action === 'EXIT') {
            await ib.flattenAll(token, ibConfig);
            return {
                success: true,
                accountId: ibConfig.accountId,
                symbol: ibConfig.symbol,
                message: `[${ibConfig.accountId}] Positions cleared at ${getTimezone().toISOString()}`
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


