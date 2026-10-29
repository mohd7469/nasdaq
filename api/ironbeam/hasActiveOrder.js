import axios from 'axios';

export async function hasActiveOrder(token, ibConfig) {
    try {
        const response = await axios.get(`${ibConfig.apiUrl}/order/${ibConfig.accountId}/ANY`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const ordersData = response.data.orders || response.data || [];
        const ORDER_STATUS_ACTIVE = new Set(['NEW', 'SUBMITTED', 'PENDING_NEW', 'QUEUED_NEW', 'ACCEPTED_FOR_BIDDING']);

        const activeOrders = ordersData.filter(o => ORDER_STATUS_ACTIVE.has(o.status || o.st));
        return { hasActiveOrder: activeOrders.length > 0, data: activeOrders };
    } catch (error) {
        return { hasActiveOrder: true, data: [] };
    }
}