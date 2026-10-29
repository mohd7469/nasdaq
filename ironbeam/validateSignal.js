import { isSignalExpired } from '../utils.js';

export function validateSignal({ timestamp, id }) {
    if (timestamp && isSignalExpired(timestamp)) {
        return {
            isValid: false,
            status: 409,
            payload: { success: false, signalId: id, message: 'Signal expired.' }
        };
    }

    return { isValid: true };
}
