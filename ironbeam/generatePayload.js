export function generatePayload(ibConfig, { side, resolvedEntryPrice, tp, sl }, orderType = 'LIMIT') {
    const basePayload = {
        accountId: ibConfig.accountId,
        exchSym: ibConfig.symbol,
        quantity: 1,
        side: side === 'LONG' ? 'BUY' : 'SELL',
        duration: 'DAY'
    };

    const normalizedType = orderType.toUpperCase();

    if (normalizedType === 'MARKET') {
        const entryPrice = Number(resolvedEntryPrice);
        const takeProfitOffset = Math.abs(Number(tp) - entryPrice);
        const stopLossOffset = Math.abs(entryPrice - Number(sl));

        return {
            ...basePayload,
            orderType: 'MARKET',
            stopLossOffset: Number(stopLossOffset.toFixed(2)),
            takeProfitOffset: Number(takeProfitOffset.toFixed(2))
        };
    }

    if (normalizedType === 'STOP') {
        return {
            ...basePayload,
            orderType: 'STOP',
            stopPrice: Number(resolvedEntryPrice),
            takeProfit: Number(tp),
            stopLoss: Number(sl)
        };
    }

    return {
        ...basePayload,
        orderType: 'LIMIT',
        limitPrice: Number(resolvedEntryPrice),
        takeProfit: Number(tp),
        stopLoss: Number(sl)
    };
}
