// logger.js for central error logging
import { ServerResponse } from 'http';

const originalEnd = ServerResponse.prototype.end;

ServerResponse.prototype.end = function (chunk, ...args) {
    if (this.statusCode && this.statusCode !== 200) {
        console.error(`[${this.statusCode}]`, chunk?.toString());
    }
    return originalEnd.apply(this, [chunk, ...args]);
};