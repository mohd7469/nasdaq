// file://D:\projects\nasdaq\mnq\gamma.js

const config = JSON.parse(GM_info.script.description);
const { username, password, apiKey } = config;

(function () {
    'use strict';

    const ibConfig = {
        apiUrl: "https://live.ironbeamapi.com/v2",
        symbol: "XCME:MNQ.Z26",
        username: username.slice(0, -1),
        password: password.slice(0, -1),
        apiKey: apiKey.slice(0, -1)
    };

    let liveNqPrice = null;
    let bearerToken = null;

    async function authenticateIronbeam() {
        try {
            console.log("Authenticating..");

            const response = await axios.post(`${ibConfig.apiUrl}/auth`, {
                username: ibConfig.username,
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
                    console.log("MNQ:", liveNqPrice.toFixed(2));
                }
            }
        } catch (error) {
            console.error("Fetch Error:", error.response?.data || error.message);
            bearerToken = null;
        }
    }

    async function init() {
        await authenticateIronbeam();
        fetchIronbeamPrice();
        setInterval(fetchIronbeamPrice, 4000);
    }

    init();
})();