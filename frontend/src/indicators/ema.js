export const calculateEMA = (dayCount, data, key = 'close') => {
    const k = 2 / (dayCount + 1);
    const result = [];
    let ema = data[0][key];
    result.push(ema);
    for (let i = 1; i < data.length; i++) {
        ema = (data[i][key] * k) + (ema * (1 - k));
        result.push(ema);
    }
    return result;
};
