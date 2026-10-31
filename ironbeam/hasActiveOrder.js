import axios from 'axios';

function normalizeSymbol(sym) {
    if (!sym) return '';
    return String(sym).toUpperCase().replace(/^XCME:/, '').replace(/\s+/g, '');
}

export async function hasActiveOrder(token, ibConfig, symbol = null) {
    try {
        const response = await axios.get(`${ibConfig.apiUrl}/order/${ibConfig.accountId}/ANY`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const ordersData = response.data.orders || response.data || [];
        const ORDER_STATUS_ACTIVE = new Set(['NEW', 'SUBMITTED', 'PENDING_NEW', 'QUEUED_NEW', 'ACCEPTED_FOR_BIDDING']);
        const target = symbol ? normalizeSymbol(symbol) : null;

        const activeOrders = ordersData.filter(o => {
            const sym = o.symbol || o.sym || o.s;
            return ORDER_STATUS_ACTIVE.has(o.status || o.st) && (!target || normalizeSymbol(sym) === target);
        });
        return { isOrderActive: activeOrders.length > 0, activeOrdersData: activeOrders };
    } catch (error) {
        return { isOrderActive: true, activeOrdersData: [] };
    }
}