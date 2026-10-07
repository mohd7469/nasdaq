// file://D:\projects\nasdaq\shared\alert.js

'use strict';

function sendAlert(customMsg = 'Test Alert') {
    axios.post('https://app-nasdaq.vercel.app/api/sendAlert', {
        text: customMsg,
        userId: "7670215141",
        botToken: "8721637113:AAE6LY0BgBIYtcsqdo29I2nyp0e63PnTmzo"
    })
        .then(response => {
            // console.log('Alert Sent');
        })
        .catch(error => {
            console.error('Alert Error:', error);
        });
}

function sendLog(customMsg = 'Test Log') {
    axios.post('https://app-nasdaq.vercel.app/api/sendLog', {
        text: customMsg,
        userId: "7670215141",
        botToken: "8916407832:AAHjG7jtmP4_gdhPgsaika8P0yGMmKZb-I4"
    })
        .then(response => {
            // console.log('Log Sent');
        })
        .catch(error => {
            console.error('Log Error:', error);
        });
}