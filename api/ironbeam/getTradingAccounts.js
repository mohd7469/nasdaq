import * as db from '../../mongo/db.js';

async function getTradingAccounts() {
    const ironbeamUsers = await db.getIronbeamConfig({ isActive: true, isDemo: true });
    if (!ironbeamUsers?.length) {
        return res.status(404).json({
            success: false,
            message: 'No active Ironbeam accounts found matching criteria (isActive: true, isDemo: true)'
        });
    }
}
