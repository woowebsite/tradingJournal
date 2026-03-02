export const calculateSMA = (data, count, key = 'close') => {
    const result = [];
    for (let i = 0; i < data.length; i++) {
        if (i < count - 1) {
            // Not enough data for SMA yet
            continue;
        }
        let sum = 0;
        for (let j = 0; j < count; j++) {
            sum += data[i - j][key];
        }
        result.push({
            time: data[i].time,
            value: sum / count,
        });
    }
    return result;
};
