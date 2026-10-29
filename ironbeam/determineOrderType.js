import { getLiveMarketPrice } from './getLiveMarketPrice.js';

export async function determineOrderType(token, ibConfig, { side, price }, requestedOrderType) {
    if (requestedOrderType?.trim()) {
        const customType = requestedOrderType.toUpperCase();
        const marketPrice = customType === 'MARKET' ? await getLiveMarketPrice(token, ibConfig) : null;
        return { orderType: customType, marketPrice };
    }

    const marketPrice = await getLiveMarketPrice(token, ibConfig);
    if (marketPrice === null) {
        return { orderType: 'LIMIT', marketPrice: null };
    }

    const sigPrice = Number(price);
    const upperSide = side.toUpperCase();

    if (upperSide === 'LONG') {
        return { orderType: sigPrice <= marketPrice ? 'LIMIT' : 'STOP', marketPrice };
    }

    if (upperSide === 'SHORT') {
        return { orderType: sigPrice >= marketPrice ? 'LIMIT' : 'STOP', marketPrice };
    }

    return { orderType: 'LIMIT', marketPrice };
}
