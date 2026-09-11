/**
 * Deflated Sharpe Ratio (DSR) & Probabilistic Sharpe Ratio (PSR)
 * Based on the seminal research by Prof. Marcos López de Prado (2014):
 * "The Deflated Sharpe Ratio: Correcting for Selection Bias, Backtest Overfitting and Non-Normality"
 * Journal of Portfolio Management, 40(5), 94-107.
 */

// Euler-Mascheroni Constant
const EULER_MASCHERONI = 0.57721566490153286;

/**
 * Abramowitz & Stegun error function approximation
 */
export function erf(x) {
    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = x < 0 ? -1 : 1;
    const absX = Math.abs(x);
    const t = 1.0 / (1.0 + p * absX);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
    return sign * y;
}

/**
 * Standard Normal Cumulative Distribution Function Φ(z)
 */
export function normCdf(z) {
    return 0.5 * (1.0 + erf(z / Math.SQRT2));
}

/**
 * Acklam's approximation for Inverse Normal Cumulative Distribution Function Φ⁻¹(p)
 */
export function normInv(p) {
    if (p <= 0) return -8.0;
    if (p >= 1) return 8.0;

    const a = [
        -3.969683028665376e+01,
        2.209460984245205e+02,
        -2.759285104469687e+02,
        1.383577518672690e+02,
        -3.066479806614716e+01,
        2.506628277459239e+00
    ];
    const b = [
        -5.447609879822406e+01,
        1.615858368580409e+02,
        -1.556989798598866e+02,
        6.680131188771972e+01,
        -1.328068155288572e+01
    ];
    const c = [
        -7.784894002430293e-03,
        -3.223964580411365e-01,
        -2.400758277161838e+00,
        -2.549732539343734e+00,
        4.374664141464968e+00,
        2.938163982698783e+00
    ];
    const d = [
        7.784695709041462e-03,
        3.224671290700398e-01,
        2.445134137142996e+00,
        3.754408661907416e+00
    ];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;

    if (p < pLow) {
        const q = Math.sqrt(-2 * Math.log(p));
        return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
            ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    if (p <= pHigh) {
        const q = p - 0.5;
        const r = q * q;
        return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
            (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
    }
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

/**
 * Calculates Deflated Sharpe Ratio (DSR), Probabilistic Sharpe Ratio (PSR),
 * Higher Moments (Skewness, Kurtosis), and Minimum Track Record Length (MinTRL).
 *
 * @param {Array} trades - Array of trade objects from backtest
 * @param {number} numTrials - Total number of trials/configurations tested (N)
 * @param {Object} options - Additional options (benchmark, riskFreeRate, timeframe)
 */
export function calculateDSRMetrics(trades = [], numTrials = 1440, options = {}) {
    const {
        benchmarkSR = 0,
        riskFreeRatePerTrade = 0,
        timeframe = 'D1'
    } = options;

    if (!Array.isArray(trades) || trades.length === 0) {
        return null;
    }

    // Filter closed trades with valid PnL
    const closedTrades = trades.filter(t => t.status === 'Closed' && t.pnl_percent !== undefined);
    const T = closedTrades.length;

    if (T < 3) {
        return {
            insufficientData: true,
            totalTrades: T,
            message: `Cần tối thiểu 3 lệnh giao dịch đã đóng để tính toán DSR (hiện có ${T} lệnh).`
        };
    }

    // Return series (in percentage or decimal)
    const returns = closedTrades.map(t => Number(t.pnl_percent || 0) - riskFreeRatePerTrade);

    // 1. Mean & Variance
    const mean = returns.reduce((acc, r) => acc + r, 0) / T;
    const variance = returns.reduce((acc, r) => acc + Math.pow(r - mean, 2), 0) / (T - 1);
    const std = Math.sqrt(variance);

    if (std === 0 || isNaN(std)) {
        return {
            insufficientData: true,
            totalTrades: T,
            message: 'Độ biến động lợi nhuận bằng 0 hoặc không hợp lệ.'
        };
    }

    // 2. Sample Sharpe Ratio (Per-trade)
    const sr = mean / std;

    // 3. Higher Moments: Skewness (γ₃) & Kurtosis (γ₄)
    const skewness = (returns.reduce((acc, r) => acc + Math.pow(r - mean, 3), 0) / T) / Math.pow(std, 3);
    const kurtosis = (returns.reduce((acc, r) => acc + Math.pow(r - mean, 4), 0) / T) / Math.pow(std, 4);

    // 4. Standard Error of Estimated Sharpe Ratio (Lo / Mertens)
    // σ_SR = sqrt( (1 - γ₃*SR + ((γ₄ - 1)/4)*SR²) / (T - 1) )
    const varianceFactor = 1 - (skewness * sr) + (((kurtosis - 1) / 4) * Math.pow(sr, 2));
    const safeVarianceFactor = Math.max(0.000001, varianceFactor);
    const srStdError = Math.sqrt(safeVarianceFactor / (T - 1));

    // 5. Expected Maximum Sharpe Ratio E[max SR] under Null Hypothesis across N trials
    const N = Math.max(1, Math.round(numTrials));
    let expectedMaxSR = 0;
    if (N > 1) {
        const e = Math.E;
        const term1 = (1 - EULER_MASCHERONI) * normInv(1 - (1 / N));
        const term2 = EULER_MASCHERONI * normInv(1 - (1 / (N * e)));
        expectedMaxSR = srStdError * (term1 + term2);
    }

    // 6. Probabilistic Sharpe Ratio (PSR) vs benchmark
    const psrZ = (sr - benchmarkSR) / srStdError;
    const psr = normCdf(psrZ);

    // 7. Deflated Sharpe Ratio (DSR)
    const dsrZ = (sr - expectedMaxSR) / srStdError;
    const dsr = normCdf(dsrZ);

    // 8. Haircut Ratio (Phần trăm SR bị thổi phồng do thử nghiệm nhiều lần)
    const haircutRatio = expectedMaxSR > 0 ? Math.min(100, Math.max(0, (expectedMaxSR / Math.max(0.0001, sr)) * 100)) : 0;

    // 9. Minimum Track Record Length (MinTRL) at 95% confidence (alpha = 0.05)
    let minTRL = Infinity;
    if (sr > benchmarkSR) {
        const z95 = normInv(0.95); // ~1.64485
        minTRL = Math.ceil(1 + safeVarianceFactor * Math.pow(z95 / (sr - benchmarkSR), 2));
    }

    // 10. Annualized Scaling Approximation
    let periodsPerYear = 252; // Default daily
    const tfUpper = String(timeframe || 'D1').toUpperCase();
    if (tfUpper === 'M1') periodsPerYear = 252 * 390;
    else if (tfUpper === 'M5') periodsPerYear = 252 * 78;
    else if (tfUpper === 'M15') periodsPerYear = 252 * 26;
    else if (tfUpper === 'M30') periodsPerYear = 252 * 13;
    else if (tfUpper === 'H1') periodsPerYear = 252 * 6.5;
    else if (tfUpper === 'H4') periodsPerYear = 252 * 1.6;
    else if (tfUpper === 'W1') periodsPerYear = 52;
    else if (tfUpper === 'MN' || tfUpper === '1M') periodsPerYear = 12;

    // Trades per year rate
    const tradesPerYear = Math.max(1, T * (periodsPerYear / Math.max(1, trades.length)));
    const annualizedSR = sr * Math.sqrt(Math.min(periodsPerYear, Math.max(10, T)));

    // 11. Overfitting Risk Level & Diagnostic Verdict
    let riskLevel = 'LOW';
    let riskLabel = 'Đạt Chuẩn Thống Kê';
    let riskColor = 'emerald';
    let recommendation = 'Chiến lược vượt qua bài kiểm định kiểm soát Data Snooping. Hiệu suất có căn cứ thống kê vững chắc, ít bị ảnh hưởng bởi Overfitting. Đạt điều kiện chạy Forward Testing.';

    if (dsr < 0.80) {
        riskLevel = 'HIGH';
        riskLabel = 'Nguy Cơ Overfitting Cao';
        riskColor = 'rose';
        recommendation = `Hiệu suất hiện tại có xác suất cao là do may mắn thống kê từ việc chạy ${N.toLocaleString()} thử nghiệm. Hãy giảm số tham số Grid Search hoặc tăng số lượng nến mẫu (hiện có ${T} lệnh, cần tối thiểu ${minTRL !== Infinity ? minTRL : 'nhiều hơn'} lệnh).`;
    } else if (dsr < 0.95) {
        riskLevel = 'MODERATE';
        riskLabel = 'Mức Độ Tin Cậy Trung Bình';
        riskColor = 'amber';
        recommendation = `Hiệu suất khá tốt nhưng bị ảnh hưởng một phần bởi Selection Bias từ ${N.toLocaleString()} thử nghiệm. Khuyến nghị kiểm tra thêm Walk-Forward Analysis trên dữ liệu Out-of-Sample.`;
    }

    return {
        insufficientData: false,
        totalTrades: T,
        numTrials: N,
        meanReturn: mean,
        stdReturn: std,
        sharpeRatio: sr,
        annualizedSharpeRatio: annualizedSR,
        skewness: skewness,
        kurtosis: kurtosis,
        excessKurtosis: kurtosis - 3,
        srStdError: srStdError,
        expectedMaxSR: expectedMaxSR,
        psr: psr,
        dsr: dsr,
        dsrPercent: dsr * 100,
        psrPercent: psr * 100,
        haircutRatio: haircutRatio,
        minTRL: minTRL,
        riskLevel,
        riskLabel,
        riskColor,
        recommendation,
        isSignificant: dsr >= 0.95
    };
}
