import axios from 'axios';
import { connectDB, getIronbeamConfig } from './db.js';

const wait = (seconds) => {
    return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
};

// Centralized Payload Generator with switch case
function generateOrderPayload(ibConfig, { side, price, tp, sl }, orderType = "MARKET") {
    const basePayload = {
        accountId: ibConfig.accountId,
        exchSym: ibConfig.symbol,
        quantity: 1,
        side: side === 'LONG' ? "BUY" : "SELL",
        duration: "DAY",
    };

    switch (orderType.toUpperCase()) {
        case "MARKET": {
            const entryPrice = Number(price);
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
                limitPrice: Number(price),
                takeProfit: Number(tp),
                stopLoss: Number(sl),
            };
        }
        case "STOP": {
            return {
                ...basePayload,
                orderType: "STOP",
                stopPrice: Number(price),
                takeProfit: Number(tp),
                stopLoss: Number(sl),
            };
        }
        default: {
            // Default fallback to MARKET with calculated offsets
            const entryPrice = Number(price);
            const takeProfitOffset = Math.abs(Number(tp) - entryPrice);
            const stopLossOffset = Math.abs(entryPrice - Number(sl));

            return {
                ...basePayload,
                orderType: "MARKET",
                stopLossOffset: Number(stopLossOffset.toFixed(2)),
                takeProfitOffset: Number(takeProfitOffset.toFixed(2))
            };
        }
    }
}

// 1. Authentication (Token Lena)
async function getAuthToken(ibConfig) {
    try {
        const response = await axios.post(`${ibConfig.apiUrl}/auth`, {
            username: ibConfig.username,
            password: ibConfig.password,
            apiKey: ibConfig.apiKey
        });
        return response.data.token;
    } catch (error) {
        console.error(`Auth Token Error for [${ibConfig.accountId}]:`, error.response?.data || error.message);
        throw new Error(`Failed to authenticate account ${ibConfig.accountId}: ${error.response?.data?.message || error.message}`);
    }
}

// 2. Open Positions Check Karna
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
            console.warn(`Active position already exists for ${ibConfig.symbol} on account [${ibConfig.accountId}]`, activePosition);
            return true;
        }

        return false;
    } catch (error) {
        console.error(`Error checking positions for [${ibConfig.accountId}]:`, error.response?.data || error.message);
        // Safety check: agar endpoint error de toh accidental double trade rokne ke liye true return karein
        return true;
    }
}

// 3. Close All Open Positions and Orders 
async function flattenAll(token, ibConfig) {
    try {
        const headers = { "Authorization": `Bearer ${token}` };

        // 1. Saare active orders fetch karke cancel karna
        const ordersRes = await axios.get(`${ibConfig.apiUrl}/order/${ibConfig.accountId}/ANY`, { headers });
        const ordersData = ordersRes.data.orders || ordersRes.data || [];

        const activeOrders = ordersData.filter(o =>
            ["NEW", "SUBMITTED", "PENDING_NEW"].includes(o.status || o.st)
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
            console.log(`✅ All active orders cancelled for [${ibConfig.accountId}].`);
        }

        // 2. Open positions fetch karke quantity ke sign se close karna
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
                console.log(`✅ Position closed successfully for ${ibConfig.symbol} on [${ibConfig.accountId}]`);
            }
        }

        const message = `[${ibConfig.accountId}] Positions cleared at ${new Date().toISOString()}`;
        console.log(message)

        return { success: true, message };
    } catch (error) {
        console.error(`Error in flattenAll for [${ibConfig.accountId}]:`, error.response?.data || error.message);
        throw new Error(error.response?.data?.message || error.message);
    }
}

// 4. Generic Order Execution Function (with Wait/Retry for Exit completion)
async function placeOrder(token, payload, ibConfig) {
    const maxRetries = 5;
    const delaySeconds = 1;

    for (let i = 0; i < maxRetries; i++) {
        const isPositionOpen = await hasOpenPosition(token, ibConfig);

        if (!isPositionOpen) {
            // Position close ho chuki hai, ab loop se nikal kar order place karo
            break;
        }

        if (i === maxRetries - 1) {
            // Agar saari retries khatam ho jayen phir bhi position close nahi hui
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
        console.log(`✅ Order Placed Successfully for [${ibConfig.accountId}]:`, response.data);
        return { success: true, data: response.data };
    } catch (error) {
        console.error(`❌ Order Execution Error for [${ibConfig.accountId}]:`, error.response?.data || error.message);
        throw new Error(error.response?.data?.message || error.message);
    }
}

// 5. Har Ironbeam account ke liye isolated trade execution
async function executeTradeForUser(ibConfig, { action, side, price, tp, sl }) {
    try {
        const token = await getAuthToken(ibConfig);

        switch (action.toUpperCase()) {
            case 'ENTRY': {
                const payload = generateOrderPayload(ibConfig, { side, price, tp, sl });

                console.log(`Ironbeam:`, payload);
                console.log(`\n`);

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
                console.log(`[${ibConfig.accountId}] Closing ${ibConfig.symbol} positions..`);
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
        console.error(`Trade execution failed for [${ibConfig.accountId}]:`, err.message);
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

    console.log(`Payload:`, req.body);
    console.log(`\n`);

    try {
        await connectDB();

        // Filter users: isActive: true aur isDemo: true
        const ironbeamUsers = await getIronbeamConfig({ isActive: true, isDemo: true });

        if (!ironbeamUsers || ironbeamUsers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No active Ironbeam accounts found matching criteria (isActive: true, isDemo: true)'
            });
        }

        const { id, timestamp, side, action, price, tp, sl } = req.body || {};

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

        // Har account ke liye isolated trade execution (without any conflict or mixup)
        const executionPromises = ironbeamUsers.map(user =>
            executeTradeForUser(user, { action, side, price, tp, sl })
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
        console.error("Handler Error:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}