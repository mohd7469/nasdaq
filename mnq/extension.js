// file://D:\projects\nasdaq\mnq\extension.js

(function () {
    'use strict';

    (() => {
        const overlay = Object.assign(document.createElement('div'), {
            style: 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.85);z-index:999999;cursor:pointer;transition:opacity 0.5s ease;'
        });
        overlay.onclick = () => {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 500);
        };
        document.body.prepend(overlay);
    })();

    const processedHistory = new Map();

    const PINE_LOGS_CONTAINER = '[data-test-id-widget-type="pine_logs"] [class*="logsList-"]';
    const OHLC_CONTAINER = '[data-qa-id="legend-series-item"]';
    const API_URL = 'https://app-nasdaq.vercel.app/api';
    const TIMEZONE = 'Asia/Karachi';

    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }

    const getTimezone = (time) => {
        const m = moment(time).tz(TIMEZONE);
        return m.isValid() ? m : moment().tz(TIMEZONE);
    };

    const isWeekend = () => {
        const day = getTimezone().day();
        return day === 0 || day === 6;
    };

    const sendAlert = async (text = 'Test Alert') => {
        try {
            await axios.post(API_URL, { type: 'alert', text });
        } catch (err) {
            console.error('Alert Error:', err?.message);
        }
    }

    const sendLog = async (text = 'Test Log') => {
        try {
            await axios.post(API_URL, { type: 'log', text });
        } catch (err) {
            console.error('Log Error:', err?.message);
        }
    }

    const getYesterdayStart = () => {
        return getTimezone().subtract(1, 'day').startOf('day');
    };

    const showDesktopAlert = async (msg = 'Open tradingview for details') => {
        try {
            await new Audio('https://cdn.jsdelivr.net/gh/mohd7469/alert@main/beep1.mp3').play();
        } catch (err) {
            console.warn('Audio play error', err);
        }

        if (Notification.permission === 'granted') {
            new Notification('Nasdaq Alert', {
                body: msg,
                icon: 'https://www.nasdaq.com/sites/acquia.prod/files/2020/09/24/nasdaq.jpg'
            }).onclick = () => { window.focus(); };
        }
    };

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
        const container = document.querySelector(PINE_LOGS_CONTAINER);
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
        const container = document.querySelector(PINE_LOGS_CONTAINER);
        if (!container) {
            console.log('Waiting for logs..');
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
                showDesktopAlert('Setup is executed');
                sendAlert(`<pre><code>${JSON.stringify(cleanData, null, 1)}</code></pre>`);
            }
        }
    }

    function processRealtimeValues() {
        const container = document.querySelector(OHLC_CONTAINER);
        if (!container) {
            console.log('Waiting for OHLC..');
            return;
        }

        const getValue = (key) => {
            const el = container.querySelector(`[data-test-id-value-title="${key}"]`);
            if (!el) return null;

            const rawText = (el.textContent || el.innerText || '').replace(/\u00a0/g, ' ').trim();

            return rawText.replace(/^([OHLC]|Vol)\s*/i, ''); // remove (O, H, L, C, Vol) from rawText
        };

        const realtimeValues = {
            O: getValue('O'),
            H: getValue('H'),
            L: getValue('L'),
            C: getValue('C'),
            V: getValue('Vol')
        };

        const openPrice = parseFloat(realtimeValues.O?.replace(/,/g, ''));
        const closePrice = parseFloat(realtimeValues.C?.replace(/,/g, ''));

        if (!isNaN(openPrice) && !isNaN(closePrice)) {
            const diff = closePrice - openPrice;

            if (Math.abs(diff) >= 50) {
                const symbol = diff > 0 ? '+' : '-';
                const signal = `Setup is triggered (${symbol}${realtimeValues.V})`;
                console.log(signal);
                showDesktopAlert(signal);
                sendAlert(signal);
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

            processRealtimeValues();
            processPineLogs();

            if (count % 300 === 0) {
                cleanupProcessedHistory();
                console.log('✔ 5m ping');
                sendLog(`Ping: ${time}`);
            }
        }
    });

    timer.start({ initialDelay: 15000, interval: 1000, logs: false });
})();