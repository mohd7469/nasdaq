import * as db from '../mongo/db.js';

export async function getTradingAccounts() {
    try {
        return await db.getIronbeamConfig({ isActive: true, isDemo: true }); // on demo
        // return await db.getIronbeamConfig({ isActive: true, isDemo: false }); // on real
    } catch (error) {
        throw new Error(`getTradingAccounts Error: ${error.message}`);
    }
}
