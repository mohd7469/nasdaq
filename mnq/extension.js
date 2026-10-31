// file://D:\projects\nasdaq\mnq\extension.js

(async function () {
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

    const isWindows = /Win/i.test(navigator.userAgent || navigator.platform);
    const API_URL = 'https://app-nasdaq.vercel.app/api';
    const LOCALHOST = `http://localhost:3000/api`;

    const PINE_LOGS_CONTAINER = '[data-test-id-widget-type="pine_logs"] [class*="logsList-"]';
    const OHLC_CONTAINER = '[data-qa-id="legend-series-item"]';

    if (typeof Notification !== 'undefined' && Notification.permission !== 'granted') {
        Notification.requestPermission();
    }

    const formatGMT5 = (time = moment()) => {
        return getTimezone(time).format('YYYY-MM-DDTHH:mm:ss.SSSZ');
    };

    const isWeekend = (timezone = PKT_TIMEZONE) => {
        const currentTime = getTimezone(moment(), timezone);
        const day = currentTime.day(); // 0 = Sunday, 6 = Saturday
        return day === 0 || day === 6;
    };

    const isOvernightWindowApproaching = () => {
        const OFFSET_MINUTES = 15;
        const NY_CLOSING_HOUR = "16:00"; // 4 PM NY Closing Time

        const nyCurrentTime = getTimezone(moment(), NY_TIMEZONE);
        const nyClosingOffsetTime = moment.tz(NY_CLOSING_HOUR, "HH:mm", NY_TIMEZONE).subtract(OFFSET_MINUTES, 'minutes');

        return nyCurrentTime.isAfter(nyClosingOffsetTime);
    };

    const terminateAllActivePositionAndOrders = async () => {
        try {
            const now = getTimezone(moment(), PKT_TIMEZONE);
            const todayKey = now.format('YYYY-MM-DD');
            const lastTerminateDate = localStorage.getItem('_botRecentTerminateTriggeredDate');

            if (lastTerminateDate !== todayKey) {
                const endpoint = isWindows ? LOCALHOST : API_URL;
                const payload = {
                    action: 'TERMINATE',
                    timestamp: formatGMT5()
                };
                await axios.post(`${endpoint}/terminate`, payload);

                localStorage.setItem('_botRecentTerminateTriggeredDate', todayKey);
            }
        } catch (err) {
            console.error('Terminate Error:', err?.message);
        }
    };

    const isReloadingHours = () => {
        const now = getTimezone();
        const currentHour = now.hour(); // 0 to 23

        // 1. target hours 24-hour format me add karen
        const reloadHours = [0, 3, 6, 9, 12, 15, 18, 21];

        // 2. Dekho aj ka sab se recent slot konsa chal raha hai
        const activeSlotHour = reloadHours
            .slice()
            .reverse()
            .find(h => currentHour >= h);

        // Safety check (agar reloadHours array empty ho ya koi match na miley)
        if (activeSlotHour === undefined) {
            return false;
        }

        // 3. Slot Key banayein (e.g., "2026-10-15_SLOT_15" for 3 PM)
        const currentSlotKey = `${now.format('YYYY-MM-DD')}_SLOT_${activeSlotHour}`;

        // 4. agar is slot me pehle hi reload ho chuka to return false
        if (localStorage.getItem('_botRecentReloadingSlot') === currentSlotKey) {
            return false;
        }

        // 5. Save & Trigger Reload
        localStorage.setItem('_botRecentReloadingSlot', currentSlotKey);
        return true;
    };

    const isReloadRequested = async () => {
        try {
            const response = await fetch(`${API_URL}/reload`, { cache: 'no-store' });
            const shouldReload = await response.json();
            if (shouldReload === true) {
                await sendLog(`Reloading..`).catch(err => { });
                window.location.reload();
            }
        } catch (err) {
            console.error('Reload Request Error:', err?.message);
        }
    };

    const isTriggeredWithinSameMinutes = () => {
        const recentNasdaqAlertTimestamp = localStorage.getItem('_botRecentNasdaqAlertTimestamp');
        if (!recentNasdaqAlertTimestamp) return false;
        const currentTime = getTimezone();
        return moment(recentNasdaqAlertTimestamp).isSame(currentTime, 'minute');
    };

    const handleTrade = async (payload) => {
        try {
            const endpoint = isWindows ? LOCALHOST : API_URL;
            await axios.post(`${endpoint}/trade`, payload);
        } catch (err) {
            console.error('Trade Error:', err?.message);
        }
    }

    const sendAlert = async (text = 'Test Alert') => {
        try {
            await axios.post(`${API_URL}/send`, { bot: 'dxbmnq_bot', text });
        } catch (err) {
            console.error('Alert Error:', err?.message);
        }
    }

    const sendLog = async (text = 'Test Log') => {
        try {
            await axios.post(`${API_URL}/send`, { bot: 'dxblog_bot', text });
        } catch (err) {
            console.error('Log Error:', err?.message);
        }
    }

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

    const syncRecentPineLogsTimestampFromBackend = async () => {
        try {
            const recentPineLogsTimestamp = localStorage.getItem('_botRecentPineLogsTimestamp');
            if (!recentPineLogsTimestamp) {
                console.log('Syncing recent signal from server..');
                const endpoint = isWindows ? LOCALHOST : API_URL;
                const response = await axios.get(`${endpoint}/trade`);
                if (response.data && response.data.signals && response.data.signals.length > 0) {
                    const signals = response.data.signals;

                    // Client side par moment ke zariye strict chronological sorting
                    signals.sort((a, b) => {
                        return getTimezone(a.timestamp).valueOf() - getTimezone(b.timestamp).valueOf();
                    });

                    // Sorting ke baad sab se aakhri (most recent) signal utha lo
                    const latestSignal = signals[signals.length - 1];
                    if (latestSignal && latestSignal.timestamp) {
                        const latestIso = formatGMT5(latestSignal.timestamp);
                        localStorage.setItem('_botRecentPineLogsTimestamp', latestIso);
                        console.log('Synced:', latestIso);
                    }
                }
            }
        } catch (err) {
            console.error('Sync Timestamp Error:', err?.message);
        }
    };

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

        const filterElements = Array.from(elements)
            // pick last 5 logs
            .slice(-5)
            // filter today's logs
            .filter(el => {
                const data = parseLogData((el.textContent || el.innerText || '').trim());
                return data?.timestamp && getTimezone(data.timestamp).isSame(getTimezone(), 'day');
            })
            // and sort by time
            .sort((a, b) => {
                const dataA = parseLogData((a.textContent || a.innerText || '').trim());
                const dataB = parseLogData((b.textContent || b.innerText || '').trim());
                return getTimezone(dataA?.timestamp).valueOf() - getTimezone(dataB?.timestamp).valueOf();
            });
        if (!filterElements.length) return;

        const recentTimestamp = localStorage.getItem('_botRecentPineLogsTimestamp') || '';

        for (let i = 0; i < filterElements.length; i++) {
            const currentRow = filterElements[i];
            const currentData = parseLogData((currentRow.textContent || currentRow.innerText || '').trim());

            if (currentData && currentData.timestamp) {
                const currentTimestamp = getTimezone(currentData.timestamp);
                if (!recentTimestamp || currentTimestamp.isAfter(getTimezone(recentTimestamp))) {
                    // add new property
                    currentData['PKT'] = getTimezone(currentData.timestamp, PKT_TIMEZONE).format('ddd, MMM D, h:mm A');
                    currentData['DXB'] = getTimezone(currentData.timestamp, DXB_TIMEZONE).format('ddd, MMM D, h:mm A');

                    const { id, ...cleanData } = currentData;
                    console.log(JSON.stringify(currentData, null, 1));

                    localStorage.setItem('_botRecentPineLogsTimestamp', formatGMT5(currentTimestamp));

                    if (!isWeekend()) {
                        // showDesktopAlert('Setup is executed');
                        handleTrade(currentData).catch(err => { });
                        sendAlert(`<pre><code>${JSON.stringify(cleanData, null, 1)}</code></pre>`).catch(err => { });
                    } else {
                        console.log('Skipping Trade | Market Closed')
                    }
                }
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

        let recentNasdaqAlert = localStorage.getItem('_botRecentNasdaqAlert')?.trim() || null;

        const openPrice = parseFloat(realtimeValues.O?.replace(/,/g, ''));
        const closePrice = parseFloat(realtimeValues.C?.replace(/,/g, ''));

        if (!isNaN(openPrice) && !isNaN(closePrice)) {
            const diff = closePrice - openPrice;

            if (Math.abs(diff) >= 50) {
                const signal = diff > 0
                    ? `Checking new setup.. (+${realtimeValues.V})`
                    : `Checking new setup.. (-${realtimeValues.V})`
                // showDesktopAlert(signal);
                if (signal && signal !== recentNasdaqAlert && !isTriggeredWithinSameMinutes()) {
                    console.log(signal);
                    for (let i = 0; i < 2; i++) sendAlert(signal);
                    recentNasdaqAlert = signal;
                    localStorage.setItem('_botRecentNasdaqAlert', signal);
                    localStorage.setItem('_botRecentNasdaqAlertTimestamp', formatGMT5());
                } else {
                    console.log("Skipping duplicate signal..");
                }
            }
        }
    }

    function isSameVersion() {
        const currentVersion = GM_info.script.version;
        const recentVersion = localStorage.getItem('_botRecentVersion');

        if (!recentVersion) {
            localStorage.setItem('_botRecentVersion', currentVersion);
            return false;
        }

        if (recentVersion === currentVersion) {
            return true;
        }

        localStorage.setItem('_botRecentVersion', currentVersion);
        return false;
    }

    const timer = setupAutomationTimer({
        onInit: async (time) => {
            const msg = `Starting.. @v${localStorage.getItem('_botRecentVersion')}`
            console.log(msg);
            sendLog(msg).catch(err => { });
            syncRecentPineLogsTimestampFromBackend().catch(err => { });
        },
        onTick: async (count, time, logs) => {
            let minutes = 60;

            waitScrollToBottom();

            if (!isSameVersion()) {
                await sendLog(`Updating..`).catch(err => { });
                window.location.reload();
                return;
            }

            if (isReloadingHours()) {
                await sendLog(`Reloading..`).catch(err => { });
                window.location.reload();
                return;
            }

            if (count % (5 * minutes) === 0) {
                if (isOvernightWindowApproaching()) {
                    terminateAllActivePositionAndOrders();
                }
            }

            if (count % (15 * minutes) === 0) {
                isReloadRequested()
                sendAlert('...').catch(err => { });
                sendLog('Server is online').catch(err => { });
            }

            processPineLogs();

            if (isWeekend()) {
                return;
            }

            processRealtimeValues();
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
