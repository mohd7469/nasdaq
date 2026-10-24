import axios from 'axios';

const response = await fetch('https://raw.githubusercontent.com/mohd7469/nasdaq/refs/heads/main/api/config.json');
const config = await response.json();
const bots = Object.keys(config.BOTS_CONFIG);

const API_URL = 'http://localhost:3000/api';


const testkWebhook = async (text = 'typing') => {
    try {
        for (const bot of bots) {
            await axios.post(`${API_URL}/send`, { bot, text });
        }
    } catch (err) {
        console.error('Webhook Error:', err?.message);
    }
}

const handleTrade = async (payload) => {
    try {
        await axios.post(`${API_URL}/trade`, payload);
    } catch (err) {
        console.error('Trade Error:', err?.message);
    }
}

// testkWebhook(`...`)

// handleTrade({
//     "timestamp": "2026-10-26T18:30:00.000+05:00",
//     "side": "LONG",
//     "action": "ENTRY",
//     "price": ,
//     "tp": ,
//     "sl": ,
// })
// handleTrade({
//     "action": "EXIT"
// })

// handleTrade({
//     "timestamp": "2026-10-26T18:30:00.000+05:00",
//     "side": "SHORT",
//     "action": "ENTRY",
//     "price": ,
//     "tp": ,
//     "sl": ,
// })
// handleTrade({
//     "action": "EXIT"
// })
