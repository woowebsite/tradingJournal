import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Edit, Bot, RefreshCw, Sparkles, LogIn, Target, ShieldAlert, LogOut } from 'lucide-react';
import { fetchStrategies, updateStrategy } from '../features/strategySlice';
import { fetchRules, updateRule } from '../features/ruleSlice';
import { fetchWebhooks } from '../features/webhookSlice';
import { StrategyModal } from '../pages/ManageStrategies';

const StrategySummary = ({ 
    activeStrategy, 
    trades = [], 
    onAutoTrade = null, 
    selectedTemplate = null, 
    autoTrading = false,
    isAutoTradeEnabled = false,
    onToggleAutoTrade = () => {},
    isScanningOnCandleClose = false,
    autoTradeLogsCount = 0,
    onSwitchToLogs = () => {}
}) => {
    const dispatch = useDispatch();
    const { items: availableRules } = useSelector(state => state.rules);
    const { items: availableWebhooks } = useSelector(state => state.webhooks);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        dispatch(fetchRules());
        dispatch(fetchWebhooks());
    }, [dispatch]);

    const { winRate, totalFinished, winCount, lossCount, strategyStats } = useMemo(() => {
        if (!trades || trades.length === 0) {
            return {
                winRate: 0,
                totalFinished: 0,
                winCount: 0,
                lossCount: 0,
                strategyStats: { rewardRisk: 0, avgWin: 0, avgLoss: 0, loading: false }
            };
        }

        let wins = 0;
        let losses = 0;
        let grossProfit = 0;
        let grossLoss = 0;

        trades.forEach(trade => {
            const pnl = Number(trade.pnl !== null && trade.pnl !== undefined ? trade.pnl : trade.derivedPnl);
            if (trade.trade_status !== 'Closed' || !Number.isFinite(pnl)) return;

            if (pnl > 0) {
                wins++;
                grossProfit += pnl;
            } else if (pnl < 0) {
                losses++;
                grossLoss += Math.abs(pnl);
            }
        });

        const finished = wins + losses;
        const rate = finished > 0 ? ((wins / finished) * 100).toFixed(1) : 0;
        const avgWin = wins > 0 ? grossProfit / wins : 0;
        const avgLoss = losses > 0 ? grossLoss / losses : 0;
        const rewardRisk = avgLoss > 0 ? (avgWin / avgLoss) : (avgWin > 0 ? 99.99 : 0);

        return {
            winRate: rate,
            totalFinished: finished,
            winCount: wins,
            lossCount: losses,
            strategyStats: {
                rewardRisk: rewardRisk.toFixed(2),
                avgWin: avgWin.toFixed(2),
                avgLoss: avgLoss.toFixed(2),
                loading: false
            }
        };
    }, [trades]);

    // Categorize Strategy Rules into Entry, Take Profit, Stoploss, Exit
    const { entryRulesList, tpRulesList, slRulesList, exitRulesList } = useMemo(() => {
        const entry = [...(activeStrategy?.entryRules || [])];
        const tp = [...(activeStrategy?.takeProfitRules || [])];
        const sl = [...(activeStrategy?.stoplossRules || [])];
        const exit = [...(activeStrategy?.exitRules || [])];

        const hasItem = (arr, item) => {
            const id = item?.documentId || item?.id;
            return id && arr.some(x => (x?.documentId || x?.id) === id);
        };

        (activeStrategy?.rules || []).forEach(r => {
            const t = String(r.Type || r.type || '').toLowerCase();
            if (t.includes('entry') && !hasItem(entry, r)) {
                entry.push(r);
            } else if ((t.includes('take') || t.includes('tp')) && !hasItem(tp, r)) {
                tp.push(r);
            } else if ((t.includes('stop') || t.includes('sl')) && !hasItem(sl, r)) {
                sl.push(r);
            } else if ((t.includes('exit') || t.includes('close')) && !hasItem(exit, r)) {
                exit.push(r);
            }
        });

        return {
            entryRulesList: entry,
            tpRulesList: tp,
            slRulesList: sl,
            exitRulesList: exit
        };
    }, [activeStrategy]);

    // Generate dynamic template rules details if using a strategy template (e.g. Price Action / Supertrend MA288 / VWAP MA9 / Ichimoku)
    const templateInfo = useMemo(() => {
        const tpl = selectedTemplate || (activeStrategy?.strategyFile || activeStrategy?.template ? activeStrategy : null);
        if (!tpl) return null;

        const cfg = tpl.config || {};
        const stratFile = String(tpl.strategyFile || '').toLowerCase();
        const tplName = String(tpl.name || '').toLowerCase();
        const rawTemplate = String(tpl.template || '').toLowerCase();

        // 1. Phân loại Supertrend + Price Action
        const isPriceAction = stratFile.includes('priceaction') || stratFile.includes('price_action') || stratFile.includes('pa') || tplName.includes('price action') || tplName.includes('+ pa') || tplName.includes(' pa ') || cfg.paEngulfing !== undefined || cfg.tpType !== undefined || cfg.paBd3bu2 !== undefined || cfg.slType !== undefined;
        // 2. Phân loại VWAP MA9
        const isVWAP = !isPriceAction && (stratFile.includes('vwap') || tplName.includes('vwap') || rawTemplate.includes('vwap') || cfg.vwapMaPeriod !== undefined || cfg.vwapAnchor !== undefined);
        // 3. Phân loại Ichimoku
        const isIchimoku = !isPriceAction && !isVWAP && (stratFile.includes('ichimoku') || tplName.includes('ichimoku') || rawTemplate.includes('ichimoku'));

        if (isPriceAction) {
            const stPeriod = cfg.stPeriod || 10;
            const stMult = cfg.stMultiplier || 3.0;
            const allowL = cfg.allowLong !== undefined ? cfg.allowLong : true;
            const allowS = cfg.allowShort !== undefined ? cfg.allowShort : true;
            const tpType = cfg.tpType || 'P50';
            const slType = cfg.slType || 'P75';
            const customTp = parseFloat(cfg.customTpVal) || 0;
            const customSl = parseFloat(cfg.customSlVal) || 0;
            const tpST = cfg.tpSupertrend !== undefined ? cfg.tpSupertrend : false;

            const paList = [];
            if (cfg.paEngulfing) paList.push('Engulfing');
            if (cfg.paBd3bu2) paList.push('BD3BU2/BU3BD2');
            if (cfg.paIncludeOpposite) paList.push('IncludeOpposite');
            if (cfg.paPointUp) paList.push('PointUp/Down');
            if (cfg.paSwingUp) paList.push('SwingUp/Down');
            const paText = paList.length > 0 ? paList.join(', ') : 'Tất cả nến theo xu hướng';

            const slDesc = slType === 'supertrend'
                ? `• Đặt Stop Loss bám theo đường Supertrend (${stPeriod}, ${stMult}).`
                : customSl > 0
                    ? `• Đặt Stop Loss cố định ${customSl} điểm/giá.`
                    : `• Đặt Stop Loss theo Spread Percentile ${slType} (Độ giãn nến trung bình).`;

            const tpDesc = customTp > 0
                ? `• Chốt lời cố định ${customTp} điểm/giá.${tpST ? ' (Thoát khi Supertrend đảo chiều)' : ''}`
                : `• Chốt lời theo Spread Percentile ${tpType} (Độ giãn nến).${tpST ? ' (Thoát khi Supertrend đảo chiều)' : ''}`;

            return {
                type: 'Supertrend + Price Action',
                summaryDesc: `ST(${stPeriod}, ${stMult}) + PA [${paText}] | TP: ${tpType} | SL: ${slType} | ${allowL ? 'Long' : ''} ${allowS ? 'Short' : ''}`.trim(),
                entryText: `• Long: Supertrend Uptrend (${stPeriod}, ${stMult}) + Mô hình PA Bullish [${paText}] ${allowL ? '✅' : '❌'}\n• Short: Supertrend Downtrend (${stPeriod}, ${stMult}) + Mô hình PA Bearish [${paText}] ${allowS ? '✅' : '❌'}`,
                slText: slDesc,
                tpText: tpDesc
            };
        } else if (isVWAP) {
            const ma = cfg.vwapMaPeriod || cfg.maPeriod || 9;
            const anchor = cfg.vwapAnchor || 'year';
            const mult1 = cfg.mult1 || 1.0;
            const mult2 = cfg.mult2 || 2.0;
            const mult3 = cfg.mult3 || 3.0;
            const tpTarget = cfg.vwapTpTarget || cfg.tpTarget || 'tp1_vwap';
            const allowL = cfg.allowLong !== undefined ? cfg.allowLong : true;
            const allowS = cfg.allowShort !== undefined ? cfg.allowShort : true;

            const tpLabel = tpTarget === 'tp1_vwap' ? 'Đường VWAP' : tpTarget === 'tp2_upper2' ? `Dải Upper 2 (${mult2}x)` : `Dải Upper 3 (${mult3}x)`;

            return {
                type: 'VWAP MA9',
                summaryDesc: `VWAP (${anchor.toUpperCase()}) + MA${ma} | Dải: ${mult1}x/${mult2}x/${mult3}x | TP: ${tpTarget} | ${allowL ? 'Long' : ''} ${allowS ? 'Short' : ''}`.trim(),
                entryText: `• Long: Giá đóng cửa > MA${ma} & nằm trên VWAP (${anchor.toUpperCase()}) ${allowL ? '✅' : '❌'}\n• Short: Giá đóng cửa < MA${ma} & nằm dưới VWAP (${anchor.toUpperCase()}) ${allowS ? '✅' : '❌'}`,
                slText: `• Đặt Stop Loss tại đường VWAP hoặc Dải Lower Band 2 (${mult2}x StdDev).`,
                tpText: `• Chốt lời theo dải mục tiêu: ${tpLabel} (hoặc dải Lower tương ứng khi Short).`
            };
        } else if (isIchimoku) {
            const ma = cfg.maPeriod || 78;
            const allowL = cfg.allowLong !== undefined ? cfg.allowLong : true;
            const allowS = cfg.allowShort !== undefined ? cfg.allowShort : true;
            return {
                type: 'Ichimoku Cloud',
                summaryDesc: `Ichimoku (26, 78, 156) + MA${ma} | ${allowL ? 'Long' : ''} ${allowS ? 'Short' : ''}`.trim(),
                entryText: `• Long: Giá nằm trên mây Kumo + Tenkan cắt lên Kijun + Giá > MA${ma} ${allowL ? '✅' : '❌'}\n• Short: Giá nằm dưới mây Kumo + Tenkan cắt xuống Kijun + Giá < MA${ma} ${allowS ? '✅' : '❌'}`,
                slText: `• Đặt Stop Loss tại đáy/đỉnh Kijun-sen hoặc biên Mây Kumo.`,
                tpText: `• Chốt lời theo tỷ lệ R:R hoặc khi giá chạm mây đối diện.`
            };
        } else {
            const stPeriod = cfg.stPeriod || 10;
            const stMult = cfg.stMultiplier || 3.0;
            const ma = cfg.maPeriod || 288;
            const rr = cfg.rr || cfg.riskReward || 1.5;
            const entryType = cfg.entryType || 'candle_close';
            const isStRev = entryType === 'st_reversal';
            const tpST = cfg.tpSupertrend !== undefined ? cfg.tpSupertrend : true;
            const tpRR = cfg.tpRR !== undefined ? cfg.tpRR : true;
            const allowL = cfg.allowLong !== undefined ? cfg.allowLong : true;
            const allowS = cfg.allowShort !== undefined ? cfg.allowShort : true;

            return {
                type: 'Supertrend MA288',
                summaryDesc: `Supertrend(${stPeriod}, ${stMult}) + MA${ma} | Entry: ${isStRev ? 'ST Reversal' : 'Nến đóng'} | R:R: 1:${rr} | ${allowL ? 'Long' : ''} ${allowS ? 'Short' : ''}`.trim(),
                entryText: isStRev
                    ? `• Supertrend Đảo chiều (${stPeriod}, ${stMult}): Long khi ST đổi Uptrend & ST > MA${ma} ${allowL ? '✅' : '❌'}\n• Short khi ST đổi Downtrend & ST < MA${ma} ${allowS ? '✅' : '❌'}`
                    : `• Long: Nến xanh (Close > Open) & Close > Supertrend (${stPeriod}, ${stMult}) & ST > MA${ma} ${allowL ? '✅' : '❌'}\n• Short: Nến đỏ (Close < Open) & Close < Supertrend (${stPeriod}, ${stMult}) & ST < MA${ma} ${allowS ? '✅' : '❌'}`,
                slText: `• Đặt Stop Loss cố định tại giá trị đường Supertrend (${stPeriod}, ${stMult}) của nến vào lệnh.`,
                tpText: `• Chốt lời theo tỷ lệ R:R = 1 : ${rr}${tpRR ? ' (Bật)' : ''}${tpST ? ' | Tự động thoát lệnh khi Supertrend đảo chiều' : ''}.`
            };
        }
    }, [selectedTemplate, activeStrategy]);

    const handleUpdateStrategy = async (strategyData) => {
        const strategyId = activeStrategy?.documentId || activeStrategy?.id;
        if (!strategyId) return;

        try {
            const { rulePercents = {}, ruleSignalTexts = {}, ...sanitizedStrategyData } = strategyData;
            await dispatch(updateStrategy({ id: strategyId, data: sanitizedStrategyData })).unwrap();

            const ruleUpdates = new Map();
            Object.entries(rulePercents)
                .filter(([, percent]) => percent !== '' && percent !== undefined && percent !== null)
                .forEach(([ruleId, percent]) => {
                    ruleUpdates.set(ruleId, { ...(ruleUpdates.get(ruleId) || {}), percent: Number(percent) });
                });

            Object.entries(ruleSignalTexts)
                .forEach(([ruleId, signalText]) => {
                    if (signalText !== undefined && signalText !== null) {
                        ruleUpdates.set(ruleId, { ...(ruleUpdates.get(ruleId) || {}), signalText: String(signalText).trim() });
                    }
                });

            if (ruleUpdates.size > 0) {
                await Promise.all(
                    Array.from(ruleUpdates.entries()).map(([ruleId, updateData]) =>
                        dispatch(updateRule({ id: ruleId, data: updateData })).unwrap()
                    )
                );
                dispatch(fetchRules());
            }

            await dispatch(fetchStrategies()).unwrap();
            setIsEditModalOpen(false);
        } catch (error) {
            console.error('Failed to update strategy:', error);
            alert(`Failed to update strategy: ${error?.error?.message || error?.message || error}`);
        }
    };

    const renderAutoTradeControls = () => (
        <div className="flex items-center gap-2 flex-wrap pt-1">
            {/* Master Toggle Switch */}
            <button
                type="button"
                onClick={onToggleAutoTrade}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer ${
                    isAutoTradeEnabled
                        ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/60 hover:bg-emerald-600/40 shadow-emerald-900/30'
                        : 'bg-gray-700/60 text-gray-300 border border-gray-600 hover:bg-gray-700'
                }`}
                title={isAutoTradeEnabled ? 'Đang bật Auto Trade: Tự động quét khi đóng nến và gửi Order Binance' : 'Bật Auto Trade để tự động giao dịch'}
            >
                {isAutoTradeEnabled ? (
                    <>
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                        <span>Auto Trade: ON</span>
                    </>
                ) : (
                    <>
                        <Bot size={13} className="text-gray-400" />
                        <span>Auto Trade: OFF</span>
                    </>
                )}
            </button>

            {/* Quick Fill Button */}
            {onAutoTrade && (
                <button
                    type="button"
                    onClick={onAutoTrade}
                    disabled={autoTrading}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-600/20 px-2.5 py-1.5 text-xs font-medium text-purple-300 transition hover:bg-purple-600/30 hover:text-purple-200 cursor-pointer disabled:opacity-50"
                    title="Tính nhanh Entry, SL, TP để điền vào Form đặt lệnh"
                >
                    {autoTrading ? (
                        <>
                            <RefreshCw size={12} className="animate-spin text-purple-400" />
                            <span>Đang tính...</span>
                        </>
                    ) : (
                        <>
                            <Sparkles size={12} className="text-purple-400" />
                            <span>Tính Form</span>
                        </>
                    )}
                </button>
            )}

            {/* Logs Link Button */}
            {autoTradeLogsCount > 0 && (
                <button
                    type="button"
                    onClick={onSwitchToLogs}
                    className="text-[11px] text-cyan-300 hover:text-cyan-200 underline font-mono px-1 py-0.5"
                >
                    Xem log ({autoTradeLogsCount})
                </button>
            )}

            {isScanningOnCandleClose && (
                <span className="text-[11px] font-mono text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-600/40 animate-pulse">
                    ⚡ Đang quét nến đóng...
                </span>
            )}
        </div>
    );

    if (!activeStrategy && !selectedTemplate) {
        return (
            <div className="p-3 space-y-3">
                <p className="text-gray-500 italic">Chưa có chiến lược (Strategy) nào được kích hoạt cho tài khoản này.</p>
                {renderAutoTradeControls()}
            </div>
        );
    }

    const currentTitle = selectedTemplate ? selectedTemplate.name : (activeStrategy?.name || 'Chiến lược');
    const currentDesc = selectedTemplate?.description || activeStrategy?.description || templateInfo?.summaryDesc || '';

    return (
        <div className="flex flex-col gap-2.5">
            {/* Top Bar: Name, Template Badge, Description, and Performance */}
            <div className="flex items-center justify-between gap-3 pb-1">
                <div className="flex items-center gap-2 flex-wrap min-w-0">
                    <span className="text-blue-400 font-bold text-sm truncate">{currentTitle}</span>
                    {selectedTemplate && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-purple-500/20 text-purple-300 border border-purple-500/40">
                            Template: {selectedTemplate.name}
                        </span>
                    )}
                    {activeStrategy?.type && !selectedTemplate && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] text-gray-400 bg-gray-800">
                            {activeStrategy.type}
                        </span>
                    )}
                    {currentDesc && (
                        <span className="text-gray-400 text-xs truncate max-w-lg italic" title={currentDesc}>
                            — {currentDesc}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3 shrink-0 text-xs">
                    <div>
                        <span className="text-gray-400 text-[11px] mr-1">Win Rate:</span>
                        <span className={`font-bold ${winRate >= 50 ? 'text-emerald-400' : totalFinished === 0 ? 'text-gray-400' : 'text-red-400'}`}>
                            {totalFinished > 0 ? `${winRate}%` : 'N/A'}
                        </span>
                        <span className="text-[10px] text-gray-500 ml-1 font-mono">({winCount}W/{lossCount}L)</span>
                    </div>
                    <div>
                        <span className="text-gray-400 text-[11px] mr-1">R:R:</span>
                        <span className={`font-bold ${strategyStats.rewardRisk >= 1 ? 'text-emerald-400' : strategyStats.rewardRisk == 0 ? 'text-gray-400' : 'text-red-400'}`}>
                            {strategyStats.loading ? '...' : strategyStats.rewardRisk > 0 ? `1:${strategyStats.rewardRisk}` : 'N/A'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Strategy Rules: Entry, Stop Loss, Take Profit (Open, spacious layout without heavy boxes) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-gray-900/40 rounded-lg p-2.5">
                {/* 1. ENTRY */}
                <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs">
                        <LogIn size={13} className="text-blue-400 shrink-0" />
                        <span>VÀO LỆNH (ENTRY)</span>
                    </div>
                    <div className="text-xs text-gray-300 space-y-1">
                        {templateInfo ? (
                            <p className="text-[11px] text-gray-300 whitespace-pre-line leading-relaxed">
                                {templateInfo.entryText}
                            </p>
                        ) : entryRulesList.length > 0 ? (
                            entryRulesList.map((rule, idx) => (
                                <div key={rule.documentId || rule.id || idx}>
                                    <div className="font-semibold text-blue-300 text-[11px]">
                                        • {rule.Name || rule.name}
                                        {rule.percent !== undefined && rule.percent !== null && (
                                            <span className="text-[10px] text-blue-400 font-mono ml-1 font-normal">(Vol: {rule.percent}%)</span>
                                        )}
                                    </div>
                                    {rule.Description && (
                                        <p className="text-[11px] text-gray-400 ml-2 leading-relaxed">{rule.Description}</p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 italic text-[11px]">Chưa có quy tắc Entry.</p>
                        )}
                    </div>
                </div>

                {/* 2. STOP LOSS */}
                <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-red-400 font-bold text-xs">
                        <ShieldAlert size={13} className="text-red-400 shrink-0" />
                        <span>CẮT LỖ (STOP LOSS)</span>
                    </div>
                    <div className="text-xs text-gray-300 space-y-1">
                        {templateInfo ? (
                            <p className="text-[11px] text-gray-300 leading-relaxed">
                                {templateInfo.slText}
                            </p>
                        ) : slRulesList.length > 0 ? (
                            slRulesList.map((rule, idx) => (
                                <div key={rule.documentId || rule.id || idx}>
                                    <div className="font-semibold text-red-300 text-[11px]">• {rule.Name || rule.name}</div>
                                    {rule.Description && (
                                        <p className="text-[11px] text-gray-400 ml-2 leading-relaxed">{rule.Description}</p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 italic text-[11px]">Chưa có quy tắc Stop Loss.</p>
                        )}
                    </div>
                </div>

                {/* 3. TAKE PROFIT */}
                <div className="flex flex-col gap-1 min-w-0">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                        <Target size={13} className="text-emerald-400 shrink-0" />
                        <span>CHỐT LỜI (TAKE PROFIT)</span>
                    </div>
                    <div className="text-xs text-gray-300 space-y-1">
                        {templateInfo ? (
                            <p className="text-[11px] text-gray-300 leading-relaxed">
                                {templateInfo.tpText}
                            </p>
                        ) : tpRulesList.length > 0 ? (
                            tpRulesList.map((rule, idx) => (
                                <div key={rule.documentId || rule.id || idx}>
                                    <div className="font-semibold text-emerald-300 text-[11px]">
                                        • {rule.Name || rule.name}
                                        {rule.percent !== undefined && rule.percent !== null && (
                                            <span className="text-[10px] text-emerald-400 font-mono ml-1 font-normal">(Chốt: {rule.percent}%)</span>
                                        )}
                                    </div>
                                    {rule.Description && (
                                        <p className="text-[11px] text-gray-400 ml-2 leading-relaxed">{rule.Description}</p>
                                    )}
                                </div>
                            ))
                        ) : (
                            <p className="text-gray-500 italic text-[11px]">Chưa có quy tắc Take Profit.</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Exit Rules (nếu có) */}
            {exitRulesList.length > 0 && (
                <div className="flex items-start gap-2 bg-gray-900/30 rounded p-2 text-xs">
                    <div className="flex items-center gap-1 text-amber-400 font-bold text-xs shrink-0">
                        <LogOut size={12} />
                        <span>Exit:</span>
                    </div>
                    <div className="flex flex-wrap gap-3 text-gray-300">
                        {exitRulesList.map((rule, idx) => (
                            <span key={rule.documentId || rule.id || idx}>
                                <span className="font-semibold text-amber-300 text-[11px]">• {rule.Name || rule.name}</span>
                                {rule.Description && <span className="text-gray-400 text-[11px] ml-1">({rule.Description})</span>}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* Bottom Controls Bar */}
            <div className="flex items-center justify-between gap-2 pt-0.5 flex-wrap">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsEditModalOpen(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-600 bg-gray-700/40 px-2.5 py-1 text-xs font-medium text-gray-300 transition hover:bg-gray-700 hover:text-white cursor-pointer"
                    >
                        <Edit size={12} />
                        <span>Sửa Strategy</span>
                    </button>
                </div>
                {renderAutoTradeControls()}
            </div>

            <StrategyModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onSubmit={handleUpdateStrategy}
                initialData={activeStrategy}
                availableRules={availableRules}
                availableWebhooks={availableWebhooks}
            />
        </div>
    );
};

export default StrategySummary;
