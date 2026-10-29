import axios from 'axios';

export async function getLiveMarketPrice(token, ibConfig) {
    try {
        const response = await axios.get(`${ibConfig.apiUrl}/market/quotes`, {
            headers: { Authorization: `Bearer ${token}` },
            params: { symbols: ibConfig.symbol }
        });

        const quotes = response.data.Quotes || response.data.quotes || response.data || [];
        const quoteObj = quotes.find(q => (q.s === ibConfig.symbol || q.symbol === ibConfig.symbol));
        const marketPrice = quoteObj?.l !== undefined ? quoteObj.l : quoteObj?.lastPrice;

        return marketPrice !== undefined && marketPrice !== null ? Number(marketPrice) : null;
    } catch (error) {
        return null;
    }
}
