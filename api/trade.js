import axios from 'axios';
import config from './config.json' with { type: 'json' };
const { WEBHOOK_SECRET, BOTS_CONFIG } = config;

const BASE_URL = "https://demo.ironbeamapi.com/v2";
const ACCOUNT_ID = "YOUR_ACCOUNT_ID";
const USERNAME = "YOUR_ACCOUNT_ID";
const PASSWORD = "YOUR_PASSWORD";
const API_KEY = "YOUR_API_KEY";
const SYMBOL = "XCME:MNQ"; // Micro E-mini Nasdaq-100

// 1. Authentication (Token Lena)
async function getAuthToken() {
    const response = await axios.post(`${BASE_URL}/auth`, {
        username: USERNAME,
        password: PASSWORD,
        apiKey: API_KEY
    });
    return response.data.token;
}

// 2. Open Positions Check Karna
async function hasOpenPosition(token) {
    try {
        const response = await axios.get(`${BASE_URL}/accounts/${ACCOUNT_ID}/positions`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        const positions = response.data.positions || response.data || [];

        // Check karein ke MNQ ki koi active/open position (netQuantity != 0) hai ya nahi
        const activePosition = positions.find(
            p => (p.symbol === SYMBOL || p.exchSym === SYMBOL) && p.netQuantity !== 0
        );

        if (activePosition) {
            console.log(`⚠️ Active position already exists for ${SYMBOL}. Position size: ${activePosition.netQuantity}`);
            return true;
        }

        return false;
    } catch (error) {
        console.error("Error checking positions:", error.response?.data || error.message);
        // Safety check: agar endpoint error de toh nayi trade mat lagayein
        return true;
    }
}

// 3. Generic Order Execution Function
async function placeOrder(token, payload) {
    // Pehle check karein ke koi open position toh nahi hai
    const isPositionOpen = await hasOpenPosition(token);
    if (isPositionOpen) {
        console.log("❌ Trade execution skipped: Open position detected.");
        return;
    }

    try {
        const response = await axios.post(`${BASE_URL}/orders`, payload, {
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
//   accountId: ACCOUNT_ID,
//   exchSym: SYMBOL,
//   side: "BUY",
//   orderType: "MARKET",
//   quantity: 1,
//   durationType: "DAY",
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
//   accountId: ACCOUNT_ID,
//   exchSym: SYMBOL,
//   side: "BUY",
//   orderType: "LIMIT",
//   price: 20450.00,      // Specific Entry Price
//   quantity: 1,
//   durationType: "DAY",
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
//   accountId: ACCOUNT_ID,
//   exchSym: SYMBOL,
//   side: "SELL",
//   orderType: "MARKET",
//   quantity: 1,
//   durationType: "DAY",
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
//   accountId: ACCOUNT_ID,
//   exchSym: SYMBOL,
//   side: "SELL",
//   orderType: "LIMIT",
//   price: 20550.00,      // Specific Short Entry Price
//   quantity: 1,
//   durationType: "DAY",
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

    try {
        const token = await getAuthToken();

        const { qty, side, action, tp, sl } = req.body;
        const tradeType = `${side.toUpperCase()}_${action.toUpperCase()}`;
        let payload;

        switch (tradeType) {
            case 'LONG_ENTRY':
                console.log(`${SYMBOL}: Long Opened`);
                // await placeOrder(token, payload);
                break;

            case 'LONG_EXIT':
                console.log(`${SYMBOL}: Long Closed`);
                // trigger close all
                break;

            case 'SHORT_ENTRY':
                console.log(`${SYMBOL}: Short Opened`);
                // await placeOrder(token, payload);
                break;

            case 'SHORT_EXIT':
                console.log(`${SYMBOL}: Short Closed`);
                // trigger close all
                break;

            default:
                return res.status(400).json({ success: false, message: 'Invalid Action Type' });
        }

        return res.status(200).json({
            status: 'OK',
            success: true,
            message: `${SYMBOL || 'MNQZ2026'}: ${qty} ${side} futures contract ${action.toUpperCase() === 'ENTRY' ? 'opened' : 'closed'} at ${new Date().toISOString()}`
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
}