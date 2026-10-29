import axios from 'axios';

export async function hasOpenPosition(token, ibConfig) {
    try {
        const response = await axios.get(`${ibConfig.apiUrl}/account/${ibConfig.accountId}/positions`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const positions = response.data.positions || response.data || [];
        return positions.some(
            p => (p.symbol === ibConfig.symbol || p.exchSym === ibConfig.symbol) && p.quantity !== 0
        );
    } catch (error) {
        return true;
    }
}
