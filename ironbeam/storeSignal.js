import * as db from '../mongo/db.js';

export async function storeSignal(id, body) {
    return await db.storeSignal(id, body);
}
