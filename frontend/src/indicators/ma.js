export const calculateMA = (dayCount, data) => {
    const result = [];
    for (let i = 0, len = data.length; i < len; i++) {
        if (i < dayCount - 1) {
            result.push('-');
            continue;
        }
        let sum = 0;
        for (let j = 0; j < dayCount; j++) {
            sum += data[i - j].close;
        }
        result.push(+(sum / dayCount).toFixed(2));
    }
    return result;
};
