import cors from './cors.js';
import axios from 'axios';
import { getTimezone, isWeekend, isMaintenanceWindow, isSignalExpired } from './utils.js';

import * as db from '../mongo/db.js';

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
    try {
        if (isWeekend()) {
            return res.status(200).json({
                success: false,
                message: 'Market is closed on weekends (Saturday/Sunday).'
            });
        }

        // 1. Fetch active Ironbeam accounts
        const ironbeamUsers = await fetchIronbeamActiveUsers();
        if (!ironbeamUsers?.length) {
            return res.status(404).json({
                success: false,
                message: 'No active Ironbeam accounts found matching criteria (isActive: true, isDemo: true)'
            });
        }

        // 2. Extract and validate body parameters
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

        // 3. Sandbox / Expiry & Processed Checks
        if (!sandbox) {
            if (isSignalExpired(timestamp)) {
                return res.status(409).json({ success: false, signalId: id, message: 'Signal expired.' });
            }

            if (id) {
                const isProcessed = await isSignalProcessed(id, req.body);
                if (isProcessed) {
                    return res.status(200).json({
                        success: false,
                        signalId: id,
                        message: 'Signal already processed'
                    });
                }
            }
        }

        // 4. Check Maintenance Window (2:00 AM - 3:00 AM): Save to DB but DO NOT execute trades
        if (isMaintenanceWindow()) {
            return res.status(200).json({
                success: true,
                message: 'Signal received and saved to DB, but trade execution skipped due to maintenance window (2:00 AM - 3:00 AM).'
            });
        }

        // 5. Execute trades for all active users
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

    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}

// ==========================================
// BACKGROUND CRON / POLLING HELPER
// ==========================================

async function checkAndAutoFlattenAt130() {
    try {
        const currentTime = getTimezone();
        const hours = currentTime.hours();
        const minutes = currentTime.minutes();

        // 1:30 AM ya uske baad ka time check karne ke liye
        if (hours === 1 && minutes >= 30) {
            const ironbeamUsers = await fetchIronbeamActiveUsers();
            if (!ironbeamUsers?.length) return;

            for (const user of ironbeamUsers) {
                try {
                    const token = await getAuthToken(user);
                    await flattenAll(token, user);
                    console.log(`[Auto-Flatten 1:30] Positions cleared for account [${user.accountId}]`);
                } catch (err) {
                    console.error(`[Auto-Flatten Error] Account [${user.accountId}]: ${err.message}`);
                }
            }
        }
    } catch (error) {
        console.error('Error in checkAndAutoFlattenAt130:', error.message);
    }
}

// ==========================================
// HELPER FUNCTIONS (Consistent Naming)
// ==========================================

async function fetchIronbeamActiveUsers() {
    try {
        return await db.getIronbeamConfig({ isActive: true, isDemo: true });
    } catch (error) {
        throw new Error(`Failed to fetch Ironbeam config: ${error.message}`);
    }
}

function validateAction(action) {
    const normalizedAction = action.toUpperCase();
    if (normalizedAction !== 'ENTRY' && normalizedAction !== 'EXIT') {
        return { error: '"action" must be ENTRY or EXIT.' };
    }
    return { value: normalizedAction };
}

function validateSide(action, side) {
    if (action === 'ENTRY') {
        const normalizedSide = side?.toUpperCase();
        if (normalizedSide !== 'LONG' && normalizedSide !== 'SHORT') {
            return { error: '"side" must be LONG or SHORT.' };
        }
        return { value: normalizedSide };
    }
    return { value: side };
}

async function isSignalProcessed(id, body) {
    const isNewSignal = await db.storeSignal(id, body);
    return !isNewSignal;
}

