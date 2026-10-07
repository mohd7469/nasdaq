// file://D:\projects\nasdaq\mnq\extension.js

(function () {
    'use strict';

    const processedHistory = new Map();

    const CONTAINER = '[data-test-id-widget-type="pine_logs"] [class*="logsList-"]';
    const TIMEZONE = 'Asia/Karachi';

    const getTimezone = (time) => {
        const m = moment(time).tz(TIMEZONE);
        return m.isValid() ? m : moment().tz(TIMEZONE);
    };

    const isWeekend = () => {
        const day = getTimezone().day();
        return day === 0 || day === 6;
    };

    const getYesterdayStart = () => getTimezone().subtract(1, 'day').startOf('day');

    function isFromYesterdayOrToday(timestamp) {
        if (!timestamp) return false;
        const logTime = getTimezone(timestamp);
        return logTime.isValid() && logTime.isSameOrAfter(getYesterdayStart());
    }

    function cleanupProcessedHistory() {
        const yesterdayStart = getYesterdayStart();
        for (const [id, timestamp] of processedHistory) {
            const logTime = getTimezone(timestamp);
            if (!logTime.isValid() || logTime.isBefore(yesterdayStart)) {
                processedHistory.delete(id);
            }
        }
        while (processedHistory.size > 50) {
            processedHistory.delete(processedHistory.keys().next().value);
        }
    }

    function waitScrollToBottom() {
        const container = document.querySelector(CONTAINER);
        if (!container) return Promise.resolve();

        const scrollBtn = container.querySelector('button');
        if (scrollBtn) {
            scrollBtn.click();
        } else {
            container.scrollTop = container.scrollHeight;
        }

        return new Promise(resolve => setTimeout(resolve, 200));
    }

    function parseLogData(rawData) {
        if (!rawData || !rawData.trim()) return null;

        const dateMatch = rawData.match(/\[(.*?)\]/);
        const actionMatch = rawData.match(/(LONG|SHORT)_(ENTRY|EXIT):\s*([\d.]+)/);
        if (!dateMatch || !actionMatch) return null;

        const [, side, action, priceStr] = actionMatch;
        const price = parseFloat(priceStr);
        const tpMatch = rawData.match(/TP:\s*([\d.]+)/);
        const slMatch = rawData.match(/SL:\s*([\d.]+)/);

        return {
            id: `${side}_${action}_${price}_${dateMatch[1]}`,
            timestamp: dateMatch[1],
            side,
            action,
            price,
            tp: tpMatch ? parseFloat(tpMatch[1]) : null,
            sl: slMatch ? parseFloat(slMatch[1]) : null
        };
    }

    function processPineLogs() {
        const container = document.querySelector(CONTAINER);
        if (!container) {
            console.log('Waiting for data..');
            return;
        }

        const elements = container.querySelectorAll('div[data-index]');
        if (!elements.length) return;

        const startIndex = Math.max(0, elements.length - 2); // pick just last recent elements
        for (let i = startIndex; i < elements.length; i++) {
            const raw = (elements[i].textContent || elements[i].innerText || '').trim();
            const data = parseLogData(raw);

            if (data && isFromYesterdayOrToday(data.timestamp) && !processedHistory.has(data.id)) {
                processedHistory.set(data.id, data.timestamp);
                console.log(JSON.stringify(data, null, 1));
                const { id, ...cleanData } = data;
                sendAlert(`<pre><code>${JSON.stringify(cleanData, null, 1)}</code></pre>`);
            }
        }
    }

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