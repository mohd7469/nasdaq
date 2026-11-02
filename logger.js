// logger.js for central error logging
import { ServerResponse } from 'http';
import { isDev } from './utils.js';

const devPrefix = isDev() ? '[dev] ' : '';

const originalLog = console.log;
console.log = (...args) => {
    if (devPrefix) {
        originalLog(devPrefix, ...args);
    } else {
        originalLog(...args);
    }
};

const originalError = console.error;
console.error = (...args) => {
    if (devPrefix) {
        originalError(devPrefix, ...args);
    } else {
        originalError(...args);
    }
};

const originalEnd = ServerResponse.prototype.end;

ServerResponse.prototype.end = function (chunk, ...args) {
    if (this.statusCode && this.statusCode !== 200) {
        console.error(`[${this.statusCode}]:`, chunk?.toString());
    }
    return originalEnd.apply(this, [chunk, ...args]);
};