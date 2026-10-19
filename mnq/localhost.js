const API_URL = 'https://app-nasdaq.vercel.app/api/send';
const testkWebhook = async (text) => {
    try {
        await axios.post(API_URL, { bot: 'dxbmnq_bot', text });
        await axios.post(API_URL, { bot: 'dxblog_bot', text });
    } catch (err) {
        console.error('Alert Error:', err?.message);
    }
}
// testkWebhook(`Test Webhook`)

const response = await fetch('https://raw.githubusercontent.com/mohd7469/nasdaq/refs/heads/main/api/config.json');
const config = await response.json();