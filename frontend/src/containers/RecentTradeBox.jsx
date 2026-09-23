import React from 'react';

const RecentTradeBox = ({ trades, onTradeClick, onCloseTrade }) => {
    if (!trades || trades.length === 0) {
        return <p className="px-2 py-6 text-center text-gray-500">No trades recorded yet.</p>;
    }

    return (
        <div className="overflow-x-auto max-h-[220px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left text-xs">
                <thead className="text-[11px] uppercase text-gray-500">
                    <tr>
                        <th className="px-2 py-2">Date</th>
                        <th className="px-2 py-2">Symbol</th>
                        <th className="px-2 py-2">Type</th>
                        <th className="px-2 py-2">Status</th>
                        {onCloseTrade && <th className="px-2 py-2 text-right">Action</th>}
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/70">
                    {trades.map(trade => (
                        <tr
                            key={trade.documentId || trade.id}
                            onClick={() => onTradeClick && onTradeClick(trade)}
                            className="cursor-pointer transition hover:bg-gray-700/30"
                        >
                            <td className="whitespace-nowrap px-2 py-2 font-medium text-gray-200">
                                {new Date(trade.date).toLocaleDateString()}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 text-gray-300">
                                {trade.symbol?.Name || '-'}
                            </td>
                            <td className="whitespace-nowrap px-2 py-2">
                                <span className={`inline-flex rounded border px-2 py-1 text-[11px] font-semibold ${trade.type === 'Long' ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-300' : 'border-red-500/30 bg-red-500/15 text-red-300'}`}>
                                    {trade.type}
                                </span>
                            </td>
                            <td className="whitespace-nowrap px-2 py-2 font-mono">
                                <span className={`inline-flex rounded border px-2 py-1 text-[11px] font-semibold ${trade.trade_status === 'Open' ? 'border-blue-500/30 bg-blue-500/15 text-blue-300' :
                                    trade.trade_status === 'Pending' ? 'border-yellow-500/30 bg-yellow-500/15 text-yellow-200' :
                                        'border-gray-500/30 bg-gray-600/30 text-gray-300'
                                    }`}>
                                    {trade.trade_status}
                                </span>
                            </td>
                            {onCloseTrade && (
                                <td className="whitespace-nowrap px-2 py-2 text-right">
                                    {trade.trade_status === 'Open' && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onCloseTrade(trade);
                                            }}
                                            className="px-2.5 py-1 rounded text-[11px] font-bold bg-rose-600 hover:bg-rose-500 text-white shadow transition cursor-pointer border border-rose-500/50 inline-flex items-center gap-1"
                                            title="Chủ động đóng vị thế này"
                                        >
                                            Close
                                        </button>
                                    )}
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default RecentTradeBox;
