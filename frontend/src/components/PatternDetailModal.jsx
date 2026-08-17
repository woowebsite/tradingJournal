import { useState } from 'react';
import { X } from 'lucide-react';
import TradingViewChart from './TradingViewChart';
import useEscapeKey from '../hooks/useEscapeKey';

const CANDLE_STYLES = {
    up: { label: 'Tăng', className: 'border-emerald-300/40 bg-emerald-500' },
    down: { label: 'Giảm', className: 'border-red-300/40 bg-red-500' },
    doji: { label: 'Doji', className: 'border-amber-200/50 bg-amber-400' },
};

const VOLUME_STYLES = {
    up: { label: 'Tăng', symbol: '↑', className: 'text-emerald-300' },
    down: { label: 'Giảm', symbol: '↓', className: 'text-red-300' },
    flat: { label: 'Đi ngang', symbol: '→', className: 'text-gray-300' },
};

const PREDICTION_STYLES = {
    up: { label: 'Tăng', className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' },
    down: { label: 'Giảm', className: 'border-red-500/30 bg-red-500/10 text-red-300' },
    doji: { label: 'Doji', className: 'border-amber-500/30 bg-amber-500/10 text-amber-300' },
};

const getPredictionDescription = prediction => {
    if (!prediction?.sampleSize) {
        return 'Chưa có lần xuất hiện nào đủ dữ liệu nến kế tiếp để đưa ra dự đoán.';
    }

    const hasAverageReturn = Number.isFinite(prediction.averageReturnPercent);
    const averageReturn = hasAverageReturn ? prediction.averageReturnPercent : 0;
    const returnText = hasAverageReturn
        ? ` Biến động open–close trung bình của nến kế tiếp là ${averageReturn >= 0 ? '+' : ''}${averageReturn.toFixed(2)}%.`
        : '';
    if (!prediction.dominantDirection) {
        return `Dựa trên ${prediction.sampleSize} lần có dữ liệu tiếp theo, chưa có hướng nến nào chiếm ưu thế rõ ràng.${returnText}`;
    }

    const dominant = PREDICTION_STYLES[prediction.dominantDirection];
    const count = prediction.counts[prediction.dominantDirection];
    const probability = prediction.probabilities[prediction.dominantDirection] * 100;
    return `Dựa trên ${prediction.sampleSize} lần có dữ liệu tiếp theo, ${count} lần hình thành nến ${dominant.label.toLowerCase()} (${probability.toFixed(1)}%).${returnText}`;
};

const PatternDetailModal = ({ isOpen, onClose, pattern, histories, symbol }) => {
    const [focusDate, setFocusDate] = useState(pattern?.lastSeen || '');

    useEscapeKey(onClose, isOpen);

    if (!isOpen || !pattern) return null;

    const prediction = pattern.prediction || {
        sampleSize: 0,
        counts: { up: 0, down: 0, doji: 0 },
        probabilities: { up: 0, down: 0, doji: 0 },
        dominantDirection: null,
        averageReturnPercent: 0,
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-gray-700 bg-gray-900 shadow-2xl">
                <div className="flex items-start justify-between gap-4 border-b border-gray-700 bg-gray-800/60 px-5 py-4">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-widest text-sky-400">Pattern Detail</p>
                        <div className="mt-2 flex flex-wrap items-center gap-5">
                            <div className="flex items-center gap-1.5" aria-label="Pattern nến">
                                {pattern.candles.map((direction, index) => {
                                    const style = CANDLE_STYLES[direction];
                                    return (
                                        <span
                                            key={`${pattern.key}-modal-candle-${index}`}
                                            role="img"
                                            aria-label={`Nến ${index + 1}: ${style.label}`}
                                            title={`Nến ${index + 1}: ${style.label}`}
                                            className={`block h-7 w-7 rounded-sm border ${style.className}`}
                                        />
                                    );
                                })}
                            </div>
                            <div className="flex items-center gap-3">
                                {pattern.volumes.map((direction, index) => {
                                    const style = VOLUME_STYLES[direction];
                                    return (
                                        <span key={`${pattern.key}-modal-volume-${index}`} className={`text-xs font-semibold ${style.className}`}>
                                            V{index + 2}/V{index + 1} {style.symbol} {style.label}
                                        </span>
                                    );
                                })}
                            </div>
                            <span className="rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs font-semibold text-sky-300">
                                {pattern.count} lần · {pattern.percentage.toFixed(1)}%
                            </span>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-full p-2 text-gray-400 transition hover:bg-gray-700 hover:text-white" aria-label="Đóng">
                        <X size={22} />
                    </button>
                </div>

                <div className="px-5 pt-5">
                    <div className="rounded-xl border border-indigo-500/25 bg-indigo-500/10 px-4 py-3">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-sm font-bold text-indigo-200">Dự đoán nến tiếp theo</h3>
                                    {prediction.dominantDirection && (
                                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${PREDICTION_STYLES[prediction.dominantDirection].className}`}>
                                            {PREDICTION_STYLES[prediction.dominantDirection].label}
                                        </span>
                                    )}
                                </div>
                                <p className="mt-1.5 text-sm leading-6 text-gray-300">{getPredictionDescription(prediction)}</p>
                                <p className="mt-1 text-[11px] text-gray-500">Dự đoán dựa trên tần suất lịch sử, không đảm bảo kết quả tương lai.</p>
                            </div>
                            {prediction.sampleSize > 0 && (
                                <div className="flex shrink-0 gap-2">
                                    {['up', 'down', 'doji'].map(direction => (
                                        <div key={direction} className={`min-w-16 rounded-lg border px-2 py-1.5 text-center ${PREDICTION_STYLES[direction].className}`}>
                                            <div className="text-xs font-bold">{(prediction.probabilities[direction] * 100).toFixed(1)}%</div>
                                            <div className="text-[10px] opacity-80">{PREDICTION_STYLES[direction].label}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-5 lg:flex-row lg:overflow-hidden">
                    <div className="h-[430px] min-h-[430px] flex-1 overflow-hidden rounded-xl border border-gray-700 bg-gray-800 lg:h-auto">
                        <TradingViewChart data={histories} symbol={symbol} focusDate={focusDate} />
                    </div>

                    <div className="flex min-h-0 shrink-0 flex-col lg:w-72">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <h3 className="font-bold text-gray-100">Các lần xuất hiện cùng pattern</h3>
                                <p className="mt-1 text-xs text-gray-500">Chọn ngày để di chuyển chart tới nến N3.</p>
                            </div>
                        </div>
                        <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-gray-700">
                            <table className="w-full text-left text-sm">
                                <thead className="sticky top-0 z-10 bg-gray-800 text-xs uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="px-4 py-3">Lần</th>
                                        <th className="px-4 py-3">Ngày (Nến 3)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700/70">
                                    {(pattern.occurrences || []).map((occurrence, index) => {
                                        const endDate = occurrence.endDate || occurrence.dates?.[2];
                                        const selected = focusDate === endDate;
                                        return (
                                            <tr
                                                key={`${pattern.key}-${occurrence.dates?.join('-') || endDate}`}
                                                onClick={() => setFocusDate(endDate)}
                                                className={`cursor-pointer transition hover:bg-sky-500/10 ${selected ? 'bg-amber-500/10' : ''}`}
                                            >
                                                <td className={`px-4 py-3 font-semibold ${selected ? 'text-amber-300' : 'text-gray-400'}`}>#{index + 1}</td>
                                                <td className="whitespace-nowrap px-4 py-3 font-mono text-sky-300">{endDate}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PatternDetailModal;
