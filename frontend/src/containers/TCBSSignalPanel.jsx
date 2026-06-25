import React from 'react';

const getTcbsSignalStrategyName = (signal) => {
    return signal.strategy?.strategyName || signal.strategyName || signal.strategyKey || '-';
};

const TCBSSignalPanel = ({ signals = [], loading = false }) => {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
                <thead className="text-[11px] uppercase text-gray-500">
                    <tr>
                        <th className="px-2 py-2">Date</th>
                        <th className="px-2 py-2">Strategy Name</th>
                        <th className="px-2 py-2 text-right">Closed Price</th>
                        <th className="px-2 py-2 text-right">Volume</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/70">
                    {loading ? (
                        <tr>
                            <td colSpan="4" className="px-2 py-6 text-center text-gray-500">Loading recent signals...</td>
                        </tr>
                    ) : signals.length === 0 ? (
                        <tr>
                            <td colSpan="4" className="px-2 py-6 text-center text-gray-500">No recent signals found.</td>
                        </tr>
                    ) : signals.map(signal => (
                        <tr key={`tcbs-${signal.id || signal.documentId || signal.TDate}-${signal.strategyKey}`} className="hover:bg-gray-700/30">
                            <td className="whitespace-nowrap px-2 py-2 font-medium text-gray-200">{signal.TDate || '-'}</td>
                            <td className="px-2 py-2 text-gray-300">{getTcbsSignalStrategyName(signal)}</td>
                            <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-gray-300">{Number(signal.CPrice || 0).toLocaleString()}</td>
                            <td className="whitespace-nowrap px-2 py-2 text-right font-mono text-gray-300">{Number(signal.Volume || 0).toLocaleString()}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TCBSSignalPanel;
