import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { RefreshCw, Activity, Zap, Scale, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { getIntradayBSA, getIntradayBidAsk } from '../services/tcbs';

const normalizeTicker = (t) => {
    if (!t) return 'VN30F1M';
    return String(t).trim().toUpperCase();
};

// Smart session extractor: extracts records from today if present, or fallback to the latest available trading session
const filterLatestSessionRecords = (items) => {
    if (!Array.isArray(items) || items.length === 0) return { records: [], sessionLabel: '--/--/----', isToday: false };

    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // "YYYY-MM-DD"

    const getItemDateStr = (item) => {
        if (!item) return null;
        if (item.s) {
            const d = new Date(Number(item.s) * 1000);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
            }
        }
        const rawDate = item.date || item.tradingDate || item.d;
        if (rawDate) {
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
                return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
            }
        }
        return null;
    };

    // 1. Check if records matching today exist
    const todayItems = items.filter(i => getItemDateStr(i) === todayStr);
    if (todayItems.length > 0) {
        const [y, m, d] = todayStr.split('-');
        return {
            records: todayItems,
            sessionLabel: `${d}/${m}/${y}`,
            isToday: true,
        };
    }

    // 2. If no today records, find the most recent date available in dataset
    const datesWithItems = new Map();
    items.forEach(i => {
        const dStr = getItemDateStr(i);
        if (dStr) {
            if (!datesWithItems.has(dStr)) datesWithItems.set(dStr, []);
            datesWithItems.get(dStr).push(i);
        }
    });

    if (datesWithItems.size > 0) {
        // Sort dates descending to get the latest trading session
        const sortedDates = Array.from(datesWithItems.keys()).sort((a, b) => b.localeCompare(a));
        const latestDate = sortedDates[0];
        const [y, m, d] = latestDate.split('-');
        return {
            records: datesWithItems.get(latestDate) || [],
            sessionLabel: `${d}/${m}/${y}`,
            isToday: false,
        };
    }

    // 3. Intraday dataset without timestamp s (e.g. only time 't' like "09:15")
    const todayFormatted = new Date().toLocaleDateString('vi-VN', {
        timeZone: 'Asia/Ho_Chi_Minh',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });

    return {
        records: items,
        sessionLabel: todayFormatted,
        isToday: true,
    };
};