async function executeTradeForUser(ibConfig, { action, side, price, tp, sl, orderType }) {
    try {
        const token = await getAuthToken(ibConfig);

        if (action === 'ENTRY') {
            await flattenAll(token, ibConfig);

            const { orderType: resolvedOrderType, marketPrice } = await determineOrderType(token, ibConfig, { side, price }, orderType);
            let resolvedEntryPrice = price;

            if (resolvedOrderType === 'MARKET' && marketPrice !== null) {
                resolvedEntryPrice = marketPrice;
            }

            const payload = generateOrderPayload(ibConfig, { side, resolvedEntryPrice, tp, sl }, resolvedOrderType);
            const orderResult = await placeOrder(token, payload, ibConfig);

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
            await flattenAll(token, ibConfig);
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

async function getAuthToken(ibConfig) {
    try {
        const response = await axios.post(`${ibConfig.apiUrl}/auth`, {
            username: ibConfig.username,
            password: ibConfig.password,
            apiKey: ibConfig.apiKey
        });
        return response.data.token;
    } catch (error) {
        throw new Error(`Failed to authenticate account ${ibConfig.accountId}: ${error.response?.data?.message || error.message}`);
    }
}

async function getLiveMarketPrice(token, ibConfig) {
    try {
        const response = await axios.get(`${ibConfig.apiUrl}/market/quotes`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { symbols: ibConfig.symbol }
        });

        const quotes = response.data.Quotes || response.data.quotes || response.data || [];
        const quoteObj = quotes.find(q => (q.s === ibConfig.symbol || q.symbol === ibConfig.symbol));
        const marketPrice = quoteObj?.l !== undefined ? quoteObj.l : quoteObj?.lastPrice;

        return marketPrice !== undefined && marketPrice !== null ? Number(marketPrice) : null;
    } catch (error) {
        return null;
    }
}

async function determineOrderType(token, ibConfig, { side, price }, requestedOrderType) {
    if (requestedOrderType?.trim()) {
        const customType = requestedOrderType.toUpperCase();
        const marketPrice = customType === 'MARKET' ? await getLiveMarketPrice(token, ibConfig) : null;
        return { orderType: customType, marketPrice };
    }

    const marketPrice = await getLiveMarketPrice(token, ibConfig);
    if (marketPrice === null) {
        return { orderType: 'LIMIT', marketPrice: null };
    }

    const sigPrice = Number(price);
    const upperSide = side.toUpperCase();

    if (upperSide === 'LONG') {
        return { orderType: sigPrice <= marketPrice ? 'LIMIT' : 'STOP', marketPrice };
    }

    if (upperSide === 'SHORT') {
        return { orderType: sigPrice >= marketPrice ? 'LIMIT' : 'STOP', marketPrice };
    }

    return { orderType: 'LIMIT', marketPrice };
}

function generateOrderPayload(ibConfig, { side, resolvedEntryPrice, tp, sl }, orderType = 'LIMIT') {
    const basePayload = {
        accountId: ibConfig.accountId,
        exchSym: ibConfig.symbol,
        quantity: 1,
        side: side === 'LONG' ? 'BUY' : 'SELL',
        duration: 'DAY'
    };

    const normalizedType = orderType.toUpperCase();

    if (normalizedType === 'MARKET') {
        const entryPrice = Number(resolvedEntryPrice);
        const takeProfitOffset = Math.abs(Number(tp) - entryPrice);
        const stopLossOffset = Math.abs(entryPrice - Number(sl));

        return {
            ...basePayload,
            orderType: 'MARKET',
            stopLossOffset: Number(stopLossOffset.toFixed(2)),
            takeProfitOffset: Number(takeProfitOffset.toFixed(2))
        };
    }

    if (normalizedType === 'STOP') {
        return {
            ...basePayload,
            orderType: 'STOP',
            stopPrice: Number(resolvedEntryPrice),
            takeProfit: Number(tp),
            stopLoss: Number(sl)
        };
    }

    return {
        ...basePayload,
        orderType: 'LIMIT',
        limitPrice: Number(resolvedEntryPrice),
        takeProfit: Number(tp),
        stopLoss: Number(sl)
    };
}

async function hasOpenPosition(token, ibConfig) {
    try {
        const response = await axios.get(`${ibConfig.apiUrl}/account/${ibConfig.accountId}/positions`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const positions = response.data.positions || response.data || [];
        return positions.some(
            p => (p.symbol === ibConfig.symbol || p.exchSym === ibConfig.symbol) && p.quantity !== 0
        );
    } catch (error) {
        return true;
    }
}

async function flattenAll(token, ibConfig) {
    const headers = { Authorization: `Bearer ${token}` };

    const ordersRes = await axios.get(`${ibConfig.apiUrl}/order/${ibConfig.accountId}/ANY`, { headers });
    const ordersData = ordersRes.data.orders || ordersRes.data || [];

    const ORDER_STATUS_ACTIVE = new Set(['NEW', 'SUBMITTED', 'PENDING_NEW', 'QUEUED_NEW', 'ACCEPTED_FOR_BIDDING']);

    const activeOrders = ordersData.filter(o => ORDER_STATUS_ACTIVE.has(o.status || o.st));
    const activeOrderIds = activeOrders.map(o => o.orderId || o.oid);

    if (activeOrderIds.length > 0) {
        await axios.delete(`${ibConfig.apiUrl}/order/${ibConfig.accountId}/cancelMultiple`, {
            headers,
            data: {
                accountId: ibConfig.accountId,
                orderIds: activeOrderIds
            }
        });
    }

    const posRes = await axios.get(`${ibConfig.apiUrl}/account/${ibConfig.accountId}/positions`, { headers });
    const positions = posRes.data.positions || posRes.data || [];

    for (const pos of positions) {
        const sym = pos.symbol || pos.exchSym || pos.s;
        const qty = pos.quantity !== undefined ? pos.quantity : pos.q;

        if (sym === ibConfig.symbol && qty && qty !== 0) {
            const closePayload = {
                accountId: ibConfig.accountId,
                exchSym: ibConfig.symbol,
                side: qty > 0 ? 'SELL' : 'BUY',
                quantity: Math.abs(qty),
                orderType: 'MARKET',
                duration: 'DAY',
                waitForOrderId: true
            };

            await axios.post(`${ibConfig.apiUrl}/order/${ibConfig.accountId}/place`, closePayload, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            });
        }
    }

    return { success: true };
}

async function placeOrder(token, payload, ibConfig) {
    const maxRetries = 5;
    const delaySeconds = 1;

    for (let i = 0; i < maxRetries; i++) {
        const isPositionOpen = await hasOpenPosition(token, ibConfig);
        if (!isPositionOpen) break;

        if (i === maxRetries - 1) {
            return {
                success: false,
                message: `Order Rejected: Position currently active for [${ibConfig.accountId}] after several retry attempts`
            };
        }

        await delay(delaySeconds);
    }

    try {
        const response = await axios.post(`${ibConfig.apiUrl}/order/${ibConfig.accountId}/place`, payload, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            }
        });
        return { success: true, data: response.data };
    } catch (error) {
        throw new Error(error.response?.data?.message || error.message);
    }
}

function delay(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}