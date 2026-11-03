import axios from 'axios';

export async function getAuthToken(ibConfig) {
    console.log('getAuthToken(ibConfig): ', ibConfig);

    try {
        const response = await axios.post(`${ibConfig.apiUrl}/auth`, {
            username: ibConfig.username,
            password: ibConfig.password,
            apiKey: ibConfig.apiKey
        });
        return response.data.token;
    } catch (error) {
        throw new Error(`Failed to authenticate account ${ibConfig.accountId}: ${error.response?.data?.message || error.message}`);
    }
}
