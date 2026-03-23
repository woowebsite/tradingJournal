import { useState, useEffect } from 'react';
import { getTCBSOrders } from '../../services/tcbsJournal';
import { Filter } from 'lucide-react';

const OrderHistory = ({ jwtToken, onAuthError }) => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!jwtToken) return;

        const fetchOrders = async () => {
            try {
                setLoading(true);
                setError(null);
                const accountNo = import.meta.env.VITE_TCBS_ACCOUNT_NO;
                if (!accountNo) {
                    throw new Error("VITE_TCBS_ACCOUNT_NO is not configured.");
                }
                const ordersData = await getTCBSOrders(accountNo, jwtToken);
                // The user only wants matched orders (4: Đã khớp, 12: Khớp hết) based on their manual edit
                setOrders(ordersData.filter(order => order.orStatus === '4' || order.orStatus === '12') || []);
            } catch (err) {
                console.error("Error fetching orders:", err);
                setError(err.message || 'Failed to fetch trading history');
                if (err.message.includes('401') || err.message.includes('Unauthorized')) {
                    if (onAuthError) onAuthError();
                }
            } finally {
                setLoading(false);
            }
        };

        fetchOrders();
    }, [jwtToken, onAuthError]);

    return (
        <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-800/50">
                <h3 className="text-lg font-bold">Order History</h3>
                <button className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 border border-gray-600 rounded-lg hover:bg-gray-600 transition text-sm">
                    <Filter size={14} />
                    Filter
                </button>
            </div>
            
            {error && (
                <div className="m-4 bg-red-500/20 border border-red-500 text-red-400 p-3 rounded-lg text-sm">
                    {error}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left whitespace-nowrap text-sm">
                    <thead className="bg-gray-700/50 text-gray-400">
                        <tr>
                            <th className="p-4 font-semibold">Order Time</th>
                            <th className="p-4 font-semibold">Symbol</th>
                            <th className="p-4 font-semibold">Side</th>
                            <th className="p-4 font-semibold">Price</th>
                            <th className="p-4 font-semibold">Match Volume</th>
                            <th className="p-4 font-semibold">Total Volume</th>
                            <th className="p-4 font-semibold">Match Value</th>
                            <th className="p-4 font-semibold">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {loading ? (
                            <tr><td colSpan="8" className="p-8 text-center text-gray-500">Loading history...</td></tr>
                        ) : orders.length === 0 ? (
                            <tr><td colSpan="8" className="p-8 text-center text-gray-500">No matched trading history found.</td></tr>
                        ) : orders.map((order, idx) => {
                            // Match the exact TCBS json structure
                            const isBuy = order.execType?.includes('B');
                            const sideText = isBuy ? 'Buy' : 'Sell';

                            // Map the status
                            let statusText = order.orStatus || '-';
                            let statusClass = 'bg-gray-500/20 text-gray-400';

                            switch (order.orStatus) {
                                case '0': statusText = 'Từ chối'; statusClass = 'bg-red-500/20 text-red-400'; break;
                                case '2': statusText = 'Đã gửi'; statusClass = 'bg-blue-500/20 text-blue-400'; break;
                                case '3': statusText = 'Đã hủy'; statusClass = 'bg-gray-500/20 text-gray-400'; break;
                                case '4': statusText = 'Đã khớp'; statusClass = 'bg-green-500/20 text-green-400'; break;
                                case '5': statusText = 'Hết hiệu lực'; statusClass = 'bg-gray-500/20 text-gray-400'; break;
                                case '8': statusText = 'Chờ gửi'; statusClass = 'bg-yellow-500/20 text-yellow-400'; break;
                                case '10': statusText = 'Đã sửa'; statusClass = 'bg-blue-500/20 text-blue-400'; break;
                                case '11': statusText = 'Đang gửi'; statusClass = 'bg-blue-500/20 text-blue-400'; break;
                                case '12': statusText = 'Khớp hết'; statusClass = 'bg-green-500/20 text-green-400'; break;
                                case 'A': statusText = 'Đang sửa'; statusClass = 'bg-yellow-500/20 text-yellow-400'; break;
                                case 'C': statusText = 'Đang hủy'; statusClass = 'bg-yellow-500/20 text-yellow-400'; break;
                                case 'S': statusText = 'Hoàn tất'; statusClass = 'bg-green-500/20 text-green-400'; break;
                                default: statusText = `Unknown (${order.orStatus})`; statusClass = 'bg-gray-500/20 text-gray-400';
                            }

                            const timeStr = order.odTimeStamp
                                ? new Date(order.odTimeStamp).toLocaleString()
                                : (order.txdate ? `${new Date(order.txdate).toLocaleDateString()} ${order.txtime || ''}` : '-');

                            return (
                                <tr key={order.orderID || order.orderNo || idx} className="hover:bg-gray-700/30 transition">
                                    <td className="p-4">{timeStr}</td>
                                    <td className="p-4 font-mono font-medium">{order.symbol || '-'}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${isBuy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                            {sideText}
                                        </span>
                                    </td>
                                    <td className="p-4 font-mono">{order.quotePrice ? Number(order.quotePrice).toLocaleString() : '-'}</td>
                                    <td className="p-4 font-mono">{order.execQtty !== undefined ? Number(order.execQtty).toLocaleString() : '-'}</td>
                                    <td className="p-4 font-mono">{order.orderQtty !== undefined ? Number(order.orderQtty).toLocaleString() : '-'}</td>
                                    <td className="p-4 font-mono">{order.matchAmount !== undefined ? Number(order.matchAmount).toLocaleString() : '-'}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${statusClass}`}>
                                            {statusText}
                                        </span>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OrderHistory;
