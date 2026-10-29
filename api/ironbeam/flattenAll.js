import axios from 'axios';
import { hasActiveOrder } from './hasActiveOrder.js';
import { hasActivePosition } from './hasActivePosition.js';

export async function flattenAll(token, ibConfig) {
    const headers = { Authorization: `Bearer ${token}` };

    const { isOrderActive, activeOrdersData } = await hasActiveOrder(token, ibConfig);
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

    const { isPositionActive, activePositionsData } = await hasActivePosition(token, ibConfig);
    if (isPositionActive && activePositionsData.length > 0) {
        for (const pos of activePositionsData) {
            const sym = pos.symbol || pos.exchSym || pos.s;
            const qty = pos.quantity !== undefined ? pos.quantity : pos.q;

            if (sym === ibConfig.symbol && qty && qty !== 0) {
                const closePayload = {
                    accountId: ibConfig.accountId,
                    exchSym: ibConfig.symbol,
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
    }

    return { success: true };
}
