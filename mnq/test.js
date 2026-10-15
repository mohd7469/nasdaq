const API_URL = 'https://app-nasdaq.vercel.app/api/send';
const sendAlert = async (text = 'Test Alert') => {
    try {
        await axios.post(API_URL, { bot: 'dxbmnq_bot', text });
    } catch (err) {
        console.error('Alert Error:', err?.message);
    }
}
sendAlert(`Starting @v1.7..`)