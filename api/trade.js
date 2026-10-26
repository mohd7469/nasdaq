import axios from 'axios';
import moment from 'moment';
import { connectDB, getIronbeamConfig, checkAndSaveSignal } from './db.js';

const wait = (seconds) => {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

// 1. Current Market Price Fetch karne ka outside helper function (OpenAPI /market/quotes ke mutabiq)
async function getCurrentMarketPrice(token, ibConfig) {
    try {
        const response = await axios.get(`${ibConfig.apiUrl}/market/quotes`, {
            headers: { "Authorization": `Bearer ${token}` },
            params: { symbols: ibConfig.symbol }
        });

        const quotes = response.data.Quotes || response.data.quotes || response.data || [];
        const quoteObj = quotes.find(q => (q.s === ibConfig.symbol || q.symbol === ibConfig.symbol));

        // OpenAPI QuoteFull schema ke mutabiq 'l' ya 'lastPrice' se last traded price milti hai
        const marketPrice = quoteObj?.l !== undefined ? quoteObj.l : quoteObj?.lastPrice;

        if (marketPrice !== undefined && marketPrice !== null) {
            return Number(marketPrice);
        }
        return null;
    } catch (error) {
        console.error(`❌ [${ibConfig.accountId}] Market Price Error:`, error.response?.data || error.message);
        return null;
    }
}

// 2. Automatically Order Type Determine karne ka helper function
async function determineOrderType(token, ibConfig, { side, price }, requestedOrderType) {
    // Agar request body mein orderType pehle se diya gaya hai toh wahi use hoga
    if (requestedOrderType && requestedOrderType.trim() !== "") {
        return requestedOrderType.toUpperCase();
    }

    const marketPrice = await getCurrentMarketPrice(token, ibConfig);

    // Agar market price fetch na ho paye toh safe fallback "LIMIT" ya "MARKET" rakhein
    if (marketPrice === null) {
        return "LIMIT";
    }

    const sigPrice = Number(price);
    const upperSide = side.toUpperCase();

    if (upperSide === 'LONG') {
        // LONG ke liye: agar signal price market price se kam hai toh Limit, warna Stop (breakout)
        return sigPrice <= marketPrice ? "LIMIT" : "STOP";
    } else if (upperSide === 'SHORT') {
        // SHORT ke liye: agar signal price market price se zyada hai toh Limit, warna Stop (breakdown)
        return sigPrice >= marketPrice ? "LIMIT" : "STOP";
    }

    return "LIMIT";
}

// Centralized Payload Generator with switch case
function generateOrderPayload(ibConfig, { side, resolvedEntryPrice, tp, sl }, orderType = "LIMIT") {
    const basePayload = {
        accountId: ibConfig.accountId,
        exchSym: ibConfig.symbol,
        quantity: 1,
        side: side === 'LONG' ? "BUY" : "SELL",
        duration: "DAY",
    };

    switch (orderType.toUpperCase()) {
        case "MARKET": {
            const entryPrice = Number(resolvedEntryPrice);
            const takeProfitOffset = Math.abs(Number(tp) - entryPrice);
            const stopLossOffset = Math.abs(entryPrice - Number(sl));

            return {
                ...basePayload,
                orderType: "MARKET",
                stopLossOffset: Number(stopLossOffset.toFixed(2)),
                takeProfitOffset: Number(takeProfitOffset.toFixed(2))
            };
        }
        case "LIMIT": {
            return {
                ...basePayload,
                orderType: "LIMIT",
                limitPrice: Number(resolvedEntryPrice),
                takeProfit: Number(tp),
                stopLoss: Number(sl),
            };
        }
        case "STOP": {
            return {
                ...basePayload,
                orderType: "STOP",
                stopPrice: Number(resolvedEntryPrice),
                takeProfit: Number(tp),
                stopLoss: Number(sl),
            };
        }
        default: {
            return {
                ...basePayload,
                orderType: "LIMIT",
                limitPrice: Number(resolvedEntryPrice),
                takeProfit: Number(tp),
                stopLoss: Number(sl),
            };
        }
    }
}

// 3. Authentication (Token Lena)
async function getAuthToken(ibConfig) {
    try {
        const response = await axios.post(`${ibConfig.apiUrl}/auth`, {
            username: ibConfig.username,
            password: ibConfig.password,
            apiKey: ibConfig.apiKey
        });
        return response.data.token;
    } catch (error) {
        console.error(`❌ [${ibConfig.accountId}] Auth Token Error:`, error.response?.data || error.message);
        throw new Error(`Failed to authenticate account ${ibConfig.accountId}: ${error.response?.data?.message || error.message}`);
    }
}

// 4. Open Positions Check Karna
async function hasOpenPosition(token, ibConfig) {
    try {
        const response = await axios.get(`${ibConfig.apiUrl}/account/${ibConfig.accountId}/positions`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const positions = response.data.positions || response.data || [];
        const activePosition = positions.find(
            p => (p.symbol === ibConfig.symbol || p.exchSym === ibConfig.symbol) && p.quantity !== 0
        );

        if (activePosition) {
            console.warn(`[${ibConfig.accountId}] Active position already exists for ${ibConfig.symbol}`, activePosition);
            return true;
        }

        return false;
    } catch (error) {
        console.error(`❌ [${ibConfig.accountId}] Positions Checking Error:`, error.response?.data || error.message);
        return true;
    }
}

// 5. Close All Open Positions and Orders 
async function flattenAll(token, ibConfig) {
    try {
        const headers = { "Authorization": `Bearer ${token}` };

        const ordersRes = await axios.get(`${ibConfig.apiUrl}/order/${ibConfig.accountId}/ANY`, { headers });
        const ordersData = ordersRes.data.orders || ordersRes.data || [];

        const activeOrders = ordersData.filter(o =>
            ["NEW", "SUBMITTED", "PENDING_NEW", "QUEUED_NEW", "ACCEPTED_FOR_BIDDING"].includes(o.status || o.st)
        );
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

        for (let pos of positions) {
            const sym = pos.symbol || pos.exchSym || pos.s;
            const qty = pos.quantity !== undefined ? pos.quantity : pos.q;

            if (sym === ibConfig.symbol && qty && qty !== 0) {
                const closingSide = qty > 0 ? "SELL" : "BUY";
                const closePayload = {
                    accountId: ibConfig.accountId,
                    exchSym: ibConfig.symbol,
                    side: closingSide,
                    quantity: Math.abs(qty),
                    orderType: "MARKET",
                    duration: "DAY",
                    waitForOrderId: true
                };

                await axios.post(`${ibConfig.apiUrl}/order/${ibConfig.accountId}/place`, closePayload, {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    }
                });
            }
        }

        console.log(`✅ [${ibConfig.accountId}] All pending/active orders and positions cleared`);

        return { success: true, message: `[${ibConfig.accountId}] All pending/active orders and positions cleared` };
    } catch (error) {
        console.error(`❌ [${ibConfig.accountId}] flattenAll Error:`, error.response?.data || error.message);
        throw new Error(error.response?.data?.message || error.message);
    }
}

// 6. Generic Order Execution Function (with Wait/Retry for Exit completion)
async function placeOrder(token, payload, ibConfig) {
    const maxRetries = 5;
    const delaySeconds = 1;

    for (let i = 0; i < maxRetries; i++) {
        const isPositionOpen = await hasOpenPosition(token, ibConfig);

        if (!isPositionOpen) {
            break;
        }

        if (i === maxRetries - 1) {
            const message = `Order Rejected: Position currently active for [${ibConfig.accountId}] after several retry attempts`;
            console.log(message);
            return { success: false, message };
        }

        console.log(`⏳ Waiting for previous position to close on [${ibConfig.accountId}].. (Attempt ${i + 1}/${maxRetries})`);
        await wait(delaySeconds);
    }

    try {
        const response = await axios.post(`${ibConfig.apiUrl}/order/${ibConfig.accountId}/place`, payload, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });
        console.log(`✅ [${ibConfig.accountId}] Order:`, response.data);
        return { success: true, data: response.data };
    } catch (error) {
        console.error(`❌ [${ibConfig.accountId}] Place Order Error:`, error.response?.data || error.message);
        throw new Error(error.response?.data?.message || error.message);
    }
}

