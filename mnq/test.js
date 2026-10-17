const API_URL = 'https://app-nasdaq.vercel.app/api/send';
const sendAlert = async (text = 'Test Alert') => {
    try {
        await axios.post(API_URL, { bot: 'dxbmnq_bot', text });
        await axios.post(API_URL, { bot: 'dxblog_bot', text });
    } catch (err) {
        console.error('Alert Error:', err?.message);
    }
}
sendAlert(`Test Success`)