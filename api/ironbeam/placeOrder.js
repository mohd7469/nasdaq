import axios from 'axios';
import { hasOpenPosition } from './hasOpenPosition.js';

function delay(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export async function placeOrder(token, payload, ibConfig) {
    const maxRetries = 5;
    const delaySeconds = 1;

    for (let i = 0; i < maxRetries; i++) {
        const isPositionOpen = await hasOpenPosition(token, ibConfig);
        if (!isPositionOpen) break;

        if (i === maxRetries - 1) {
            return {
                success: false,
                message: `Order Rejected: Position currently active for [${ibConfig.accountId}] after several retry attempts`
            };
        }

        await delay(delaySeconds);
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
