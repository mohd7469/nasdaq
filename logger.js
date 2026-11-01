// logger.js for central error logging
import { ServerResponse } from 'http';

const isDev =
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV === 'preview' ||
    process.env.VERCEL_ENV === 'development' ||
    process.env.VERCEL_ENV === 'preview' ||
    process.env.APP_ENV === 'development' ||
    process.env.APP_ENV === 'preview';

const devPrefix = isDev ? '[dev] ' : '';

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