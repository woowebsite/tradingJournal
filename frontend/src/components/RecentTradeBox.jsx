import React from 'react';

const RecentTradeBox = ({ trades, onTradeClick }) => {
    if (!trades || trades.length === 0) {
        return <p className="text-gray-500 italic">No trades recorded yet.</p>;
    }

    return (
        <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-left">
                <thead className="bg-gray-900/50 text-gray-400 text-xs uppercase">
                    <tr>
                        <th className="p-3">Date</th>
                        <th className="p-3">Symbol</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">Status</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                    {trades.map(trade => (
                        <tr
                            key={trade.id}
                            onClick={() => onTradeClick && onTradeClick(trade)}
                            className="hover:bg-gray-700/30 cursor-pointer transition border-b border-gray-700/30 last:border-b-0"
                        >
                            <td className="p-3 text-gray-300 text-sm whitespace-nowrap">
                                {new Date(trade.date).toLocaleDateString()}
                            </td>
                            <td className="p-3 font-bold text-white whitespace-nowrap">
                                {trade.symbol?.Name || '-'}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.type === 'Long' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                    {trade.type}
                                </span>
                            </td>
                            <td className="p-3 font-mono whitespace-nowrap">
                                <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.trade_status === 'Open' ? 'bg-blue-500/20 text-blue-400' :
                                    trade.trade_status === 'Pending' ? 'bg-yellow-500/20 text-yellow-400' :
                                        'bg-gray-500/20 text-gray-400'
                                    }`}>
                                    {trade.trade_status}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default RecentTradeBox;
