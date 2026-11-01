import * as util from '../utils.js';

export function validateSignalExpiry({ timestamp, id }) {
    if (timestamp && util.isSignalExpired(timestamp)) {
        return {
            isValid: false,
            status: 409,
            payload: { success: false, signalId: id, message: 'Signal expired.' }
        };
    }

    return { isValid: true };
}
