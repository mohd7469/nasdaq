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
    const response = await axios.post(`${IRONBEAM_API_URL}/auth`, {
        username: IRONBEAM_USERNAME,
        password: IRONBEAM_PASSWORD,
        apiKey: IRONBEAM_API_KEY
    });
    return response.data.token;
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
        // Safety check: agar endpoint error de toh nayi trade mat lagayein
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

        const activeOrders = ordersData
            .filter(o => o.status === "NEW" || o.status === "SUBMITTED" || o.status === "PENDING_NEW" || o.st === "NEW" || o.st === "SUBMITTED");
        const activeOrderIds = activeOrders
            .map(o => o.orderId || o.oid);


        if (activeOrderIds.length > 0) {
            await axios.delete(`${IRONBEAM_API_URL}/order/${IRONBEAM_ACCOUNT_ID}/cancelMultiple`, {
                headers,
                data: {
                    accountId: IRONBEAM_ACCOUNT_ID,
                    orderIds: activeOrderIds
                }
            });
            // console.log("activeOrders:", activeOrders);
            console.log("✅ All active orders cancelled.");
        }

        // 2. Open positions fetch karke quantity ke sign se close karna
        const posRes = await axios.get(`${IRONBEAM_API_URL}/account/${IRONBEAM_ACCOUNT_ID}/positions`, { headers });
        const positions = posRes.data.positions || posRes.data || [];

        for (let pos of positions) {
            const sym = pos.symbol || pos.exchSym || pos.s;
            const qty = pos.quantity !== undefined ? pos.quantity : pos.q;

            if (sym === IRONBEAM_SYMBOL && qty && qty !== 0) {
                // Agar quantity positive hai toh LONG (SELL se close hoga), negative hai toh SHORT (BUY se close hoga)
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

        console.log("activeOrders:", activeOrders);
        console.log("positions:", positions);
    } catch (error) {
        console.error("❌ Error in flattenAll:", error.response?.data || error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
}

// {
//   "accountId": "5123345",
//   "exchSym": "XCME:6E.U16",
//   "side": "BUY",
//   "quantity": 1,
//   "limitPrice": 2000,
//   "stopPrice": 2000,
//   "stopLoss": 2000,
//   "takeProfit": 2000,
//   "stopLossOffset": 25,
//   "takeProfitOffset": 0.01,
//   "trailingStop": 0.25,
//   "orderType": "LIMIT",
//   "duration": "1",
//   "waitForOrderId": true
// } 

// 3. Generic Order Execution Function
async function placeOrder(token, payload) {
    // Pehle check karein ke koi open position toh nahi hai
    const isPositionOpen = await hasOpenPosition(token);
    if (isPositionOpen) {
        return;
    }

    try {
        const response = await axios.post(`${IRONBEAM_API_URL}/order/${IRONBEAM_ACCOUNT_ID}/place`, payload, {
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            }
        });
        console.log("✅ Order Placed Successfully:", response.data);
    } catch (error) {
        console.error("❌ Order Execution Error:", error.response?.data || error.message);
    }
}

// const longMarketPayload = {
//   accountId: IRONBEAM_ACCOUNT_ID,
//   exchSym: IRONBEAM_SYMBOL,
//   side: "BUY",
//   orderType: "MARKET",
//   quantity: 1,
//   duration: "DAY",
//   stopLoss: {
//     orderType: "STOP",
//     stopPrice: 20400.00 // SL Entry se neeche
//   },
//   takeProfit: {
//     orderType: "LIMIT",
//     price: 20600.00     // TP Entry se upar
//   }
// };

// const longLimitPayload = {
//   accountId: IRONBEAM_ACCOUNT_ID,
//   exchSym: IRONBEAM_SYMBOL,
//   side: "BUY",
//   orderType: "LIMIT",
//   price: 20450.00,      // Specific Entry Price
//   quantity: 1,
//   duration: "DAY",
//   stopLoss: {
//     orderType: "STOP",
//     stopPrice: 20350.00 // SL Limit Price se neeche
//   },
//   takeProfit: {
//     orderType: "LIMIT",
//     price: 20650.00     // TP Limit Price se upar
//   }
// };

// const shortMarketPayload = {
//   accountId: IRONBEAM_ACCOUNT_ID,
//   exchSym: IRONBEAM_SYMBOL,
//   side: "SELL",
//   orderType: "MARKET",
//   quantity: 1,
//   duration: "DAY",
//   stopLoss: {
//     orderType: "STOP",
//     stopPrice: 20600.00 // Short mein SL Entry se upar hoga
//   },
//   takeProfit: {
//     orderType: "LIMIT",
//     price: 20400.00     // Short mein TP Entry se neeche hoga
//   }
// };

// const shortLimitPayload = {
//   accountId: IRONBEAM_ACCOUNT_ID,
//   exchSym: IRONBEAM_SYMBOL,
//   side: "SELL",
//   orderType: "LIMIT",
//   price: 20550.00,      // Specific Short Entry Price
//   quantity: 1,
//   duration: "DAY",
//   stopLoss: {
//     orderType: "STOP",
//     stopPrice: 20650.00 // SL Entry Price se upar
//   },
//   takeProfit: {
//     orderType: "LIMIT",
//     price: 20350.00     // TP Entry Price se neeche
//   }
// };


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
    console.log(req.body);
    console.log('\n');

    try {
        const token = await getAuthToken();

        const { timestamp, side, action, price, tp, sl } = req.body;

        switch (action?.toUpperCase()) {
            case 'ENTRY': {
                if (side?.toUpperCase() !== 'LONG' && side?.toUpperCase() !== 'SHORT') break;

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

                console.log(`payload`, payload);
                return await placeOrder(token, payload);
            }

            case 'EXIT': {
                console.log(`Closing ${IRONBEAM_SYMBOL} Position..`);
                await flattenAll(token);
            }
        }

        return res.status(200).json({
            status: 'OK',
            success: true,
            message: `${IRONBEAM_SYMBOL}: 1 ${side} futures contract ${action.toUpperCase() === 'ENTRY' ? 'opened' : 'closed'} at ${new Date().toISOString()}`
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}