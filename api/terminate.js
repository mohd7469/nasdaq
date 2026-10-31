import '../logger.js';

import cors from '../cors.js';
import axios from 'axios';
import moment from 'moment';

import * as db from '../mongo/db.js';
import * as ib from '../ironbeam/_index.js';

import { formatGMT5 } from '../utils.js';

export default async function handler(req, res) {
    if (cors(req, res)) {
        return;
    }

    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ success: false, error: 'Method Not Allowed' });
        }

        const { action, timestamp } = req.body || {};
        if (!action || action.toUpperCase() !== 'TERMINATE') {
            return res.status(400).json({ success: false, message: '"action" must be TERMINATE' });
        }

        const ironbeamUsers = await ib.getTradingAccounts();
        if (!ironbeamUsers?.length) {
            return res.status(404).json({
                success: false,
                message: 'No active Ironbeam accounts found matching criteria (isActive: true, isDemo: true)'
            });
        }

        const results = await Promise.all(
            ironbeamUsers.map(async (ibConfig) => {
                try {
                    const token = await ib.getAuthToken(ibConfig);

                    const flattenResult = await ib.flattenAll(token, ibConfig);

                    if (!flattenResult.success) {
                        try {
                            const remaining = flattenResult.remainingPositions || [];
                            const qtyDetail = remaining
                                .map((p) => `${p.symbol || p.exchSym || p.s}: ${p.quantity || p.q || '?'}`)
                                .join(', ') || 'unknown';
                            await sendAlert(
                                `❌ Terminate Failed\nAccount: ${ibConfig.accountId}\nSymbol: ${ibConfig.symbol}\nError: ${flattenResult.error}\nRemaining Qty: ${qtyDetail}`
                            );
                        } catch (alertErr) {
                            // ignore alert errors, still report flatten failure below
                        }

                        return {
                            accountId: ibConfig.accountId,
                            symbol: ibConfig.symbol,
                            success: false,
                            error: flattenResult.error || 'Flatten failed'
                        };
                    }

                    return {
                        accountId: ibConfig.accountId,
                        symbol: ibConfig.symbol,
                        success: true,
                        message: `[${ibConfig.accountId}] All open positions and orders flattened at ${formatGMT5(timestamp)}`
                    };
                } catch (err) {
                    return {
                        accountId: ibConfig.accountId,
                        symbol: ibConfig.symbol,
                        success: false,
                        error: err.message
                    };
                }
            })
        );

        const successfulCount = results.filter(r => r.success).length;
        const allSuccessful = results.every(r => r.success);

        if (allSuccessful) {
            await sendAlert('Terminating active orders/positions to prevent overnight fees & margin risk')
        } else {
            await sendAlert('Warning: Please terminate overnight position to avoid risk and margin limit')
        }

        return res.status(200).json({
            success: successfulCount > 0,
            message: `All positions and orders terminated on ${successfulCount}/${ironbeamUsers.length} accounts`,
            results
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}

async function sendAlert(text = 'Terminating..') {
    try {
        await axios.post(`https://app-nasdaq.vercel.app/api/send`, { bot: 'dxbmnq_bot', text });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}