const MarketPressureGauge = ({
    defaultTicker = 'VN30F1M',
    bsaData: externalBsaData = null,
    bidAskData: externalBidAskData = null,
    className = ''
}) => {
    const [ticker, setTicker] = useState(() => normalizeTicker(defaultTicker));
    const [internalBsaData, setInternalBsaData] = useState([]);
    const [internalBidAskData, setInternalBidAskData] = useState([]);
    const [loading, setLoading] = useState(false);
    const [lastUpdated, setLastUpdated] = useState(null);

    // Sync with prop changes
    useEffect(() => {
        if (defaultTicker) setTicker(normalizeTicker(defaultTicker));
    }, [defaultTicker]);

    const hasExternalBsa = Array.isArray(externalBsaData) && externalBsaData.length > 0;
    const hasExternalBidAsk = Array.isArray(externalBidAskData) && externalBidAskData.length > 0;

    const fetchData = useCallback(async () => {
        const cleanTicker = normalizeTicker(ticker);
        if (!cleanTicker) return;
        setLoading(true);
        try {
            const promises = [];
            const shouldFetchBsa = !hasExternalBsa;
            const shouldFetchBidAsk = !hasExternalBidAsk;

            if (shouldFetchBsa) {
                promises.push(
                    getIntradayBSA(cleanTicker, { timeWindow: '5', tWindow: '1d', type: 'all' })
                        .then(res => ({ type: 'bsa', res }))
                        .catch(err => ({ type: 'bsa', err }))
                );
            }
            if (shouldFetchBidAsk) {
                promises.push(
                    getIntradayBidAsk(cleanTicker, { mode: 'baAll' })
                        .then(res => ({ type: 'bidAsk', res }))
                        .catch(err => ({ type: 'bidAsk', err }))
                );
            }

            const results = await Promise.all(promises);
            results.forEach(item => {
                if (item.type === 'bsa' && item.res) {
                    const val = item.res;
                    const list = Array.isArray(val?.data) ? val.data : (Array.isArray(val) ? val : []);
                    setInternalBsaData(list);
                }
                if (item.type === 'bidAsk' && item.res) {
                    const val = item.res;
                    const raw = val?.data && !Array.isArray(val.data) ? val.data : val;
                    const obLog = Array.isArray(raw?.overBidAskLog)
                        ? raw.overBidAskLog
                        : (Array.isArray(val?.overBidAskLog) ? val.overBidAskLog : []);
                    const avgOB = Array.isArray(raw?.avgOBPercent)
                        ? raw.avgOBPercent
                        : (Array.isArray(val?.avgOBPercent) ? val.avgOBPercent : []);
                    const list = Array.isArray(val?.data) ? val.data : (Array.isArray(val) ? val : []);

                    const unifiedMap = new Map();
                    list.forEach(i => i?.t && unifiedMap.set(String(i.t), { ...i, t: String(i.t) }));
                    obLog.forEach(i => {
                        if (!i?.t) return;
                        const existing = unifiedMap.get(String(i.t)) || { t: String(i.t) };
                        const bs = Number(i.bs ?? i.bv) || existing.bs || 0;
                        const oa = Number(i.oa ?? i.av) || existing.oa || 0;
                        const obp = typeof i.obp === 'number' ? i.obp : existing.obp;
                        const osp = typeof i.osp === 'number' ? i.osp : existing.osp;
                        unifiedMap.set(String(i.t), { ...existing, ...i, bs, oa, obp, osp });
                    });
                    avgOB.forEach(i => {
                        if (!i?.t) return;
                        const existing = unifiedMap.get(String(i.t)) || { t: String(i.t) };
                        unifiedMap.set(String(i.t), { ...existing, ...i });
                    });

                    setInternalBidAskData(Array.from(unifiedMap.values()));
                }
            });

            setLastUpdated(new Date().toLocaleTimeString('vi-VN'));
        } catch (err) {
            console.error('Failed to fetch Market Pressure Gauge data:', err);
        } finally {
            setLoading(false);
        }
    }, [ticker, hasExternalBsa, hasExternalBidAsk]);

    // If any external dataset is missing, fetch internally and set interval
    useEffect(() => {
        if (!hasExternalBsa || !hasExternalBidAsk) {
            fetchData();
            const interval = setInterval(fetchData, 20000);
            return () => clearInterval(interval);
        }
    }, [fetchData, hasExternalBsa, hasExternalBidAsk]);

    // Effective datasets (prioritize external props from Derivation page)
    const effectiveBsa = useMemo(() => {
        return hasExternalBsa ? externalBsaData : internalBsaData;
    }, [hasExternalBsa, externalBsaData, internalBsaData]);

    const effectiveBidAsk = useMemo(() => {
        return hasExternalBidAsk ? externalBidAskData : internalBidAskData;
    }, [hasExternalBidAsk, externalBidAskData, internalBidAskData]);

    // Calculate aggregated Metrics & Gauge Position for the active session
    const metrics = useMemo(() => {
        const bsaSession = filterLatestSessionRecords(effectiveBsa);
        const bidAskSession = filterLatestSessionRecords(effectiveBidAsk);

        const targetBsa = (bsaSession.records && bsaSession.records.length > 0) ? bsaSession.records : effectiveBsa;
        const targetBidAsk = (bidAskSession.records && bidAskSession.records.length > 0) ? bidAskSession.records : effectiveBidAsk;

        // --- 1. Market Order Pressure (BSA / Khớp Chủ Động) ---
        let totalBms = 0;
        let totalSms = 0;
        let totalBu = 0;
        let totalSd = 0;

        if (targetBsa.length > 0) {
            targetBsa.forEach(item => {
                const bms = Number(item.bms ?? item.raw?.bms) || 0;
                const sms = Number(item.sms ?? item.raw?.sms) || 0;
                const bu = Number(item.bu ?? item.raw?.bu) || 0;
                const sd = Number(item.sd ?? item.raw?.sd) || 0;

                // If bms/sms volume is available, accumulate it; otherwise fallback to order count bu/sd
                totalBms += bms > 0 ? bms : bu;
                totalSms += sms > 0 ? sms : sd;
                totalBu += bu;
                totalSd += sd;
            });
        }

        const totalMarketVol = totalBms + totalSms;
        const marketScore = totalMarketVol > 0
            ? (totalBms - totalSms) / totalMarketVol
            : (totalBu + totalSd > 0 ? (totalBu - totalSd) / (totalBu + totalSd) : 0);
        const buyMarketPct = totalMarketVol > 0 ? (totalBms / totalMarketVol) * 100 : 50;
        const sellMarketPct = 100 - buyMarketPct;

        // --- 2. Limit Order Pressure (Bid-Ask / Sổ Lệnh Chờ) ---
        let totalBs = 0;
        let totalOa = 0;
        let sumObp = 0;
        let sumOsp = 0;
        let countObp = 0;

        if (targetBidAsk.length > 0) {
            targetBidAsk.forEach(item => {
                const bs = Number(item.bs ?? item.bv ?? item.raw?.bs ?? item.raw?.bv ?? item.bidVolume ?? item.overBid) || 0;
                const oa = Number(item.oa ?? item.av ?? item.raw?.oa ?? item.raw?.av ?? item.askVolume ?? item.overAsk) || 0;
                totalBs += bs;
                totalOa += oa;

                const obp = typeof item.obp === 'number'
                    ? item.obp
                    : (typeof item.raw?.obp === 'number'
                        ? item.raw.obp
                        : (bs + oa > 0 ? bs / (bs + oa) : null));
                const osp = typeof item.osp === 'number'
                    ? item.osp
                    : (typeof item.raw?.osp === 'number'
                        ? item.raw.osp
                        : (bs + oa > 0 ? oa / (bs + oa) : (obp !== null ? 1 - obp : null)));

                if (obp !== null && !isNaN(obp)) {
                    sumObp += obp;
                    sumOsp += (osp !== null && !isNaN(osp) ? osp : (1 - obp));
                    countObp++;
                }
            });
        }

        const totalLimitVol = totalBs + totalOa;
        let limitScore = 0;
        let bidLimitPct = 50;
        let askLimitPct = 50;

        if (totalLimitVol > 0) {
            limitScore = (totalBs - totalOa) / totalLimitVol;
            bidLimitPct = (totalBs / totalLimitVol) * 100;
            askLimitPct = 100 - bidLimitPct;
        } else if (countObp > 0) {
            const avgObp = sumObp / countObp;
            const avgOsp = sumOsp / countObp;
            const totalPct = avgObp + avgOsp;
            if (totalPct > 0) {
                bidLimitPct = (avgObp / totalPct) * 100;
                askLimitPct = 100 - bidLimitPct;
                limitScore = (avgObp - avgOsp) / totalPct;
            }
        }

        // --- 3. Combined Score (-1.0 to +1.0) ---
        // 55% Market Order weight + 45% Limit Order weight (or fallback if one has no data)
        let compositeScore = 0;
        if (totalMarketVol > 0 && (totalLimitVol > 0 || countObp > 0)) {
            compositeScore = (marketScore * 0.55) + (limitScore * 0.45);
        } else if (totalMarketVol > 0) {
            compositeScore = marketScore;
        } else if (totalLimitVol > 0 || countObp > 0) {
            compositeScore = limitScore;
        }

        // Map to 0 - 100 scale (0: Max Sell, 50: Neutral, 100: Max Buy)
        const gaugeValue = Math.min(100, Math.max(0, (compositeScore + 1) * 50));

        // Angle for Needle: 0 (Left/Bán) -> 90 (Center/Cân bằng) -> 180 (Right/Mua)
        // SVG Arc is from -90deg (Left) to +90deg (Right)
        const needleAngle = (gaugeValue / 100) * 180 - 90; // -90 deg to +90 deg

        // Determine Stance Text & Color
        let stanceText = 'Cân Bằng';
        let stanceColor = '#E5E7EB';
        let stanceBg = 'rgba(107, 114, 128, 0.2)';
        let stanceBorder = '#6B7280';

        if (gaugeValue >= 68) {
            stanceText = 'Mua Mạnh';
            stanceColor = '#00E676';
            stanceBg = 'rgba(0, 230, 118, 0.15)';
            stanceBorder = '#00E676';
        } else if (gaugeValue >= 53) {
            stanceText = 'Mua';
            stanceColor = '#34D399';
            stanceBg = 'rgba(52, 211, 153, 0.15)';
            stanceBorder = '#34D399';
        } else if (gaugeValue <= 32) {
            stanceText = 'Bán Mạnh';
            stanceColor = '#FF3B30';
            stanceBg = 'rgba(255, 59, 48, 0.15)';
            stanceBorder = '#FF3B30';
        } else if (gaugeValue <= 47) {
            stanceText = 'Bán';
            stanceColor = '#F87171';
            stanceBg = 'rgba(248, 113, 113, 0.15)';
            stanceBorder = '#F87171';
        }

        const sessionDate = bsaSession.sessionLabel !== '--/--/----'
            ? bsaSession.sessionLabel
            : (bidAskSession.sessionLabel !== '--/--/----' ? bidAskSession.sessionLabel : bsaSession.sessionLabel);

        const isTodaySession = bsaSession.isToday || bidAskSession.isToday;
        const sessionPrefix = isTodaySession ? 'Hôm nay' : 'Phiên';

        return {
            totalBms,
            totalSms,
            buyMarketPct,
            sellMarketPct,
            totalBs,
            totalOa,
            bidLimitPct,
            askLimitPct,
            compositeScore,
            gaugeValue,
            needleAngle,
            stanceText,
            stanceColor,
            stanceBg,
            stanceBorder,
            sessionLabel: `${sessionPrefix}: ${sessionDate}`,
            recordsCount: targetBsa.length || targetBidAsk.length,
        };
    }, [effectiveBsa, effectiveBidAsk]);

    return (
        <div className={`bg-gray-800 border border-gray-700 rounded-xl shadow-lg flex flex-col overflow-hidden ${className}`}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-700 bg-gray-900/60 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                    <Zap size={16} className="text-amber-400" />
                    <span className="font-bold text-white text-sm">Lực Cung Cầu Phái Sinh</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-300 font-mono border border-amber-500/20">
                        {metrics.sessionLabel}
                    </span>
                </div>
                <button
                    type="button"
                    onClick={fetchData}
                    disabled={loading}
                    className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition disabled:opacity-50 border border-gray-700 cursor-pointer"
                    title="Làm mới lực cung cầu"
                >
                    <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {/* Main Gauge Graphic Body */}
            <div className="p-4 flex-1 flex flex-col justify-between items-center gap-2">
                {/* SVG Semi-Circle Gauge */}
                <div className="relative w-full max-w-[290px] aspect-[2/1.3] flex flex-col items-center justify-end mt-1">
                    <svg viewBox="0 0 300 175" className="w-full h-auto overflow-visible">
                        <defs>
                            {/* Gradient Background inside Arc */}
                            <radialGradient id="gaugeBgGlow" cx="50%" cy="100%" r="85%">
                                <stop offset="0%" stopColor="#1E293B" stopOpacity="0.8" />
                                <stop offset="100%" stopColor="#0F172A" stopOpacity="0.95" />
                            </radialGradient>

                            {/* Drop shadow for pointer */}
                            <filter id="needleShadow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor="#000000" floodOpacity="0.8" />
                            </filter>
                        </defs>

                        {/* Background Dome */}
                        <path
                            d="M 25 155 A 125 125 0 0 1 275 155 Z"
                            fill="url(#gaugeBgGlow)"
                        />

                        {/* 5 Segmented Colored Arcs (From Left to Right) */}
                        {/* Segment 1: Deep Red (Bán Mạnh) - 180° to 144° */}
                        <path
                            d="M 25 155 A 125 125 0 0 1 49.3 81.6"
                            fill="none"
                            stroke="#FF3366"
                            strokeWidth="14"
                            strokeLinecap="round"
                        />
                        {/* Segment 2: Pink/Salmon (Bán) - 140° to 108° */}
                        <path
                            d="M 54.3 72.8 A 125 125 0 0 1 111.4 35.1"
                            fill="none"
                            stroke="#FDA4AF"
                            strokeWidth="14"
                            strokeLinecap="round"
                        />
                        {/* Segment 3: Neutral Slate/Blue (Cân Bằng) - 104° to 76° */}
                        <path
                            d="M 119.8 32.2 A 125 125 0 0 1 180.2 32.2"
                            fill="none"
                            stroke="#E2E8F0"
                            strokeWidth="14"
                            strokeLinecap="round"
                        />
                        {/* Segment 4: Light Cyan/Mint (Mua) - 72° to 40° */}
                        <path
                            d="M 188.6 35.1 A 125 125 0 0 1 245.7 72.8"
                            fill="none"
                            stroke="#5EEAD4"
                            strokeWidth="14"
                            strokeLinecap="round"
                        />
                        {/* Segment 5: Neon Green (Mua Mạnh) - 36° to 0° */}
                        <path
                            d="M 250.7 81.6 A 125 125 0 0 1 275 155"
                            fill="none"
                            stroke="#00E676"
                            strokeWidth="14"
                            strokeLinecap="round"
                        />

                        {/* Animated Pointer / Needle */}
                        <g
                            style={{
                                transform: `rotate(${metrics.needleAngle}deg)`,
                                transformOrigin: '150px 155px',
                                transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                            }}
                            filter="url(#needleShadow)"
                        >
                            {/* Needle Body: Sleek tapered orange pointer */}
                            <polygon
                                points="146,155 150,42 154,155"
                                fill="#FBBF24"
                            />
                            {/* Needle tip glow highlight */}
                            <line
                                x1="150"
                                y1="155"
                                x2="150"
                                y2="45"
                                stroke="#FDE047"
                                strokeWidth="2"
                            />
                            {/* Pivot outer circle */}
                            <circle cx="150" cy="155" r="9" fill="#F59E0B" stroke="#FBBF24" strokeWidth="2" />
                            {/* Pivot center dot */}
                            <circle cx="150" cy="155" r="4" fill="#0F172A" />
                        </g>
                    </svg>

                    {/* Stance Status Button / Badge */}
                    <div className="mt-2 mb-1 flex justify-center">
                        <div
                            className="px-6 py-1.5 rounded-lg border-2 font-bold text-sm tracking-wide transition-all duration-300 shadow-md min-w-[120px] text-center"
                            style={{
                                color: metrics.stanceColor,
                                borderColor: metrics.stanceBorder,
                                backgroundColor: metrics.stanceBg,
                            }}
                        >
                            {metrics.stanceText}
                        </div>
                    </div>
                </div>

                {/* Sub-Indicators Breakdown (Market Order vs Limit Order) */}
                <div className="w-full flex flex-col gap-2.5 bg-gray-900/60 p-3 rounded-xl border border-gray-700/60 text-xs">
                    {/* 1. Market Order (Khớp Lệnh Chủ Động) */}
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400 font-medium flex items-center gap-1">
                                <Activity size={12} className="text-emerald-400" /> Khớp Chủ Động (Market Order)
                            </span>
                            <span className={`font-bold ${metrics.buyMarketPct >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {metrics.buyMarketPct >= 50 ? 'Mua CĐ Chiếm Ưu Thế' : 'Bán CĐ Chiếm Ưu Thế'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-300">
                            <span className="text-emerald-400 font-semibold">
                                Mua: {metrics.buyMarketPct.toFixed(1)}% ({metrics.totalBms.toLocaleString()} KL)
                            </span>
                            <span className="text-rose-400 font-semibold">
                                Bán: {metrics.sellMarketPct.toFixed(1)}% ({metrics.totalSms.toLocaleString()} KL)
                            </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden flex border border-gray-700/40">
                            <div className="bg-emerald-500" style={{ width: `${metrics.buyMarketPct}%` }} />
                            <div className="bg-rose-500" style={{ width: `${metrics.sellMarketPct}%` }} />
                        </div>
                    </div>

                    {/* 2. Limit Order (Sổ Lệnh Chờ Khớp) */}
                    <div className="flex flex-col gap-1 border-t border-gray-800 pt-2">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-gray-400 font-medium flex items-center gap-1">
                                <Scale size={12} className="text-purple-400" /> Sổ Lệnh Chờ (Limit Order)
                            </span>
                            <span className={`font-bold ${metrics.bidLimitPct >= 50 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                {metrics.bidLimitPct >= 50 ? 'Dư Mua Áp Đảo' : 'Dư Bán Áp Đảo'}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-gray-300">
                            <span className="text-emerald-400 font-semibold">
                                Dư Mua: {metrics.bidLimitPct.toFixed(1)}% ({metrics.totalBs > 0 ? `${metrics.totalBs.toLocaleString()} HĐ` : `${metrics.bidLimitPct.toFixed(1)}%`})
                            </span>
                            <span className="text-rose-400 font-semibold">
                                Dư Bán: {metrics.askLimitPct.toFixed(1)}% ({metrics.totalOa > 0 ? `${metrics.totalOa.toLocaleString()} HĐ` : `${metrics.askLimitPct.toFixed(1)}%`})
                            </span>
                        </div>
                        <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden flex border border-gray-700/40">
                            <div className="bg-emerald-500" style={{ width: `${metrics.bidLimitPct}%` }} />
                            <div className="bg-rose-500" style={{ width: `${metrics.askLimitPct}%` }} />
                        </div>
                    </div>
                </div>

                {/* Footer hint */}
                <div className="text-[10px] text-gray-500 flex justify-between items-center w-full px-1">
                    <span>Mũi tên nghiêng theo Tổng lực Mua/Bán</span>
                    <span>Cập nhật: {lastUpdated || '--:--'}</span>
                </div>
            </div>
        </div>
    );
};

export default MarketPressureGauge;

