// Returns the number of decimal places in a number or string
export default function getDecimalPlaces(value) {
    if (typeof value === 'number') {
        value = value.toString();
    }
    if (typeof value !== 'string' || value.trim() === '') return 0;
    const parts = value.split('.');
    if (parts.length < 2) return 0;
    return parts[1].replace(/0+$/, '').length;
}
