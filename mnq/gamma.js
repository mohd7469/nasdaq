// file://D:\projects\nasdaq\mnq\gamma.js

const config = JSON.parse(GM_info.script.description);
const { userName, password, apiKey } = config;

(function () {
    'use strict';

    const ibConfig = {
        apiUrl: "https://live.ironbeamapi.com/v2",
        symbol: "XCME:MNQ.Z26",
        userName: userName.slice(0, -1),
        password: password.slice(0, -1),
        apiKey: apiKey.slice(0, -1)
    };

    let tooltipEl = null;
    let liveNqPrice = null;
    let bearerToken = null;

    function createTooltip() {
        if (tooltipEl) return;
        tooltipEl = document.createElement('div');
        tooltipEl.id = 'nq-live-tooltip';
        tooltipEl.style.position = 'fixed';
        tooltipEl.style.top = '85px';
        tooltipEl.style.right = '20px';
        tooltipEl.style.zIndex = '999999';
        tooltipEl.style.background = 'rgba(18, 24, 36, 0.95)';
        // tooltipEl.style.border = '1px solid #00e676';
        tooltipEl.style.borderRadius = '8px';
        tooltipEl.style.padding = '12px 16px';
        tooltipEl.style.color = '#fff';
        tooltipEl.style.fontFamily = 'sans-serif';
        tooltipEl.style.fontSize = '12px';
        tooltipEl.style.boxShadow = '0 4px 12px rgba(0,0,0,0.5)';
        tooltipEl.style.pointerEvents = 'auto';
        tooltipEl.style.transition = 'opacity 0.2s ease-in-out';

        // tooltipEl.addEventListener('mouseenter', () => {
        //      tooltipEl.style.opacity = '0.1';
        // });
        // tooltipEl.addEventListener('mouseleave', () => {
        //      tooltipEl.style.opacity = '1';
        // });

        document.body.appendChild(tooltipEl);
    }

    async function authenticateIronbeam() {
        try {
            console.log("Authenticating..");

            const response = await axios.post(`${ibConfig.apiUrl}/auth`, {
                userName: ibConfig.userName,
                password: ibConfig.password,
                apiKey: ibConfig.apiKey
            }, {
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.data && response.data.token) {
                bearerToken = response.data.token;
            }
        } catch (error) {
            console.error("Auth Error:", error.response?.data || error.message);
        }
    }

    async function fetchIronbeamPrice() {
        if (!bearerToken) {
            await authenticateIronbeam();
            if (!bearerToken) return;
        }

        try {
            const response = await axios.get(`${ibConfig.apiUrl}/market/quotes`, {
                headers: { Authorization: `Bearer ${bearerToken}` },
                params: { symbols: ibConfig.symbol }
            });

            const data = response.data;

            if (data && data.quotes && data.quotes.length > 0) {
                const quote = data.quotes[0];
                if (quote.l) {
                    liveNqPrice = parseFloat(quote.l);
                    // console.log("MNQ:", liveNqPrice.toFixed(2));
                    await copyLevels();
                    await calculateLevels();
                }
            }
        } catch (error) {
            console.error("Fetch Error:", error.response?.data || error.message);
            bearerToken = null;
        }
    }

    async function copyLevels() {
        const copyBtn = document.querySelector('[aria-label="Copy levels to clipboard"]');
        if (copyBtn) {
            copyBtn.click();
        }
    }

    async function calculateLevels() {
        try {
            const clipboardText = await navigator.clipboard.readText();
            if (!clipboardText || !liveNqPrice) return;

            let qqqSpot = null;
            let parsedLevels = [];

            clipboardText.split('\n').forEach(line => {
                let parts = line.split(':');
                if (parts.length === 2) {
                    let key = parts[0].trim();
                    let val = parseFloat(parts[1].trim());

                    if (!isNaN(val)) {
                        if (key.toLowerCase().includes('spot')) {
                            qqqSpot = val;
                        } else {
                            parsedLevels.push({ key, val });
                        }
                    }
                }
            });

            if (!qqqSpot) return;

            const multiplier = liveNqPrice / qqqSpot;

            if (tooltipEl) {
                tooltipEl.style.border = '1px solid #00e676';

                let html = `
                <div style="font-weight: bold; color: #00e676; margin-bottom: 6px; border-bottom: 1px solid #334155; padding-bottom: 4px;">
                    <div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 3px;">
                        <span>MNQ:</span>
                        <div>${liveNqPrice.toFixed(2)}</div>
                    </div>
                </div>
                `;

                parsedLevels.forEach(item => {
                    let nqLevel = Math.round(item.val * multiplier);

                    let labelColor = '#94a3b8';
                    let lowerKey = item.key.toLowerCase();
                    if (lowerKey.includes('call wall')) {
                        labelColor = '#ff5252'; // Resistance
                    } else if (lowerKey.includes('put wall')) {
                        labelColor = '#00e676'; // Support
                    } else if (lowerKey.includes('gamma flip')) {
                        labelColor = '#ffab40'; // Flip
                    } else if (lowerKey.includes('gex')) {
                        labelColor = '#40c4ff'; // GEX
                    }

                    html += `<div style="display: flex; justify-content: space-between; gap: 15px; margin-bottom: 3px;">
                        <span style="color: ${labelColor};">${item.key}:</span>
                        <strong style="color: ${labelColor};">${nqLevel}</strong>
                    </div>`;
                });

                tooltipEl.innerHTML = html;
            }

        } catch (err) {
            if (tooltipEl) {
                tooltipEl.style.border = '1px solid #ff9800';
                tooltipEl.innerHTML = `<div style="color: #ff9800;">Click anywhere on Page</div>`;
            }
        }
    }

    async function init() {
        createTooltip();
        await authenticateIronbeam();
        await fetchIronbeamPrice();
        setInterval(fetchIronbeamPrice, 4000);
    }

    init();
})();