import React from 'react';

const IndicatorTable = ({ indicators }) => {
    // Debug: Check what we actually got
    // console.log('IndicatorTable received:', indicators);

    // If it's an object with a specific property (like 'data') that is an array, use that.
    // Or if it's the gauge chart summary, maybe wrap it in an array or display differently.

    let displayData = [];

    if (Array.isArray(indicators)) {
        displayData = indicators;
    }

    if (!displayData || displayData.length === 0) {
        return (
            <div className="text-gray-500 text-center p-4">
                No indicator signals available.
            </div>
        );
    }

    // Helper to determine color based on signal
    const getSignalColor = (signal) => {
        const s = signal?.toLowerCase() || '';
        if (s.includes('buy')) return 'text-green-400';
        if (s.includes('sell')) return 'text-red-400';
        if (s.includes('neutral')) return 'text-yellow-400';
        return 'text-gray-300';
    };

    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead className="bg-gray-900/50 text-gray-400 uppercase font-semibold">
                    <tr>
                        <th className="p-3">Indicator</th>
                        <th className="p-3">Signal</th>
                        <th className="p-3 text-right">Value</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/50">
                    {displayData.map((item, index) => (
                        <tr key={index} className="hover:bg-gray-700/30 transition">
                            <td className="p-3 text-white font-medium">{item.indicator}</td>
                            <td className={`p-3 font-bold ${getSignalColor(item.signal)}`}>
                                {item.signal}
                            </td>
                            {/* Assuming value might exist, or maybe just show description if different */}
                            <td className="p-3 text-right text-gray-400 font-mono">
                                {item.value !== undefined ? item.value : '-'}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default IndicatorTable;
