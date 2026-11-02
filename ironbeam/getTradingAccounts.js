import * as db from '../mongo/db.js';
import { isDev } from '../utils.js';

export async function getTradingAccounts(isDemo) {
    try {
        // isDemo will be decide by isDev helper, true for (development), false for (production)
        const demo = isDemo !== undefined ? isDemo : isDev();
        return await db.getIronbeamConfig({ isActive: true, isDemo: demo });
    } catch (error) {
        throw new Error(`getTradingAccounts Error: ${error.message}`);
    }
}
