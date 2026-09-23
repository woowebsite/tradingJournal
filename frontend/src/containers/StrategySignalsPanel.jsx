import React from 'react';
import dayjs from 'dayjs';

const StrategySignalsPanel = ({ signals = [] }) => {
    if (!signals || signals.length === 0) {
        return (
            <div className="text-sm text-gray-300 p-1">
                <p className="text-gray-500 italic text-center mt-4">
                    Chưa có tín hiệu khớp lệnh (Trade / TradeDetail) nào cho mã này.
                </p>
            </div>
        );
    }

    return (
        <div className="text-sm text-gray-300 p-1 max-h-[220px] overflow-y-auto custom-scrollbar pr-1.5">
            <ul className="space-y-2">
                {signals.map((signal, i) => {
                    const isBuy = signal.shape === 'arrowUp' || signal.type === 'entry' && signal.posType === 'Long';
                    const isTP = signal.type === 'takeprofit' || signal.action?.toLowerCase().includes('take');
                    const isSL = signal.type === 'stoploss' || signal.action?.toLowerCase().includes('stop');
                    const badgeColor = isTP ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                        isSL ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                            isBuy ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                                'bg-amber-500/20 text-amber-300 border-amber-500/40';

                    return (
                        <li key={signal.id || i} className="border-b border-gray-700/50 pb-2 last:border-0">
                            <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold border ${badgeColor}`}>
                                        {signal.action || signal.posType || 'Signal'}
                                    </span>
                                    <span className="font-semibold text-gray-200 text-xs">
                                        {signal.text || signal.name || 'Executed Trade'}
                                    </span>
                                </div>
                                {signal.status && (
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-semibold ${
                                        signal.status === 'Open'
                                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                            : 'bg-gray-800 text-gray-400'
                                    }`}>
                                        {signal.status}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                                <span>
                                    {signal.volume ? `Khối lượng: ${signal.volume}` : ''}{' '}
                                    {signal.price ? `| Giá: $${signal.price}` : ''}
                                </span>
                                {signal.date && (
                                    <span className="font-mono text-gray-500">
                                        {dayjs(signal.date).format('YYYY-MM-DD HH:mm:ss')}
                                    </span>
                                )}
                            </div>
                        </li>
                    );
                })}
            </ul>
        </div>
    );
};

export default StrategySignalsPanel;
