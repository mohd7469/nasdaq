import * as db from '../mongo/db.js';

export async function getTradingAccounts() {
    try {
        return await db.getIronbeamConfig({ isActive: true, isDemo: true });
    } catch (error) {
        throw new Error(`getTradingAccounts Error: ${error.message}`);
    }
}
