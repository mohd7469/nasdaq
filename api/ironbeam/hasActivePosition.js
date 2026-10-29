import axios from 'axios';

export async function hasActivePosition(token, ibConfig) {
    try {
        const response = await axios.get(`${ibConfig.apiUrl}/account/${ibConfig.accountId}/positions`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const positions = response.data.positions || response.data || [];
        const activePositions = positions.filter(
            p => (p.symbol === ibConfig.symbol || p.exchSym === ibConfig.symbol) && p.quantity !== 0
        );
        return { isPositionActive: activePositions.length > 0, activePositionsData: activePositions };
    } catch (error) {
        return { isPositionActive: true, activePositionsData: [] };
    }
}