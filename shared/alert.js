// file://D:\projects\nasdaq\shared\alert.js

'use strict';

let axios;

// Dynamic Browser / Tampermonkey and Node.js support
if (typeof window !== 'undefined' && window.axios) {
    axios = window.axios;
} else if (typeof require !== 'undefined') {
    axios = require('axios');
}

const sendAlert = (customMsg = 'Test Alert') =>
    axios.post('https://app-nasdaq.vercel.app/api/sendAlert', {
        text: customMsg,
        userId: "7670215141",
        botToken: "8721637113:AAE6LY0BgBIYtcsqdo29I2nyp0e63PnTmzo"
    })
        .then((res) => {
            // console.log('Alert Sent');
            return true;
        })
        .catch(err => {
            console.error('Alert Error:', err?.response?.data || err?.message || err);
            return false;
        });

const sendLog = (customMsg = 'Test Log') =>
    axios.post('https://app-nasdaq.vercel.app/api/sendLog', {
        text: customMsg,
        userId: "7670215141",
        botToken: "8916407832:AAHjG7jtmP4_gdhPgsaika8P0yGMmKZb-I4"
    })
        .then((res) => {
            // console.log('Log Sent');
            return true;
        })
        .catch(err => {
            console.error('Log Error:', err?.response?.data || err?.message || err);
            return false;
        });

// Browser / Tampermonkey support
if (typeof window !== 'undefined') {
    window.sendAlert = sendAlert;
    window.sendLog = sendLog;
}

// Node.js support
if (typeof module !== 'undefined' && module.exports) {
    // export { sendAlert, sendLog };
    module.exports = { sendAlert, sendLog };
}
