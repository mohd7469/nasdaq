import axios from 'axios';
import { hasActiveOrder } from './hasActiveOrder.js';
import { hasActivePosition } from './hasActivePosition.js';
import { retryUntil } from './retryUntil.js';

export async function flattenAll(token, ibConfig) {
    const headers = { Authorization: `Bearer ${token}` };

    // 1. Cancel active orders
    const { isOrderActive, activeOrdersData } = await hasActiveOrder(token, ibConfig, null);
    if (isOrderActive && activeOrdersData.length > 0) {
        const activeOrderIds = activeOrdersData.map(o => o.orderId || o.oid);

        await axios.delete(`${ibConfig.apiUrl}/order/${ibConfig.accountId}/cancelMultiple`, {
            headers,
            data: {
                accountId: ibConfig.accountId,
                orderIds: activeOrderIds
            }
        });
    }

    // 2. Close active positions
    const { isPositionActive, activePositionsData } = await hasActivePosition(token, ibConfig, null);
    if (isPositionActive && activePositionsData.length > 0) {
        for (const pos of activePositionsData) {
            const qty = pos.quantity !== undefined ? pos.quantity : pos.q;
            if (!qty || qty === 0) continue;

            const closePayload = {
                accountId: ibConfig.accountId,
                exchSym: pos.exchSym || pos.symbol || pos.s || ibConfig.symbol,
                side: qty > 0 ? 'SELL' : 'BUY',
                quantity: Math.abs(qty),
                orderType: 'MARKET',
                duration: 'DAY',
                waitForOrderId: true
            };

            await axios.post(`${ibConfig.apiUrl}/order/${ibConfig.accountId}/place`, closePayload, {
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                }
            });
        }
    }

    // 3. Verify positions are actually flat before reporting success
    const { success: flatConfirmed } = await retryUntil(
        async () => {
            const { isPositionActive } = await hasActivePosition(token, ibConfig, null);
            return !isPositionActive;
        },
        { maxRetries: 10, delaySeconds: 2 }
    );

    if (!flatConfirmed) {
        const { activePositionsData: remaining } = await hasActivePosition(token, ibConfig, null);
        return { success: false, error: 'Position still active after flatten attempt', remainingPositions: remaining || [] };
    }

    return { success: true };
}
