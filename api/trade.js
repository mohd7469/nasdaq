import axios from 'axios';
import config from './config.json' with { type: 'json' };
const { WEBHOOK_SECRET, BOTS_CONFIG } = config;

const IRONBEAM_API_URL = process.env.IRONBEAM_API_URL;
const IRONBEAM_ACCOUNT_ID = process.env.IRONBEAM_ACCOUNT_ID;
const IRONBEAM_USERNAME = process.env.IRONBEAM_USERNAME;
const IRONBEAM_PASSWORD = process.env.IRONBEAM_PASSWORD;
const IRONBEAM_API_KEY = process.env.IRONBEAM_API_KEY;
const IRONBEAM_SYMBOL = process.env.IRONBEAM_SYMBOL;

// 1. Authentication (Token Lena)
async function getAuthToken() {
    try {
        const response = await axios.post(`${IRONBEAM_API_URL}/auth`, {
            username: IRONBEAM_USERNAME,
            password: IRONBEAM_PASSWORD,
            apiKey: IRONBEAM_API_KEY
        });
        return response.data.token;
    } catch (error) {
        console.error("Auth Token Error:", error.response?.data || error.message);
        throw new Error("Failed to authenticate with Ironbeam API");
    }
}

// 2. Open Positions Check Karna
async function hasOpenPosition(token) {
    try {
        const response = await axios.get(`${IRONBEAM_API_URL}/account/${IRONBEAM_ACCOUNT_ID}/positions`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const positions = response.data.positions || response.data || [];
        const activePosition = positions.find(
            p => (p.symbol === IRONBEAM_SYMBOL || p.exchSym === IRONBEAM_SYMBOL) && p.quantity !== 0
        );

        if (activePosition) {
            console.warn(`Active position already exists for ${IRONBEAM_SYMBOL}`, activePosition);
            return true;
        }

        return false;
    } catch (error) {
        console.error("Error checking positions:", error.response?.data || error.message);
        // Safety check: agar endpoint error de toh accidental double trade rokne ke liye true return karein
        return true;
    }
}

// 3. Close All Open Positions and Orders 
async function flattenAll(token) {
    try {
        const headers = { "Authorization": `Bearer ${token}` };

        // 1. Saare active orders fetch karke cancel karna
        const ordersRes = await axios.get(`${IRONBEAM_API_URL}/order/${IRONBEAM_ACCOUNT_ID}/ANY`, { headers });
        const ordersData = ordersRes.data.orders || ordersRes.data || [];

        const activeOrders = ordersData.filter(o =>
            ["NEW", "SUBMITTED", "PENDING_NEW"].includes(o.status || o.st)
        );
        const activeOrderIds = activeOrders.map(o => o.orderId || o.oid);

        if (activeOrderIds.length > 0) {
            await axios.delete(`${IRONBEAM_API_URL}/order/${IRONBEAM_ACCOUNT_ID}/cancelMultiple`, {
                headers,
                data: {
                    accountId: IRONBEAM_ACCOUNT_ID,
                    orderIds: activeOrderIds
                }
            });
            console.log("✅ All active orders cancelled.");
        }

        // 2. Open positions fetch karke quantity ke sign se close karna
        const posRes = await axios.get(`${IRONBEAM_API_URL}/account/${IRONBEAM_ACCOUNT_ID}/positions`, { headers });
        const positions = posRes.data.positions || posRes.data || [];

        for (let pos of positions) {
            const sym = pos.symbol || pos.exchSym || pos.s;
            const qty = pos.quantity !== undefined ? pos.quantity : pos.q;

            if (sym === IRONBEAM_SYMBOL && qty && qty !== 0) {
                const closingSide = qty > 0 ? "SELL" : "BUY";
                const closePayload = {
                    accountId: IRONBEAM_ACCOUNT_ID,
                    exchSym: IRONBEAM_SYMBOL,
                    side: closingSide,
                    quantity: Math.abs(qty),
                    orderType: "MARKET",
                    duration: "DAY",
                    waitForOrderId: true
                };

                await axios.post(`${IRONBEAM_API_URL}/order/${IRONBEAM_ACCOUNT_ID}/place`, closePayload, {
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    }
                });
                console.log(`✅ Position closed successfully for ${IRONBEAM_SYMBOL}`);
            }
        }

        return { success: true, message: "Positions flattened successfully." };
    } catch (error) {
        console.error("Error in flattenAll:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || error.message);
    }
}

// 4. Generic Order Execution Function
async function placeOrder(token, payload) {
    const isPositionOpen = await hasOpenPosition(token);
    if (isPositionOpen) {
        return { success: false, message: "Rejected: Position currently active" };
    }

    try {
        const response = await axios.post(`${IRONBEAM_API_URL}/order/${IRONBEAM_ACCOUNT_ID}/place`, payload, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });
        console.log("✅ Order Placed Successfully:", response.data);
        return { success: true, data: response.data };
    } catch (error) {
        console.error("❌ Order Execution Error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.message || error.message);
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

    console.log('___________________________________________________');
    console.log('body:', req.body);
    console.log('___________________________________________________');

    try {
        const { timestamp, side, action, price, tp, sl } = req.body || {};

        if (!action) {
            return res.status(400).json({ success: false, message: 'Missing "action" in request body' });
        }

        const token = await getAuthToken();
        let resultMessage = '';

        switch (action.toUpperCase()) {
            case 'ENTRY': {
                if (side?.toUpperCase() !== 'LONG' && side?.toUpperCase() !== 'SHORT') {
                    return res.status(400).json({ success: false, message: 'Invalid side. Must be LONG or SHORT.' });
                }

                const payload = {
                    accountId: IRONBEAM_ACCOUNT_ID,
                    orderType: "MARKET",
                    exchSym: IRONBEAM_SYMBOL,
                    quantity: 1,
                    side: side === 'LONG' ? "BUY" : "SELL",
                    takeProfit: Number(tp),
                    stopLoss: Number(sl),
                    duration: "DAY"
                };

                const orderResult = await placeOrder(token, payload);
                if (!orderResult.success) {
                    return res.status(400).json(orderResult);
                }

                resultMessage = `${IRONBEAM_SYMBOL}: 1 ${side} futures contract opened at ${new Date().toISOString()}`;
                break;
            }

            case 'EXIT': {
                console.log(`Closing ${IRONBEAM_SYMBOL} Position..`);
                await flattenAll(token);
                resultMessage = `${IRONBEAM_SYMBOL}: Position closed at ${new Date().toISOString()}`;
                break;
            }

            default: {
                return res.status(400).json({ success: false, message: `Unsupported action: ${action}` });
            }
        }

        return res.status(200).json({
            status: 'OK',
            success: true,
            message: resultMessage
        });

    } catch (error) {
        console.error("Handler Error:", error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}