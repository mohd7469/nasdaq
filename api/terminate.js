import '../logger.js';

import cors from '../cors.js';
import axios from 'axios';
import moment from 'moment';

import * as db from '../mongo/db.js';
import * as ib from '../ironbeam/_index.js';

import { getTimezone } from '../utils.js';

export default async function handler(req, res) {
    if (cors(req, res)) {
        return;
    }

    try {
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

                    await ib.flattenAll(token, ibConfig);

                    return {
                        accountId: ibConfig.accountId,
                        symbol: ibConfig.symbol,
                        success: true,
                        message: `[${ibConfig.accountId}] All open positions and orders flattened at ${getTimezone().toISOString()}`
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

        return res.status(200).json({
            success: successfulCount > 0,
            message: `All positions and orders terminated on ${successfulCount}/${ironbeamUsers.length} accounts`,
            results
        });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
}
