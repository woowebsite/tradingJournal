/**
 * Formats a number based on a provided pattern.
 * @param {number|string} value - The number to format.
 * @param {string} pattern - The format pattern (e.g., '###', '#,###.##').
 * @returns {string} - The formatted number.
 */
export const formatNumber = (value, pattern = '#,###.##') => {
    if (value === null || value === undefined || value === '') return '-';

    const num = parseFloat(value);
    if (isNaN(num)) return '-';

    // Determine decimal places from pattern
    let maxDecimals = 0;
    if (pattern.includes('.')) {
        const parts = pattern.split('.');
        if (parts.length > 1) {
            maxDecimals = parts[1].length;
        }
    }

    return num.toLocaleString('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxDecimals
    });
};
