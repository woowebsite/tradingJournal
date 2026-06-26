import { formatNumber } from './formatNumber';

export const formatMoney = (value, account = {}) => {
    const currency = account?.currency ?? account?.setting?.currency;
    const moneyFormat = account?.moneyFormat ?? account?.setting?.moneyFormat ?? '#,###.##';

    const formatted = formatNumber(value, moneyFormat);
    if (formatted === '-') return '-';
    return currency ? `${formatted} ${currency}` : formatted;
};