// 7. Har Ironbeam account ke liye isolated trade execution
async function executeTradeForUser(ibConfig, { action, side, price, tp, sl, orderType }) {
    try {
        const token = await getAuthToken(ibConfig);

        switch (action.toUpperCase()) {
            case 'ENTRY': {
                console.log(`[${ibConfig.accountId}] Canceling Previous Orders and Positions..`);
                await flattenAll(token, ibConfig);

                // Server automatically determine karega ke LIMIT hai ya STOP (agar req.body mein na ho)
                const resolvedOrderType = await determineOrderType(token, ibConfig, { side, price }, orderType);

                // 2. Agar order type MARKET hai, toh live market price fetch karke entryPrice price banayein
                let resolvedEntryPrice = price;
                if (resolvedOrderType === 'MARKET') {
                    const liveMarketPrice = await getCurrentMarketPrice(token, ibConfig);
                    if (liveMarketPrice !== null) {
                        resolvedEntryPrice = liveMarketPrice;
                        console.log(`Using live price ${liveMarketPrice} for MARKET orderType instead of ${price}`);
                    }
                }

                const payload = generateOrderPayload(ibConfig, { side, resolvedEntryPrice, tp, sl }, resolvedOrderType);

                console.log(`Ironbeam:`, payload);

                const orderResult = await placeOrder(token, payload, ibConfig);

                if (!orderResult.success) {
                    return {
                        accountId: ibConfig.accountId,
                        symbol: ibConfig.symbol,
                        success: false,
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

            case 'EXIT': {
                console.log(`[${ibConfig.accountId}] Terminating all Active Orders and Positions..`);
                await flattenAll(token, ibConfig);
                return {
                    accountId: ibConfig.accountId,
                    symbol: ibConfig.symbol,
                    success: true,
                    message: `[${ibConfig.accountId}] Positions cleared at ${new Date().toISOString()}`
                };
            }

            default:
                throw new Error(`Unsupported action: ${action}`);
        }
    } catch (err) {
        console.error(`❌ [${ibConfig.accountId}] Trade Execution Error:`, err.message);
        return {
            accountId: ibConfig.accountId,
            symbol: ibConfig.symbol,
            success: false,
            error: err.message
        };
    }
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, message: 'Method Not Allowed' });
    }

    console.log(`----------------------------`);
    console.log(`Payload:`, req.body);

    try {
        await connectDB();

        const ironbeamUsers = await getIronbeamConfig({ isActive: true, isDemo: true });

        if (!ironbeamUsers || ironbeamUsers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No active Ironbeam accounts found matching criteria (isActive: true, isDemo: true)'
            });
        }

        const { id, timestamp, action, side, price, tp, sl, orderType } = req.body || {};

        if (!action) {
            return res.status(400).json({ success: false, message: '"action" parameter is required' });
        }

        // ignore previous day signals (if came)
        if (timestamp) {
            const signalDate = moment(timestamp);
            const today = moment().startOf('day');

            if (signalDate.isBefore(today)) {
                console.log(`Previous day signal ignored: ${timestamp}`);
                return res.status(200).json({
                    success: true,
                    message: `Signal timestamp is from a previous day.`,
                    ignored: true
                });
            }
        }

        // Duplicate signal check logic
        if (id) {
            const isNewSignal = await checkAndSaveSignal(id, req.body);
            if (!isNewSignal) {
                console.log(`Signal already processed`);
                return res.status(200).json({
                    success: true,
                    signalId: id,
                    message: `Signal already processed`,
                });
            }
        }

        const normalizedAction = action.toUpperCase();
        if (normalizedAction !== 'ENTRY' && normalizedAction !== 'EXIT') {
            return res.status(400).json({ success: false, message: '"action" must be ENTRY or EXIT.' });
        }

        if (normalizedAction === 'ENTRY' && side?.toUpperCase() !== 'LONG' && side?.toUpperCase() !== 'SHORT') {
            return res.status(400).json({ success: false, message: '"side" must be LONG or SHORT.' });
        }

        const executionPromises = ironbeamUsers.map(user =>
            executeTradeForUser(user, { action, side, price, tp, sl, orderType })
        );

        const results = await Promise.all(executionPromises);
        const successfulCount = results.filter(r => r.success).length;

        return res.status(200).json({
            status: 'OK',
            success: successfulCount > 0,
            totalAccounts: ironbeamUsers.length,
            successfulAccounts: successfulCount,
            results: results
        });

    } catch (error) {
        console.error("Trade Handler Error:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}