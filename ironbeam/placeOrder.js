import axios from 'axios';
import { hasActivePosition } from './hasActivePosition.js';
import { retryUntil } from './retryUntil.js';

export async function placeOrder(token, payload, ibConfig) {
    const maxRetries = 5;
    const delaySeconds = 1;

    const { success: positionCleared } = await retryUntil(
        async () => {
            const { isPositionActive } = await hasActivePosition(token, ibConfig);
            return !isPositionActive;
        },
        { maxRetries, delaySeconds }
    );

    if (!positionCleared) {
        return {
            success: false,
            message: `Order Rejected: Position currently active for [${ibConfig.accountId}] after several retry attempts`
        };
    }

    try {
        const response = await axios.post(`${ibConfig.apiUrl}/order/${ibConfig.accountId}/place`, payload, {
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            }
        });
        return { success: true, data: response.data };
    } catch (error) {
        throw new Error(error.response?.data?.message || error.message);
    }
}
