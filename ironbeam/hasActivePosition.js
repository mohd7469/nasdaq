import axios from 'axios';

function normalizeSymbol(sym) {
    if (!sym) return '';
    return String(sym).toUpperCase().replace(/^XCME:/, '').replace(/\s+/g, '');
}

export async function hasActivePosition(token, ibConfig, symbol = ibConfig.symbol) {
    try {
        const response = await axios.get(`${ibConfig.apiUrl}/account/${ibConfig.accountId}/positions`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const positions = response.data.positions || response.data || [];
        const target = symbol ? normalizeSymbol(symbol) : null;

        const activePositions = positions.filter((p) => {
            const qty = p.quantity !== undefined ? p.quantity : p.q;
            return qty !== 0 && (!target || normalizeSymbol(p.symbol || p.exchSym || p.s) === target);
        });

        return { isPositionActive: activePositions.length > 0, activePositionsData: activePositions };
    } catch (error) {
        return { isPositionActive: true, activePositionsData: [] };
    }
}