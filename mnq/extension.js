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
    const API_URL = 'https://app-nasdaq.vercel.app/api/send';
    const PKT_TIMEZONE = 'Asia/Karachi';
    const DXB_TIMEZONE = 'Asia/Dubai';

    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }

    const getTimezone = (time = moment(), timezone = PKT_TIMEZONE) => {
        const m = moment(time).tz(timezone);
        return m.isValid() ? m : moment().tz(timezone);
    };

    const isWeekend = () => {
        const day = getTimezone().day();
        return day === 0 || day === 6;
    };

    const isReloadRequired = () => {
        const now = getTimezone();
        const currentHour = now.hour();

        // 1. Agar 12 AM - 2 AM ka time hai to ignore
        if (currentHour < 2) return false;

        // 2. Slot identify karo
        const slot = currentHour >= 14 ? '_2PM' : '_2AM';
        const currentSlotKey = `${now.format('YYYY-MM-DD')}${slot}`;

        // 3. Simple localStorage check (Fast memory read)
        if (localStorage.getItem('last_reload_slot') === currentSlotKey) {
            return false;
        }

        // 4. Save & Trigger Reload
        localStorage.setItem('last_reload_slot', currentSlotKey);
        return true;
    };

    const sendAlert = async (text = 'Test Alert') => {
        try {
            await axios.post(API_URL, { bot: 'dxbmnq_bot', text });
        } catch (err) {
            console.error('Alert Error:', err?.message);
        }
    }

    const sendLog = async (text = 'Test Log') => {
        try {
            await axios.post(API_URL, { bot: 'dxblog_bot', text });
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

                // add new property
                data['PKT'] = getTimezone(data.timestamp, PKT_TIMEZONE).format('ddd, MMM D, h:mm A');
                data['DXB'] = getTimezone(data.timestamp, DXB_TIMEZONE).format('ddd, MMM D, h:mm A');

                console.log(JSON.stringify(data, null, 1));
                const { id, ...cleanData } = data;

                // showDesktopAlert('Setup is executed');
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
                const positionType = diff > 0 ? 'Long' : 'Short';
                const symbol = diff > 0 ? '+' : '-';
                const signal = `Get ready for ${positionType}... (${symbol}${realtimeValues.V})`;
                console.log(signal);
                // showDesktopAlert(signal);
                sendAlert(signal);
            }
        }
    }

    const timer = setupAutomationTimer({
        onInit: async (time) => {
            console.log(`Starting..`);
            sendLog(`Starting..`);
        },
        onTick: async (count, time, logs) => {
            waitScrollToBottom();

            if (isReloadRequired()) {
                console.log(`Reloading..`);
                sendLog(`Reloading..`);
                window.location.reload();
                return;
            }

            if (isWeekend()) {
                console.log('Market Closed');
                if (count % 3600 === 0) {
                    sendLog(`Market Closed`);
                }
                return;
            }

            processRealtimeValues();
            processPineLogs();

            if (count % 300 === 0) {
                cleanupProcessedHistory();
                sendLog(`Server is online`);
            }
        }
    });

    timer.start({ initialDelay: 15000, interval: 1000, logs: false });

    if (isWeekend()) {
        const tooltip = document.createElement('div');
        tooltip.innerText = 'Market Closed';
        tooltip.style.position = 'fixed';
        tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)';
        tooltip.style.color = '#fff';
        tooltip.style.padding = '5px 10px';
        tooltip.style.borderRadius = '4px';
        tooltip.style.fontSize = '12px';
        tooltip.style.border = '1px solid orange';
        tooltip.style.pointerEvents = 'none';
        tooltip.style.zIndex = '99999';
        tooltip.style.display = 'none';
        document.body.appendChild(tooltip);

        document.addEventListener('mousemove', (e) => {
            tooltip.style.display = 'block';
            tooltip.style.left = (e.clientX + 15) + 'px';
            tooltip.style.top = (e.clientY + 15) + 'px';
        });

        document.addEventListener('mouseleave', () => {
            tooltip.style.display = 'none';
        });
    }
})();