/**
 * Retry Helper
 *
 * Provides a generic retry mechanism with a fixed delay between attempts.
 * Useful for waiting on asynchronous conditions (e.g., position flat, order fill)
 * before proceeding or declaring failure.
 *
 * @param {Function} conditionFn - Async function that returns truthy when the desired condition is met.
 * @param {Object} options - Retry options.
 * @param {number} options.maxRetries - Maximum number of attempts (default: 5).
 * @param {number} options.delaySeconds - Delay in seconds between attempts (default: 1).
 * @returns {Promise<{ success: boolean, attempts: number }>}
 */

function delay(seconds) {
    return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

export async function retryUntil(conditionFn, { maxRetries = 5, delaySeconds = 1 } = {}) {
    for (let i = 0; i < maxRetries; i++) {
        const met = await conditionFn();
        if (met) {
            return { success: true, attempts: i + 1 };
        }
        await delay(delaySeconds);
    }
    return { success: false, attempts: maxRetries };
}
