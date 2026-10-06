// file://D:\projects\nasdaq\new\extension.js

(function () {
    'use strict';

    let processedHistory = new Map();

    function isWeekend() {
        const currentDay = moment().tz("Asia/Karachi").day();
        // 0 = Sunday, 6 = Saturday
        return currentDay === 0 || currentDay === 6;
    }

    function isFromYesterdayOrToday(timestamp) {
        if (!timestamp) return false;

        const logTime = moment(timestamp).tz("Asia/Karachi");
        if (!logTime.isValid()) return false;

        // Kal ke din ka start (00:00:00 AM)
        const yesterdayStart = moment().tz("Asia/Karachi").subtract(1, 'day').startOf('day');
        return logTime.isSameOrAfter(yesterdayStart);
    }

    function cleanupProcessedHistory() {
        const yesterdayStart = moment().tz("Asia/Karachi").subtract(1, 'day').startOf('day');

        // Kal se pehle ke purane hashes memory se remove karain
        for (const [id, timestamp] of processedHistory.entries()) {
            const logTime = moment(timestamp).tz("Asia/Karachi");
            if (!logTime.isValid() || logTime.isBefore(yesterdayStart)) {
                processedHistory.delete(id);
            }
        }

        // Safety cap agar kisi din bohot zyada logs hon
        while (processedHistory.size > 50) {
            const oldestHash = processedHistory.keys().next().value;
            processedHistory.delete(oldestHash);
        }
    }

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

    function waitScrollToBottom() {
        const CONTAINER_SELECTOR = '[data-test-id-widget-type="pine_logs"] [class*="logsList-"]';
        const container = document.querySelector(CONTAINER_SELECTOR);

        return new Promise((resolve) => {
            if (!container) {
                resolve();
                return;
            }

            const scrollBtn = container.querySelector('button');
            if (scrollBtn) {
                scrollBtn.click();
            } else {
                container.scrollTop = container.scrollHeight;
            }

            setTimeout(() => {
                resolve();
            }, 200);
        });
    }

    function parseLogData(rawData) {
        if (!rawData || !rawData.trim()) return null;

        // Date extraction [ISO_TIMESTAMP]
        const dateMatch = rawData.match(/\[(.*?)\]/);
        if (!dateMatch) return null; // Date na mile to aage na jayein
        const isoDateString = dateMatch[1];

        // Action Matching: LONG_ENTRY, SHORT_ENTRY, LONG_EXIT, SHORT_EXIT
        const actionMatch = rawData.match(/(LONG|SHORT)_(ENTRY|EXIT):\s*([\d\.]+)/);
        if (!actionMatch) return null;

        const side = actionMatch[1];                                           // "LONG" | "SHORT"
        const action = actionMatch[2];                                         // "ENTRY" | "EXIT"
        const triggerPrice = parseFloat(actionMatch[3]);                       // Entry or Exit Price

        // Optional TP & SL values
        const tpMatch = rawData.match(/TP:\s*([\d\.]+)/);
        const slMatch = rawData.match(/SL:\s*([\d\.]+)/);

        const tpValue = tpMatch ? parseFloat(tpMatch[1]) : null;
        const slValue = slMatch ? parseFloat(slMatch[1]) : null;

        // Dynamic Hash generation for 'id'
        const generatedHash = `${side}_${action}_${triggerPrice}_${isoDateString}`;

        return {
            id: generatedHash,
            timestamp: isoDateString,
            side: side,                                                        // "LONG" | "SHORT"
            action: action,                                                    // "ENTRY" | "EXIT"
            price: triggerPrice,
            tp: tpValue,
            sl: slValue
        };
    }

    function processPineLogs() {
        const CONTAINER_SELECTOR = '[data-test-id-widget-type="pine_logs"] [class*="logsList-"]';
        const LOG_ITEM_SELECTOR = 'div[data-index]';

        const logsContainer = document.querySelector(CONTAINER_SELECTOR);
        if (!logsContainer) {
            console.log('Waiting for data..');
            return;
        }

        // Sub div[data-index] elements pick karain
        const allLogElements = logsContainer.querySelectorAll(LOG_ITEM_SELECTOR);
        if (!allLogElements || allLogElements.length === 0) return;

        // Aakhri 2 elements ka reference lein taake instant multi-log skip na ho
        const recentLogs = Array.from(allLogElements).slice(-2);

        for (const logEl of recentLogs) {
            const rawData = (logEl.innerText || logEl.textContent || "").trim();
            if (!rawData) continue;

            // Parse clean object using rawData
            const jsonOutput = parseLogData(rawData);

            if (jsonOutput && isFromYesterdayOrToday(jsonOutput.timestamp) && !processedHistory.has(jsonOutput.id)) {
                processedHistory.set(jsonOutput.id, jsonOutput.timestamp);

                console.log(JSON.stringify(jsonOutput, null, 1));

                // Clean Verified Output
                const { id, ...cleanData } = jsonOutput;
                sendAlert(`<pre><code>${JSON.stringify(cleanData, null, 1)}</code></pre>`);
            }
        }
    }

    // Initialize background automation worker
    const timer = setupAutomationTimer({
        onTick: async (count, time, logs) => {
            await waitScrollToBottom();

            if (isWeekend()) {
                console.log('Market is Off! Enjoy Weekend!');
                return;
            }

            processPineLogs();

            if (count % 30 === 0) {
                cleanupProcessedHistory();
                sendLog(`Ping: ${time}`);
            }
        }
    });

    timer.start({ initialDelay: 15000, interval: 1000, logs: false });
})();