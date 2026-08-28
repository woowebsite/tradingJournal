import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Activity, ArrowUpRight, ArrowDownRight, Layers, BarChart2 } from 'lucide-react';
import { getIntradayBSA } from '../services/tcbs';

const TIME_WINDOWS = [
    { label: '1 phút', value: '1' },
    { label: '3 phút', value: '3' },
    { label: '5 phút', value: '5' },
    { label: '10 phút', value: '10' },
    { label: '15 phút', value: '15' },
    { label: '30 phút', value: '30' },
];

const T_WINDOWS = [
    { label: '15 phút', value: '15m' },
    { label: '30 phút', value: '30m' },
    { label: '60 phút', value: '60m' },
    { label: '1 ngày', value: '1d' },
];

const IntradayBSAPanel = ({ defaultTicker = '41I1G9000', className = '' }) => {
    const [ticker, setTicker] = useState(defaultTicker);
    const [timeWindow, setTimeWindow] = useState('5');
    const [tWindow, setTWindow] = useState('60m');
    const [type, setType] = useState('all');
    const [bsaData, setBsaData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [viewMode, setViewMode] = useState('both'); // 'both' | 'table' | 'chart'

    const fetchData = useCallback(async () => {
        if (!ticker) return;
        setLoading(true);
        setError(null);
        try {
            const res = await getIntradayBSA(ticker, { timeWindow, tWindow, type });
            const list = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            // Sort by timestamp or time descending for latest on top
            const sorted = [...list].sort((a, b) => (Number(b.s) || 0) - (Number(a.s) || 0));
            setBsaData(sorted);
        } catch (err) {
            console.error('Failed to fetch Intraday BSA:', err);
            setError(err.message || 'Không thể tải dữ liệu BSA');
        } finally {
            setLoading(false);
        }
    }, [ticker, timeWindow, tWindow, type]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Calculate aggregated statistics
    const latestItem = useMemo(() => bsaData[0] || null, [bsaData]);

    const summary = useMemo(() => {
        if (bsaData.length === 0) return null;

        let totalBu = 0;
        let totalBms = 0;
        let totalSd = 0;
        let totalSms = 0;

        bsaData.forEach(item => {
            totalBu += Number(item.bu) || 0;
            totalBms += Number(item.bms) || 0;
            totalSd += Number(item.sd) || 0;
            totalSms += Number(item.sms) || 0;
        });

        const totalVol = totalBms + totalSms;
        const totalOrders = totalBu + totalSd;
        const buyVolPct = totalVol > 0 ? (totalBms / totalVol) : 0;
        const sellVolPct = totalVol > 0 ? (totalSms / totalVol) : 0;
        const overallBsr = totalSd > 0 ? (totalBu / totalSd) : (totalBu > 0 ? 99 : 1);

        return {
            totalBu,
            totalBms,
            totalSd,
            totalSms,
            buyVolPct,
            sellVolPct,
            overallBsr,
            totalOrders,
            totalVol,
        };
    }, [bsaData]);

    return (
        <div className={`bg-gray-800/95 backdrop-blur border border-gray-700/80 rounded-xl shadow-xl flex flex-col overflow-hidden ${className}`}>
            {/* Panel Header */}
            <div className="px-4 py-3 bg-gray-900/70 border-b border-gray-700/80 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400">
                        <Activity size={16} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="font-bold text-white text-base tracking-wide">{ticker}</span>
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium border border-blue-500/30">
                                Cung Cầu Intraday (BSA)
                            </span>
                        </div>
                        <p className="text-[11px] text-gray-400">Khớp lệnh Mua / Bán chủ động theo cửa sổ thời gian</p>
                    </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Time Window Select */}
                    <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-gray-400 font-medium uppercase">Cửa sổ:</span>
                        <select
                            value={timeWindow}
                            onChange={(e) => setTimeWindow(e.target.value)}
                            className="bg-transparent text-xs text-white outline-none cursor-pointer font-medium"
                        >
                            {TIME_WINDOWS.map(w => (
                                <option key={w.value} value={w.value} className="bg-gray-900 text-white">
                                    {w.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Total Window Select */}
                    <div className="flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1">
                        <span className="text-[10px] text-gray-400 font-medium uppercase">Khung:</span>
                        <select
                            value={tWindow}
                            onChange={(e) => setTWindow(e.target.value)}
                            className="bg-transparent text-xs text-white outline-none cursor-pointer font-medium"
                        >
                            {T_WINDOWS.map(w => (
                                <option key={w.value} value={w.value} className="bg-gray-900 text-white">
                                    {w.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Refresh Button */}
                    <button
                        type="button"
                        onClick={fetchData}
                        disabled={loading}
                        className="p-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-blue-400 transition border border-gray-600 disabled:opacity-50"
                        title="Làm mới dữ liệu BSA"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Main Content */}
            <div className="p-4 flex flex-col gap-4 flex-1 min-h-0 overflow-hidden">
                {/* Summary Metrics Cards */}
                {summary && (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Mua Chủ Động Card */}
                        <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-3 flex flex-col justify-between">
                            <div className="flex items-center justify-between text-xs text-emerald-400 font-medium mb-1">
                                <span className="flex items-center gap-1">
                                    <ArrowUpRight size={14} /> Mua Chủ Động
                                </span>
                                <span className="font-bold text-sm">
                                    {(summary.buyVolPct * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="flex items-baseline justify-between mt-1">
                                <div>
                                    <span className="text-lg font-bold text-white tabular-nums">
                                        {summary.totalBms.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-gray-400 ml-1">KL</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-emerald-300/80 font-medium tabular-nums">
                                        {summary.totalBu.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-gray-400 ml-1">lệnh</span>
                                </div>
                            </div>
                        </div>

                        {/* Bán Chủ Động Card */}
                        <div className="bg-rose-950/20 border border-rose-500/20 rounded-xl p-3 flex flex-col justify-between">
                            <div className="flex items-center justify-between text-xs text-rose-400 font-medium mb-1">
                                <span className="flex items-center gap-1">
                                    <ArrowDownRight size={14} /> Bán Chủ Động
                                </span>
                                <span className="font-bold text-sm">
                                    {(summary.sellVolPct * 100).toFixed(1)}%
                                </span>
                            </div>
                            <div className="flex items-baseline justify-between mt-1">
                                <div>
                                    <span className="text-lg font-bold text-white tabular-nums">
                                        {summary.totalSms.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-gray-400 ml-1">KL</span>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs text-rose-300/80 font-medium tabular-nums">
                                        {summary.totalSd.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-gray-400 ml-1">lệnh</span>
                                </div>
                            </div>
                        </div>

                        {/* Tỷ Lệ Mua / Bán (BSR) Card */}
                        <div className="bg-gray-900/60 border border-gray-700 rounded-xl p-3 flex flex-col justify-between">
                            <div className="flex items-center justify-between text-xs text-gray-400 font-medium mb-1">
                                <span>Tỷ Lệ M/B (BSR)</span>
                                <span className={`font-bold text-sm ${summary.overallBsr >= 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                    {summary.overallBsr >= 1 ? 'Phe Mua Áp Đảo' : 'Phe Bán Áp Đảo'}
                                </span>
                            </div>
                            <div className="flex items-baseline justify-between mt-1">
                                <div>
                                    <span className={`text-lg font-bold tabular-nums ${summary.overallBsr >= 1 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {summary.overallBsr.toFixed(3)}
                                    </span>
                                    <span className="text-[10px] text-gray-400 ml-1">BSR</span>
                                </div>
                                {latestItem && (
                                    <div className="text-right">
                                        <span className="text-[11px] text-gray-400">Gần nhất: </span>
                                        <span className="text-xs font-semibold text-white">{latestItem.t}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Progress Bar Cán Cân Cung - Cầu */}
                {summary && (
                    <div className="flex flex-col gap-1.5 bg-gray-900/50 p-2.5 rounded-lg border border-gray-700/60">
                        <div className="flex justify-between items-center text-xs">
                            <span className="text-emerald-400 font-semibold flex items-center gap-1">
                                Mua: {(summary.buyVolPct * 100).toFixed(1)}%
                            </span>
                            <span className="text-gray-400 text-[11px]">Cán Cân Cung - Cầu</span>
                            <span className="text-rose-400 font-semibold flex items-center gap-1">
                                Bán: {(summary.sellVolPct * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div className="w-full h-2.5 bg-gray-800 rounded-full overflow-hidden flex border border-gray-700/50">
                            <div
                                className="bg-gradient-to-r from-emerald-600 to-emerald-400 transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, summary.buyVolPct * 100))}%` }}
                            />
                            <div
                                className="bg-gradient-to-r from-rose-400 to-rose-600 transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, summary.sellVolPct * 100))}%` }}
                            />
                        </div>
                    </div>
                )}

                {/* Data Table */}
                <div className="flex-1 min-h-[480px] bg-gray-900/60 border border-gray-700/70 rounded-xl overflow-hidden flex flex-col">
                    <div className="px-3 py-2 bg-gray-900/90 border-b border-gray-700 flex items-center justify-between text-xs text-gray-400 font-medium">
                        <span>Chi tiết chuỗi thời gian ({bsaData.length} mốc)</span>
                        {loading && <span className="text-blue-400 animate-pulse">Đang tải...</span>}
                    </div>

                    <div className="flex-1 min-h-[440px] max-h-[650px] overflow-y-auto custom-scrollbar">
                        {error ? (
                            <div className="p-4 text-center text-xs text-rose-400">{error}</div>
                        ) : bsaData.length === 0 ? (
                            <div className="p-8 text-center text-xs text-gray-500">
                                {loading ? 'Đang tải dữ liệu cung cầu BSA...' : 'Không có dữ liệu BSA cho khung thời gian này.'}
                            </div>
                        ) : (
                            <table className="w-full text-left text-xs border-collapse">
                                <thead className="sticky top-0 bg-gray-900 text-[11px] text-gray-400 uppercase tracking-wider font-semibold border-b border-gray-700 z-10">
                                    <tr>
                                        <th className="py-2 px-3">Thời Gian</th>
                                        <th className="py-2 px-3 text-right text-emerald-400">Mua CĐ (Lệnh / KL)</th>
                                        <th className="py-2 px-3 text-right text-emerald-400">% Mua</th>
                                        <th className="py-2 px-3 text-right text-rose-400">Bán CĐ (Lệnh / KL)</th>
                                        <th className="py-2 px-3 text-right text-rose-400">% Bán</th>
                                        <th className="py-2 px-3 text-right">Tỷ Lệ M/B (BSR)</th>
                                        <th className="py-2 px-3 text-center w-28">Tương Quan</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800/80 font-mono text-[11px]">
                                    {bsaData.map((row, idx) => {
                                        const bu = Number(row.bu) || 0;
                                        const bms = Number(row.bms) || 0;
                                        const bup = typeof row.bup === 'number' ? row.bup : Number(row.bup) || 0;
                                        const sd = Number(row.sd) || 0;
                                        const sms = Number(row.sms) || 0;
                                        const sdp = typeof row.sdp === 'number' ? row.sdp : Number(row.sdp) || 0;
                                        const bsr = typeof row.bsr === 'number' ? row.bsr : Number(row.bsr) || 0;
                                        const isBullish = bsr >= 1;

                                        return (
                                            <tr key={row.s || idx} className="hover:bg-gray-800/50 transition">
                                                <td className="py-1.5 px-3 font-semibold text-white font-sans">
                                                    {row.t || '--:--'}
                                                </td>
                                                <td className="py-1.5 px-3 text-right text-emerald-300">
                                                    <span className="font-semibold">{bu.toLocaleString()}</span>
                                                    <span className="text-[10px] text-gray-500 ml-1">({bms.toLocaleString()})</span>
                                                </td>
                                                <td className="py-1.5 px-3 text-right text-emerald-400 font-semibold">
                                                    {(bup * 100).toFixed(1)}%
                                                </td>
                                                <td className="py-1.5 px-3 text-right text-rose-300">
                                                    <span className="font-semibold">{sd.toLocaleString()}</span>
                                                    <span className="text-[10px] text-gray-500 ml-1">({sms.toLocaleString()})</span>
                                                </td>
                                                <td className="py-1.5 px-3 text-right text-rose-400 font-semibold">
                                                    {(sdp * 100).toFixed(1)}%
                                                </td>
                                                <td className={`py-1.5 px-3 text-right font-bold ${isBullish ? 'text-emerald-400' : 'text-rose-400'}`}>
                                                    {bsr.toFixed(3)}
                                                </td>
                                                <td className="py-1.5 px-3">
                                                    <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden flex border border-gray-700/40">
                                                        <div
                                                            className="bg-emerald-500"
                                                            style={{ width: `${Math.min(100, Math.max(0, bup * 100))}%` }}
                                                        />
                                                        <div
                                                            className="bg-rose-500"
                                                            style={{ width: `${Math.min(100, Math.max(0, sdp * 100))}%` }}
                                                        />
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default IntradayBSAPanel;
