import React from 'react';

const getRecommendationTypeLabel = (type) => {
    const labels = {
        1: 'Mua',
        2: 'Bán',
        3: 'Chờ mua',
        4: 'Nắm giữ',
    };

    return labels[type] || `Type ${type ?? '-'}`;
};

const getRecommendationTypeTone = (type) => {
    if (Number(type) === 1 || Number(type) === 3) return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
    if (Number(type) === 2) return 'bg-red-500/15 text-red-300 border-red-500/30';
    if (Number(type) === 4) return 'bg-yellow-500/15 text-yellow-200 border-yellow-500/30';
    return 'bg-gray-600/30 text-gray-300 border-gray-500/30';
};

const TCBSRecommendPanel = ({ recommendations = [], loading = false }) => {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
                <thead className="text-[11px] uppercase text-gray-500">
                    <tr>
                        <th className="px-2 py-2">Date</th>
                        <th className="px-2 py-2">Type</th>
                        <th className="px-2 py-2">Reason</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-700/70">
                    {loading ? (
                        <tr>
                            <td colSpan="3" className="px-2 py-6 text-center text-gray-500">Loading recommendations...</td>
                        </tr>
                    ) : recommendations.length === 0 ? (
                        <tr>
                            <td colSpan="3" className="px-2 py-6 text-center text-gray-500">No recommendations found.</td>
                        </tr>
                    ) : recommendations.map(item => (
                        <tr key={item.documentId || item.id || `${item.d}-${item.ticker}-${item.type}`} className="align-top hover:bg-gray-700/30">
                            <td className="whitespace-nowrap px-2 py-2 font-mono text-gray-400">{item.d || '-'}</td>
                            <td className="px-2 py-2">
                                <div className="inline-flex flex-col items-start gap-1">
                                    <span className={`inline-flex whitespace-nowrap rounded border px-2 py-1 text-[11px] font-semibold ${getRecommendationTypeTone(item.type)}`}>
                                        {getRecommendationTypeLabel(item.type)}
                                    </span>
                                    {item.value !== null && item.value !== undefined && item.value !== '' && (
                                        <span className="whitespace-nowrap font-mono text-[11px] text-gray-500">{item.value}</span>
                                    )}
                                </div>
                            </td>
                            <td className="px-2 py-2 text-gray-300">
                                <p className="line-clamp-3 leading-5">{item.reason || '-'}</p>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default TCBSRecommendPanel;
