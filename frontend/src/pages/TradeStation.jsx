import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSymbols, fetchHistories, loadExternalHistory, fetchExternalIndicators, syncSymbolMetadata, deleteAllHistories, hasTodayCandle, updateRealtimeCandle } from '../features/marketSlice';
import { subscribeBinanceKlineWS } from '../services/binance';
import { executeBinanceOrder } from '../services/binanceExecution';
import api from '../services/api';
import { fetchSignals, scanSignals } from '../features/signalSlice';
import { fetchStrategies } from '../features/strategySlice';
import { deleteTrade, fetchOpenTrades, fetchTrades, saveTrade } from '../features/tradeSlice';
import { createSymbol } from '../features/symbolSlice';
import { fetchWatchlists, updateWatchlist } from '../features/watchlistSlice';
import TradingViewChart from '../components/TradingViewChart';
import CreateSymbolModal from '../components/CreateSymbolModal';
import StrategyPanel from '../containers/StrategyPanel';
import TechnicalPanel from '../containers/TechnicalPanel';
import WatchlistSelector from '../components/WatchlistSelector';
import TradeStationOrderForm from '../components/TradeStationOrderForm';
import TradeDetailModal from '../components/TradeDetailModal';
import TradeModal from '../components/TradeModal';
import { Search, RefreshCw, Plus, History, BookmarkCheck, Bot } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import { getTcbsRecommendations } from '../services/tcbsRecommendation';
import { upsertSymbolTechnicalAnalysis } from '../services/tcbs';
import { calculateSMA } from '../indicators/movingAverages';
import { calculateSupertrend } from '../indicators/supertrend';
import { calculateVWAP } from '../indicators/vwap';
import { calculateIchimoku } from '../indicators/ichimoku/ichimoku';
import { fetchRecentTcbsStrategySignals } from '../services/tcbsStrategy';
import { getStrategyId } from '../utils/roadmapCalculations';
import { getStrategyTemplates } from '../services/strategyTemplate';
import { scanPythonStrategy } from '../services/pythonStrategy';

const TradeStation = () => {
    const dispatch = useDispatch();
    const { symbols, histories, externalIndicators, loading, historyLoading } = useSelector(state => state.market);
    const { items: allSignals } = useSelector(state => state.signals);
    const { items: strategies } = useSelector(state => state.strategies);
    const [searchParams, setSearchParams] = useSearchParams();
    const [selectedSymbolId, setSelectedSymbolId] = useState(null);
    const [accountTrades, setAccountTrades] = useState([]);
    const [selectedTrade, setSelectedTrade] = useState(null);
    const [tradeToEdit, setTradeToEdit] = useState(null);
    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
    const [tcbsRecommendations, setTcbsRecommendations] = useState([]);
    const [tcbsRecentSignals, setTcbsRecentSignals] = useState([]);
    const [loadingTcbsInsights, setLoadingTcbsInsights] = useState(false);
    const [showCreateSymbolModal, setShowCreateSymbolModal] = useState(false);
    const [creatingSymbol, setCreatingSymbol] = useState(false);
    const [addingToWatchlist, setAddingToWatchlist] = useState(false);
    const [chartTemplate, setChartTemplate] = useState('Supertrend');
    const [vwapAnchor, setVwapAnchor] = useState('Year');
    const [timeframe, setTimeframe] = useState('D1');
    const [maPeriod, setMaPeriod] = useState(288);
    const [stPeriod, setStPeriod] = useState(10);
    const [stMultiplier, setStMultiplier] = useState(3);
    const [templates, setTemplates] = useState([]);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');
    const [tradeFormSetup, setTradeFormSetup] = useState({ price: '', slPrice: '', tpPrice: '' });
    const [autoTrading, setAutoTrading] = useState(false);
    const [isAutoTradeEnabled, setIsAutoTradeEnabled] = useState(() => {
        try {
            return localStorage.getItem('auto_trade_enabled') === 'true';
        } catch { return false; }
    });
    const [autoTradeLogs, setAutoTradeLogs] = useState([]);
    const [isScanningOnCandleClose, setIsScanningOnCandleClose] = useState(false);
    const [liveCandle, setLiveCandle] = useState(null);
    const [wsStatus, setWsStatus] = useState('disconnected');
    const [livePrice, setLivePrice] = useState(null);
    const lastAutoRefreshedSymbolRef = useRef(null);
    const metadataSyncedSymbolRef = useRef(null);
    const autoOpenedMissingSymbolRef = useRef('');
    const lastScannedCandleTimeRef = useRef(null);
    const lastExecutedTradeTimeRef = useRef(null);
    const autoTradeContextRef = useRef({});
    const { selectedAccount, defaultWatchlist } = useAccount();
    const symbolParam = searchParams.get('symbol');
    const priceParam = searchParams.get('price');
    const slPriceParam = searchParams.get('slPrice');
    const tpPriceParam = searchParams.get('tpPrice');

    useEffect(() => {
        if (symbolParam && symbols.length > 0) {
            const normalizedParam = symbolParam.trim().toUpperCase();
            const found = symbols.find(s => String(s.Name || '').trim().toUpperCase() === normalizedParam);
            if (found) {
                const id = found.documentId || found.id;
                setSelectedSymbolId(id);
                setShowCreateSymbolModal(false);
                autoOpenedMissingSymbolRef.current = '';
                return;
            }

            if (autoOpenedMissingSymbolRef.current !== normalizedParam) {
                autoOpenedMissingSymbolRef.current = normalizedParam;
                setShowCreateSymbolModal(true);
            }
        }
    }, [symbolParam, symbols]);

    const tradeSetupValue = useMemo(() => ({
        price: tradeFormSetup.price || priceParam || '',
        slPrice: tradeFormSetup.slPrice || slPriceParam || '',
        tpPrice: tradeFormSetup.tpPrice || tpPriceParam || ''
    }), [tradeFormSetup, priceParam, slPriceParam, tpPriceParam]);

    const tradeSetupKey = useMemo(() => (
        [
            selectedSymbolId || '',
            symbolParam || '',
            tradeFormSetup.price || priceParam || '',
            tradeFormSetup.slPrice || slPriceParam || '',
            tradeFormSetup.tpPrice || tpPriceParam || ''
        ].join(':')
    ), [selectedSymbolId, symbolParam, tradeFormSetup, priceParam, slPriceParam, tpPriceParam]);

    useEffect(() => {
        setTradeFormSetup({ price: '', slPrice: '', tpPrice: '' });
    }, [selectedSymbolId]);

    const selectedSymbol = useMemo(() => {
        if (!selectedSymbolId || !symbols || symbols.length === 0) return null;
        return symbols.find(s => (s.documentId || s.id) === selectedSymbolId || String(s.id) === String(selectedSymbolId) || String(s.documentId) === String(selectedSymbolId)) || null;
    }, [symbols, selectedSymbolId]);

    const isCryptoSymbol = useMemo(() => {
        const symName = String(selectedSymbol?.Name || selectedSymbol?.name || symbolParam || '').toUpperCase();
        return selectedAccount?.market?.Name === 'Crypto' ||
            symName.includes('USDT') ||
            symName.includes('USDC') ||
            symName.includes('BUSD') ||
            symName.endsWith('.P') ||
            symName.includes('PERP') ||
            symName.startsWith('BINANCE:');
    }, [selectedAccount?.market?.Name, selectedSymbol, symbolParam]);

    const lastReduxDispatchTimeRef = useRef(0);

    const refreshSelectedAccountTrades = useCallback(() => {
        const accountId = selectedAccount?.documentId || selectedAccount?.id;
        if (!accountId) return Promise.resolve();
        return dispatch(fetchTrades({ accountId, pageSize: 50 }))
            .unwrap()
            .then(fetchedTrades => {
                setAccountTrades(fetchedTrades || []);
                return fetchedTrades;
            });
    }, [dispatch, selectedAccount]);

    const addAutoTradeLog = useCallback((message, type = 'info', meta = null) => {
        const timeStr = new Date().toLocaleTimeString();
        const newEntry = {
            id: `${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            time: timeStr,
            message,
            type, // 'info' | 'success' | 'warn' | 'error' | 'scan'
            meta
        };
        setAutoTradeLogs(prev => [newEntry, ...prev.slice(0, 49)]);
    }, []);

    const toggleAutoTrade = useCallback(() => {
        setIsAutoTradeEnabled(prev => {
            const next = !prev;
            try {
                localStorage.setItem('auto_trade_enabled', String(next));
            } catch { }
            addAutoTradeLog(
                next 
                    ? `🟢 Đã BẬT Auto Trade. Hệ thống sẽ tự động quét Python Strategy và gửi Order Binance mỗi lần đóng nến.` 
                    : `🔴 Đã TẮT Auto Trade.`,
                next ? 'success' : 'warn'
            );
            return next;
        });
    }, [addAutoTradeLog]);

    const handleCandleCloseAutoTrade = useCallback(async (candle, symName, currentTf) => {
        const ctx = autoTradeContextRef.current;
        if (!ctx?.isAutoTradeEnabled) return;

        const tpl = ctx.selectedTemplate;
        const cfg = tpl?.config || {};
        const stratFile = tpl?.strategyFile || (ctx.chartTemplate === 'VWAP' ? 'strategy_vwap_ma9.py' : 'strategy_supertrend_ma288.py');
        const stratName = tpl?.name || stratFile.replace('.py', '');

        addAutoTradeLog(`🔔 Nến ${currentTf} [${symName}] vừa ĐÓNG @ $${candle.close}. Đang quét Python Strategy [${stratName}]...`, 'scan');
        setIsScanningOnCandleClose(true);

        try {
            const scanParams = {
                strategyFile: stratFile,
                ticker: symName,
                timeframe: currentTf,
                countback: 500,
                ...(cfg || {})
            };

            const res = await scanPythonStrategy(scanParams);
            if (!res) {
                addAutoTradeLog(`⚠️ Không nhận được phản hồi từ Python Strategy scan.`, 'warn');
                return;
            }

            const activeTrade = res.summary?.activeTrade;
            const latestTrade = res.summary?.latestTrade;

            let targetSignal = null;
            if (activeTrade && activeTrade.entry_price && activeTrade.stop_loss && activeTrade.status === 'Open') {
                targetSignal = {
                    type: activeTrade.type || 'Long',
                    entry: activeTrade.entry_price,
                    stop_loss: activeTrade.stop_loss,
                    take_profit: activeTrade.take_profit,
                    date: activeTrade.entry_date,
                };
            } else if (latestTrade && latestTrade.entry_price && latestTrade.stop_loss) {
                targetSignal = {
                    type: latestTrade.type || 'Long',
                    entry: latestTrade.entry_price,
                    stop_loss: latestTrade.stop_loss,
                    take_profit: latestTrade.take_profit,
                    date: latestTrade.entry_date,
                };
            }

            if (!targetSignal) {
                addAutoTradeLog(`ℹ️ Nến ${currentTf} đóng @ $${candle.close}: Không có tín hiệu vào lệnh mới.`, 'info');
                return;
            }

            const signalKey = `${symName}:${targetSignal.date || candle.rawTime || candle.date}:${targetSignal.type}`;
            if (lastExecutedTradeTimeRef.current === signalKey) {
                addAutoTradeLog(`ℹ️ Tín hiệu ${targetSignal.type} @ $${targetSignal.entry} đã được thực thi trước đó. Bỏ qua duplicate.`, 'info');
                return;
            }

            // Check existing open trade for this symbol in current account
            const existingOpen = (ctx.accountTrades || []).some(t => {
                const sName = t.symbol?.Name || t.symbol?.name || '';
                return sName.toUpperCase() === symName.toUpperCase() && t.trade_status === 'Open';
            });

            if (existingOpen) {
                addAutoTradeLog(`⚠️ Symbol ${symName} đã có vị thế mở (Open Trade). Bỏ qua để tránh duplicate.`, 'warn');
                return;
            }

            // Calculate position volume from account risk
            const account = ctx.selectedAccount;
            const balance = Number(account?.initial_balance || account?.balance || account?.current_balance || 1000);
            const riskPct = Number(account?.setting?.riskPerTrade || 1);
            const riskAmount = (balance * riskPct) / 100;
            const stopDist = Math.abs(Number(targetSignal.entry) - Number(targetSignal.stop_loss));
            const volume = (riskAmount > 0 && stopDist > 0) ? Number((riskAmount / stopDist).toFixed(6)) : 0.001;

            addAutoTradeLog(`🎯 Phát hiện tín hiệu ${targetSignal.type.toUpperCase()} @ $${targetSignal.entry}! Đang gửi Order sang Binance...`, 'info', {
                signal: targetSignal,
                volume,
                riskAmount
            });

            // 1. Send Order directly to Binance via executeBinanceOrder (Client-side signed, zero API Key exposure)
            const symbolUpper = symName.toUpperCase();
            const isFutures = symbolUpper.endsWith('.P') || 
                              symbolUpper.includes('PERP') || 
                              symbolUpper.includes('FUTURES');
            const side = targetSignal.type.toLowerCase() === 'long' ? 'BUY' : 'SELL';

            const binanceOrderResult = await executeBinanceOrder({
                symbol: symName,
                side,
                type: 'MARKET',
                quantity: volume,
                price: targetSignal.entry,
                isFutures
            });

            const orderId = binanceOrderResult?.orderId || binanceOrderResult?.clientOrderId || 'SUCCESS';
            const nowIso = targetSignal.date || new Date().toISOString();

            // 2. Save Open Trade and Trade Detail in Strapi DB
            const plannedNotes = [
                `Auto Trade on Candle Close (${currentTf}) via Python Strategy ${stratName}`,
                `Binance Order ID: ${orderId} (${isFutures ? 'Futures' : 'Spot'})`,
                targetSignal.stop_loss ? `Planned SL: ${targetSignal.stop_loss}` : null,
                targetSignal.take_profit ? `Planned TP: ${targetSignal.take_profit}` : null,
            ].filter(Boolean).join('\n');

            try {
                const tradeData = {
                    type: targetSignal.type,
                    trade_status: 'Open',
                    mode: 'Real',
                    date: nowIso,
                    symbol: ctx.selectedSymbolId,
                    account: account?.documentId || account?.id,
                    strategy: ctx.activeStrategyId,
                    note: plannedNotes
                };

                const res = await api.post('/trades', { data: tradeData });
                const createdTrade = res.data?.data;
                const createdTradeId = createdTrade?.documentId || createdTrade?.id;

                if (createdTradeId) {
                    try {
                        await api.post('/trade-details', {
                            data: {
                                trade: createdTradeId,
                                date: nowIso,
                                signal: 'Entry',
                                type: targetSignal.type.toLowerCase() === 'long' ? 'Buy' : 'Sell',
                                price: Number(targetSignal.entry),
                                volume: Number(volume),
                                note: `Auto Trade entry filled @ ${targetSignal.entry}. SL: ${targetSignal.stop_loss || '--'}, TP: ${targetSignal.take_profit || '--'}. Order ID: ${orderId}`
                            }
                        });
                    } catch (detailErr) {
                        console.warn('Could not create trade detail in Strapi (optional):', detailErr);
                    }
                }
            } catch (dbErr) {
                console.error('Failed to save trade record in DB:', dbErr);
            }

            lastExecutedTradeTimeRef.current = signalKey;

            addAutoTradeLog(`🚀 [KHỚP LỆNH LIVE BINANCE] Đã gửi thành công lệnh ${targetSignal.type.toUpperCase()} ${symName} @ $${targetSignal.entry} lên Binance (Order #${orderId})! Đã tạo Open Trade vào DB.`, 'success');

            // Refresh account trades
            const accountId = account?.documentId || account?.id;
            if (accountId) {
                dispatch(fetchOpenTrades({ accountId }));
                refreshSelectedAccountTrades();
            }
        } catch (err) {
            console.error('Auto Trade Candle Close execution failed:', err);
            const errMsg = err?.message || JSON.stringify(err);
            addAutoTradeLog(`❌ Lỗi thực thi Auto Trade Binance: ${errMsg}`, 'error');
        } finally {
            setIsScanningOnCandleClose(false);
        }
    }, [addAutoTradeLog, dispatch, refreshSelectedAccountTrades]);

    // Binance WebSocket Real-time Kline Connection
    useEffect(() => {
        const symName = selectedSymbol?.Name || selectedSymbol?.name || symbolParam;
        if (!symName || !isCryptoSymbol) {
            setWsStatus('disconnected');
            setLiveCandle(null);
            setLivePrice(null);
            return;
        }

        const currentTf = timeframe || 'D1';

        const unsubscribe = subscribeBinanceKlineWS(
            symName,
            currentTf,
            (candle) => {
                setLiveCandle(candle);
                if (candle.close !== undefined) {
                    setLivePrice(candle.close);
                }

                // Throttle Redux dispatch to candle close or once every 5000ms
                // This prevents state.histories from continuously churning and recreating chart instances
                const now = Date.now();
                if (candle.isClosed || now - lastReduxDispatchTimeRef.current > 5000) {
                    lastReduxDispatchTimeRef.current = now;
                    dispatch(updateRealtimeCandle({
                        symbolId: selectedSymbolId,
                        symbolName: symName,
                        candle,
                        timeframe: currentTf
                    }));
                }

                // Tự động quét Python Strategy và gửi Order Binance khi nến đóng
                if (candle.isClosed) {
                    const ctx = autoTradeContextRef.current;
                    if (ctx?.isAutoTradeEnabled) {
                        const candleKey = `${symName}:${currentTf}:${candle.rawTime || candle.date || candle.tradingDate}`;
                        if (lastScannedCandleTimeRef.current !== candleKey) {
                            lastScannedCandleTimeRef.current = candleKey;
                            handleCandleCloseAutoTrade(candle, symName, currentTf);
                        }
                    }
                }
            },
            (status) => {
                setWsStatus(status);
            }
        );

        return () => {
            unsubscribe();
        };
    }, [dispatch, handleCandleCloseAutoTrade, isCryptoSymbol, selectedSymbol?.Name, selectedSymbol?.name, selectedSymbolId, symbolParam, timeframe]);

    useEffect(() => {
        dispatch(fetchSymbols());
        dispatch(fetchSignals());
        dispatch(fetchStrategies());
        dispatch(fetchOpenTrades({ accountId: selectedAccount?.documentId }));
    }, [dispatch, selectedAccount?.documentId]);

    // Select first symbol by default if likely?
    // Or just wait for user.

    useEffect(() => {
        if (selectedSymbolId) {
            const curTf = String(timeframe || 'D1').toUpperCase();
            // Check if the history for this symbol is already loaded in Redux or localStorage for current timeframe
            const isLoaded = histories && histories.some(h => {
                const symDocId = h.symbol?.documentId;
                const symNumId = h.symbol?.id;
                const target = String(selectedSymbolId);
                const matchesSym = (symDocId && String(symDocId) === target) ||
                                   (symNumId && String(symNumId) === target) ||
                                   (selectedSymbol && (
                                       (symDocId && selectedSymbol.documentId && String(symDocId) === String(selectedSymbol.documentId)) ||
                                       (symNumId && selectedSymbol.id && String(symNumId) === String(selectedSymbol.id)) ||
                                       (h.symbol?.Name && selectedSymbol.Name && String(h.symbol.Name).trim().toUpperCase() === String(selectedSymbol.Name).trim().toUpperCase())
                                   ));
                const hTf = String(h.timeframe || 'D1').toUpperCase();
                return matchesSym && hTf === curTf;
            });

            const hasInLocal = (() => {
                if (curTf !== 'D1') return false; // Intraday histories are not in localStorage
                try {
                    const cachedStr = localStorage.getItem('watchlist_histories');
                    if (!cachedStr) return false;
                    const cached = JSON.parse(cachedStr);
                    return cached.some(h => {
                        const symId = h.symbol?.documentId || h.symbol?.id;
                        return symId && symId.toString() === selectedSymbolId.toString();
                    });
                } catch { return false; }
            })();

            if (!isLoaded && !hasInLocal) {
                if (selectedSymbol && selectedSymbol.Name) {
                    dispatch(loadExternalHistory({
                        symbol: selectedSymbol.Name,
                        symbolId: selectedSymbolId,
                        marketType: selectedAccount?.market?.Name,
                        resolution: curTf
                    }));
                } else {
                    dispatch(fetchHistories({ symbolId: selectedSymbolId, timeframe: curTf, forceRefresh: true }));
                }
            }

            // Also fetch external indicators (only for VN stocks)
            const sym = symbols.find(s => (s.documentId || s.id) === selectedSymbolId);
            if (sym && sym.Name) {
                const isCrypto = selectedAccount?.market?.Name === 'Crypto' ||
                    /USDT|\.P|BINANCE:/i.test(sym.Name);
                if (!isCrypto) {
                    dispatch(fetchExternalIndicators(sym.Name));
                }
            }
        }
    }, [dispatch, selectedSymbolId, symbols, histories, timeframe, selectedSymbol, selectedAccount]);

    // 1. Thực hiện handleWatchlistRefresh để tải toàn bộ data cho symbol ngày mới nhất.
    // 2. Load toàn bộ symbol-history có symbol nằm trong watchlist vào localStorage vào key watchlist_histories và set watchlist_updated_latest = true.
    const handleWatchlistRefresh = useCallback(async () => {
        if (!defaultWatchlist || !defaultWatchlist.symbols || defaultWatchlist.symbols.length === 0) return;

        const symbolsList = defaultWatchlist.symbols;
        const symbolIds = symbolsList.map(s => s.documentId || s.id).filter(Boolean);
        if (symbolIds.length === 0) return;

        const isUpdatedLatest = localStorage.getItem('watchlist_updated_latest') === 'true' && localStorage.getItem('watchlist_histories');

        if (isUpdatedLatest) {
            console.log('Watchlist histories already in localStorage. Loading from cache...');
            dispatch(fetchHistories({ symbolIds, forceRefresh: false }));
            return;
        }

        console.log('1. Performing handleWatchlistRefresh to fetch latest data for all symbols in watchlist...');
        // 1. Fetch external history for all symbols in parallel
        const refreshPromises = symbolsList.map(s => {
            const symName = s.Name || s.name;
            const symId = s.documentId || s.id;
            if (!symName || !symId) return Promise.resolve();
            return dispatch(loadExternalHistory({
                symbol: symName,
                symbolId: symId,
                marketType: selectedAccount?.market?.Name
            })).unwrap().catch(err => {
                console.warn(`Failed external refresh for ${symName}:`, err);
            });
        });

        await Promise.all(refreshPromises);

        console.log('2. Loading all symbol-history for watchlist into localStorage and setting watchlist_updated_latest = true...');
        // 2. Load all symbol-history into localStorage & Redux
        await dispatch(fetchHistories({ symbolIds, forceRefresh: true })).unwrap();
    }, [defaultWatchlist, dispatch, selectedAccount?.market?.Name]);

    useEffect(() => {
        handleWatchlistRefresh();
    }, [handleWatchlistRefresh]);

    useEffect(() => {
        const accountId = selectedAccount?.documentId || selectedAccount?.id;
        if (!accountId) {
            setAccountTrades([]);
            return;
        }

        let cancelled = false;
        dispatch(fetchTrades({ accountId, pageSize: 50 }))
            .unwrap()
            .then(fetchedTrades => {
                if (!cancelled) setAccountTrades(fetchedTrades || []);
            })
            .catch(error => {
                if (!cancelled) {
                    console.error('Failed to fetch Trade Station account trades:', error);
                    setAccountTrades([]);
                }
            });

        return () => {
            cancelled = true;
        };
    }, [dispatch, selectedAccount]);

    useEffect(() => {
        getStrategyTemplates()
            .then(data => setTemplates(data || []))
            .catch(err => console.error('Failed to load strategy templates in TradeStation:', err));
    }, []);

    const symbolTemplates = useMemo(() => {
        if (!selectedSymbol) return [];
        const cleanSym = String(selectedSymbol.Name || selectedSymbol.name || '').trim().toUpperCase();
        return templates.filter(t => {
            const tSymName = String(t.symbolName || t.symbol?.Name || t.symbol?.name || '').trim().toUpperCase();
            return tSymName === cleanSym;
        });
    }, [templates, selectedSymbol]);

    const selectedTemplate = useMemo(() => {
        if (!selectedTemplateId) return null;
        return symbolTemplates.find(t =>
            String(t.documentId || t.id) === String(selectedTemplateId) ||
            String(t.id) === String(selectedTemplateId)
        ) || null;
    }, [selectedTemplateId, symbolTemplates]);

    useEffect(() => {
        if (selectedTemplateId) {
            const exists = symbolTemplates.some(t =>
                String(t.documentId || t.id) === String(selectedTemplateId) ||
                String(t.id) === String(selectedTemplateId)
            );
            if (!exists) {
                setSelectedTemplateId('');
                setChartTemplate('Supertrend');
                setMaPeriod(288);
                setStPeriod(10);
                setStMultiplier(3);
            }
        } else {
            setChartTemplate('Supertrend');
            setMaPeriod(288);
            setStPeriod(10);
            setStMultiplier(3);
        }
    }, [selectedSymbol, symbolTemplates, selectedTemplateId]);

    const handleSelectTemplate = (templateId) => {
        setSelectedTemplateId(templateId);
        if (!templateId) {
            setChartTemplate('Supertrend');
            setMaPeriod(288);
            setStPeriod(10);
            setStMultiplier(3);
            return;
        }
        const tpl = symbolTemplates.find(t =>
            String(t.documentId || t.id) === String(templateId) ||
            String(t.id) === String(templateId)
        );
        if (!tpl) {
            setChartTemplate('Supertrend');
            setMaPeriod(288);
            setStPeriod(10);
            setStMultiplier(3);
            return;
        }

        const cfg = tpl.config || {};
        const targetTf = tpl.timeframe || timeframe || 'D1';
        if (tpl.timeframe) {
            setTimeframe(tpl.timeframe);
        }

        const stratFile = (tpl.strategyFile || '').toLowerCase();
        const tplName = (tpl.name || '').toLowerCase();
        const isVWAP = stratFile.includes('vwap') || tplName.includes('vwap');
        const isIchimoku = stratFile.includes('ichimoku') || tplName.includes('ichimoku');

        if (isVWAP) {
            setChartTemplate('VWAP');
            const targetMa = parseInt(cfg.vwapMaPeriod || cfg.maPeriod) || 9;
            setMaPeriod(targetMa);
            if (cfg.vwapAnchor) {
                const anchorMap = { 'day': 'Day', 'week': 'Week', 'month': 'Month', 'year': 'Year', 'quarter': 'Quarter' };
                setVwapAnchor(anchorMap[cfg.vwapAnchor.toLowerCase()] || cfg.vwapAnchor);
            }
        } else if (isIchimoku) {
            setChartTemplate('Ichimoku');
            const targetMa = parseInt(cfg.maPeriod) || 78;
            setMaPeriod(targetMa);
        } else {
            setChartTemplate('Supertrend');
            const targetMa = parseInt(cfg.maPeriod) || 288;
            setMaPeriod(targetMa);
            if (cfg.stPeriod !== undefined) setStPeriod(parseInt(cfg.stPeriod) || 10);
            if (cfg.stMultiplier !== undefined) setStMultiplier(parseFloat(cfg.stMultiplier) || 3.0);
        }

        if (selectedSymbol && selectedSymbolId) {
            dispatch(loadExternalHistory({
                symbol: selectedSymbol.Name,
                symbolId: selectedSymbolId,
                marketType: selectedAccount?.market?.Name,
                resolution: targetTf
            }));
        }
    };

    const handleTimeframeChange = (newTf) => {
        setTimeframe(newTf);
        if (selectedSymbol && selectedSymbolId) {
            dispatch(loadExternalHistory({
                symbol: selectedSymbol.Name,
                symbolId: selectedSymbolId,
                marketType: selectedAccount?.market?.Name,
                resolution: newTf
            }));
        }
    };

    const activeSymbolHistories = useMemo(() => {
        if (!selectedSymbolId || !histories) return [];
        return histories.filter(h => {
            const symDocId = h.symbol?.documentId;
            const symNumId = h.symbol?.id;
            const target = String(selectedSymbolId);
            const matchesSym = (symDocId && String(symDocId) === target) ||
                               (symNumId && String(symNumId) === target) ||
                               (selectedSymbol && (
                                   (symDocId && selectedSymbol.documentId && String(symDocId) === String(selectedSymbol.documentId)) ||
                                   (symNumId && selectedSymbol.id && String(symNumId) === String(selectedSymbol.id)) ||
                                   (h.symbol?.Name && selectedSymbol.Name && String(h.symbol.Name).trim().toUpperCase() === String(selectedSymbol.Name).trim().toUpperCase())
                               ));
            if (!matchesSym) return false;
            if (timeframe) {
                const hTf = String(h.timeframe || 'D1').toUpperCase();
                const currentTf = String(timeframe || 'D1').toUpperCase();
                return hTf === currentTf;
            }
            return true;
        });
    }, [histories, selectedSymbolId, selectedSymbol, timeframe]);

    useEffect(() => {
        if (!selectedSymbolId || !selectedSymbol?.Name) return;
        const symName = selectedSymbol.Name.trim().toUpperCase();
        const isCrypto = selectedAccount?.market?.Name === 'Crypto' ||
            /USDT|\.P|BINANCE:/i.test(symName);
        if (isCrypto) return;

        if (metadataSyncedSymbolRef.current === selectedSymbolId) return;
        metadataSyncedSymbolRef.current = selectedSymbolId;

        dispatch(syncSymbolMetadata({
            ticker: selectedSymbol.Name,
            symbolId: selectedSymbolId,
        }))
        .unwrap()
        .then(() => console.log(`Metadata and stock ratio synced for ${selectedSymbol.Name}`))
        .catch(err => {
            metadataSyncedSymbolRef.current = null;
            console.error(`Failed to sync metadata and stock ratio: ${err}`);
        });
    }, [dispatch, selectedSymbol?.Name, selectedSymbolId, selectedAccount?.market?.Name]);

    useEffect(() => {
        if (!selectedSymbolId || !activeSymbolHistories || activeSymbolHistories.length === 0) return;
        if (timeframe && timeframe !== 'D1') return; // Only calculate daily technical analysis cache for D1

        const sortedHistory = [...activeSymbolHistories]
            .sort((a, b) => new Date(a.date) - new Date(b.date))
            .reduce((unique, candle) => {
                const date = String(candle.date || '').split('T')[0];
                if (date && unique[unique.length - 1]?.date !== date) {
                    unique.push({ ...candle, date });
                }
                return unique;
            }, []);
        const candles = sortedHistory.map(candle => ({
            time: candle.date,
            open: Number(candle.open),
            high: Number(candle.high),
            low: Number(candle.low),
            close: Number(candle.close),
        }));
        const supertrend = calculateSupertrend(10, 3, candles).at(-1);
        const ichimoku = calculateIchimoku(candles, {
            conversionPeriod: 26,
            basePeriod: 78,
            spanBPeriod: 156,
            displacement: 78,
        });
        const ma200 = calculateSMA(candles, 200).at(-1);

        upsertSymbolTechnicalAnalysis(selectedSymbolId, {
            supertrend: supertrend?.value ?? null,
            supertrendDirection: supertrend?.direction ?? null,
            k26: ichimoku.conversion.at(-1)?.value ?? null,
            k78: ichimoku.base.at(-1)?.value ?? null,
            ma200: ma200?.value ?? null,
            calculatedAt: new Date().toISOString(),
        }).catch(error => {
            console.error(`Failed to save technical analysis for ${selectedSymbol.Name}:`, error);
        });
    }, [activeSymbolHistories, selectedSymbol?.Name, selectedSymbolId, timeframe]);

    const handleEditTrade = useCallback((trade) => {
        setSelectedTrade(null);
        setTradeToEdit(trade);
        setIsTradeModalOpen(true);
    }, []);

    const handleSaveTrade = useCallback(async (tradeData) => {
        try {
            await dispatch(saveTrade({ tradeData, tradeToEdit })).unwrap();
            await refreshSelectedAccountTrades();
            dispatch(fetchOpenTrades({ accountId: selectedAccount?.documentId || selectedAccount?.id }));
            setIsTradeModalOpen(false);
            setTradeToEdit(null);
        } catch (error) {
            console.error('Failed to save trade from Trade Station:', error);
            alert(`Failed to save trade: ${error?.error?.message || error?.message || error}`);
        }
    }, [dispatch, refreshSelectedAccountTrades, selectedAccount, tradeToEdit]);

    const handleDeleteTrade = useCallback(async () => {
        if (!tradeToEdit) return;
        if (!window.confirm('Delete this trade and all of its trade details?')) return;

        try {
            await dispatch(deleteTrade({
                tradeId: tradeToEdit.documentId || tradeToEdit.id,
                tradeDetails: tradeToEdit.trade_details || []
            })).unwrap();
            await refreshSelectedAccountTrades();
            dispatch(fetchOpenTrades({ accountId: selectedAccount?.documentId || selectedAccount?.id }));
            setIsTradeModalOpen(false);
            setTradeToEdit(null);
        } catch (error) {
            console.error('Failed to delete trade from Trade Station:', error);
            alert(`Failed to delete trade: ${error?.error?.message || error?.message || error}`);
        }
    }, [dispatch, refreshSelectedAccountTrades, selectedAccount, tradeToEdit]);

    const handleCreateMissingSymbol = useCallback(async (formData) => {
        const name = String(formData?.Name || '').trim();
        if (!name) return;

        const normalizedName = name.toUpperCase();
        const existing = symbols.find(s => String(s.Name || '').trim().toUpperCase() === normalizedName);
        if (existing) {
            const existingId = existing.documentId || existing.id;
            setSelectedSymbolId(existingId);
            setShowCreateSymbolModal(false);
            setSearchParams({ symbol: normalizedName }, { replace: true });
            return;
        }

        setCreatingSymbol(true);
        try {
            const payload = {
                Name: normalizedName,
                Description: formData.Description || '',
                exchange: formData.exchange || '',
                sector: formData.sector || ''
            };

            if (selectedAccount?.market) {
                payload.market = selectedAccount.market.documentId || selectedAccount.market.id;
            }

            const created = await dispatch(createSymbol(payload)).unwrap();
            const createdId = created?.documentId || created?.id;
            const createdName = created?.Name || normalizedName;

            await dispatch(fetchSymbols());
            setShowCreateSymbolModal(false);

            if (createdId) {
                setSelectedSymbolId(createdId);
                setSearchParams({ symbol: createdName }, { replace: true });
            }
        } catch (error) {
            console.error('Failed to create missing symbol:', error);
            alert(`Failed to create symbol: ${error?.error?.message || error?.message || error}`);
        } finally {
            setCreatingSymbol(false);
        }
    }, [dispatch, selectedAccount?.market, setSearchParams, symbols]);

    const handleAddCurrentSymbolToWatchlist = useCallback(async () => {
        if (!selectedSymbol) return;
        if (!defaultWatchlist) {
            alert('No default watchlist found for the current account.');
            return;
        }

        const currentSymbolId = selectedSymbol.documentId || selectedSymbol.id;
        if (!currentSymbolId) return;

        const existingSymbolIds = (defaultWatchlist.symbols || [])
            .map(sym => sym.documentId || sym.id)
            .filter(Boolean);

        if (existingSymbolIds.includes(currentSymbolId)) {
            alert('Symbol is already in the current watchlist.');
            return;
        }

        setAddingToWatchlist(true);
        try {
            const nextSymbolIds = Array.from(new Set([...existingSymbolIds, currentSymbolId]));
            await dispatch(updateWatchlist({
                id: defaultWatchlist.documentId || defaultWatchlist.id,
                data: { symbols: nextSymbolIds }
            })).unwrap();
            await dispatch(fetchWatchlists());
        } catch (error) {
            console.error('Failed to add symbol to watchlist:', error);
            alert(`Failed to add symbol to watchlist: ${error?.error?.message || error?.message || error}`);
        } finally {
            setAddingToWatchlist(false);
        }
    }, [defaultWatchlist, dispatch, selectedSymbol]);

    const handleClearHistory = useCallback(async () => {
        if (!selectedSymbol || !selectedSymbolId) return;
        if (!window.confirm(`Are you sure you want to CLEAR history records for ${selectedSymbol.Name} (${timeframe || 'D1'})? This action cannot be undone.`)) return;
        try {
            await dispatch(deleteAllHistories({ symbolId: selectedSymbolId, timeframe })).unwrap();
            alert(`Successfully cleared history for ${selectedSymbol.Name} (${timeframe || 'D1'})`);
            dispatch(fetchHistories({ symbolId: selectedSymbolId, timeframe, forceRefresh: true }));
        } catch (error) {
            alert(`Failed to clear history: ${error}`);
        }
    }, [dispatch, selectedSymbol, selectedSymbolId, timeframe]);

    useEffect(() => {
        const loadTcbsInsights = async () => {
            const ticker = selectedSymbol?.Name?.trim().toUpperCase();
            if (!ticker) {
                setTcbsRecommendations([]);
                setTcbsRecentSignals([]);
                return;
            }

            const isCrypto = selectedAccount?.market?.Name === 'Crypto' ||
                /USDT|\.P|BINANCE:/i.test(ticker);
            if (isCrypto) {
                setTcbsRecommendations([]);
                setTcbsRecentSignals([]);
                return;
            }

            setLoadingTcbsInsights(true);
            try {
                const [recommendations, recentSignals] = await Promise.all([
                    getTcbsRecommendations({ ticker }),
                    fetchRecentTcbsStrategySignals(ticker),
                ]);
                setTcbsRecommendations(recommendations);
                setTcbsRecentSignals(recentSignals);
            } catch (err) {
                console.error('Failed to load TCBS insights for trade station:', err);
                setTcbsRecommendations([]);
                setTcbsRecentSignals([]);
            } finally {
                setLoadingTcbsInsights(false);
            }
        };

        loadTcbsInsights();
    }, [selectedSymbol?.Name, selectedAccount?.market?.Name]);

    // Active Strategy Look-up
    const activeStrategyId = useMemo(() => getStrategyId(selectedAccount?.strategy), [selectedAccount?.strategy]);

    const activeStrategy = useMemo(() => {
        if (!activeStrategyId || !strategies) return null;
        return strategies.find(s => {
            const strategyId = getStrategyId(s);
            return strategyId === activeStrategyId || s.documentId === activeStrategyId || s.id === activeStrategyId;
        }) || null;
    }, [activeStrategyId, strategies]);

    // Automatically sync chart template from strategy if specified
    useEffect(() => {
        if (activeStrategy?.template) {
            const rawTemplate = String(activeStrategy.template).trim();
            if (rawTemplate) {
                const matched = ['Supertrend', 'Ichimoku', 'VWAP'].find(
                    t => t.toLowerCase() === rawTemplate.toLowerCase()
                );
                setChartTemplate(matched || rawTemplate);
            }
        } else if (activeStrategy?.strategyFile) {
            const stratLower = activeStrategy.strategyFile.toLowerCase();
            if (stratLower.includes('ichimoku')) setChartTemplate('Ichimoku');
            else if (stratLower.includes('vwap')) setChartTemplate('VWAP');
            else if (stratLower.includes('supertrend')) setChartTemplate('Supertrend');
        }
    }, [activeStrategy?.template, activeStrategy?.strategyFile]);

    const activeStrategyRuleIds = useMemo(() => {
        return new Set([
            ...(activeStrategy?.rules || []),
            ...(activeStrategy?.entryRules || []),
            ...(activeStrategy?.takeProfitRules || []),
            ...(activeStrategy?.stoplossRules || []),
            ...(activeStrategy?.exitRules || [])
        ]
            .map(rule => rule?.documentId || rule?.id || rule)
            .filter(Boolean)
            .map(id => id.toString()));
    }, [activeStrategy]);

    // Signals do not store the strategy directly. They are linked to the
    // account and to rules, so use the active strategy's rule IDs here.
    const symbolSignals = useMemo(() => {
        if (!selectedSymbolId || !allSignals || allSignals.length === 0) return [];
        const selectedAccountId = selectedAccount?.documentId || selectedAccount?.id;
        if (!selectedAccountId || activeStrategyRuleIds.size === 0) return [];

        return allSignals.filter(signal => {
            const signalSymbolId = signal.symbol?.documentId || signal.symbol?.id;
            if (signalSymbolId?.toString() !== selectedSymbolId?.toString()) return false;

            const signalAccountId = signal.account?.documentId || signal.account?.id;
            if (!signalAccountId || signalAccountId.toString() !== selectedAccountId.toString()) {
                return false;
            }

            return (signal.rules || []).some(rule => {
                const ruleId = rule?.documentId || rule?.id || rule;
                return ruleId && activeStrategyRuleIds.has(ruleId.toString());
            });
        });
    }, [selectedSymbolId, allSignals, selectedAccount?.documentId, selectedAccount?.id, activeStrategyRuleIds]);

    // Older manually-created trades may not have `mode` persisted even though
    // Real is the schema default. Demo trades are always explicitly marked.
    const realTrades = useMemo(() => {
        if (!accountTrades) return [];
        return accountTrades.filter(trade => trade.mode !== 'Demo');
    }, [accountTrades]);

    const symbolTrades = useMemo(() => {
        if (!selectedSymbolId) return realTrades;
        const selSymName = selectedSymbol?.Name?.trim().toUpperCase();
        const selSymDocId = selectedSymbol?.documentId ? String(selectedSymbol.documentId) : null;
        const selSymNumId = selectedSymbol?.id ? String(selectedSymbol.id) : null;
        const targetId = String(selectedSymbolId);

        return realTrades.filter(trade => {
            const tradeSymbolDocId = trade.symbol?.documentId ? String(trade.symbol.documentId) : null;
            const tradeSymbolNumId = trade.symbol?.id ? String(trade.symbol.id) : null;
            const tradeSymName = trade.symbol?.Name?.trim().toUpperCase();

            const idsMatch = (tradeSymbolDocId && (tradeSymbolDocId === targetId || tradeSymbolDocId === selSymDocId)) ||
                             (tradeSymbolNumId && (tradeSymbolNumId === targetId || tradeSymbolNumId === selSymNumId));
            const namesMatch = tradeSymName && selSymName && tradeSymName === selSymName;

            return idsMatch || namesMatch;
        });
    }, [selectedSymbolId, realTrades, selectedSymbol]);


    const handleRefresh = useCallback(() => {
        if (!selectedSymbol || !selectedSymbolId) return;
        const ticker = selectedSymbol.Name;
        if (!ticker) return;
        const accountId = selectedAccount ? (selectedAccount.documentId || selectedAccount.id) : null;
        const selectedRuleIds = Array.from(new Set([
            ...(activeStrategy?.rules || []),
            ...(activeStrategy?.entryRules || []),
            ...(activeStrategy?.takeProfitRules || []),
            ...(activeStrategy?.stoplossRules || []),
            ...(activeStrategy?.exitRules || [])
        ].map(rule => rule.documentId || rule.id).filter(Boolean)));
        const scanSymbols = [{
            id: selectedSymbolId,
            documentId: selectedSymbolId,
            name: selectedSymbol.Name,
            Name: selectedSymbol.Name
        }];

        dispatch(loadExternalHistory({
            symbol: ticker,
            symbolId: selectedSymbolId,
            marketType: selectedAccount?.market?.Name, // Pass Account Market Type
            resolution: timeframe || 'D1'
        }))
            .unwrap()
            .then(count => {
                if (count > 0) console.log(`Updated ${count} new records for ${ticker}`);
                else if (count === 0) console.log('No new records');

                if (selectedRuleIds.length > 0) {
                    return dispatch(scanSignals({
                        selectedRuleIds,
                        scanSymbols,
                        accountId,
                        strategyId: activeStrategyId,
                        syncDemoTrades: false
                    })).unwrap();
                }

                return 0;
            })
            .then(() => {
                if (accountId) refreshSelectedAccountTrades();
            })
            .catch(err => console.error(`Failed to refresh history: ${err}`));

    }, [activeStrategy, activeStrategyId, dispatch, refreshSelectedAccountTrades, selectedAccount, selectedSymbol, selectedSymbolId, timeframe]);

    // Keep autoTradeContextRef up to date
    useEffect(() => {
        autoTradeContextRef.current = {
            isAutoTradeEnabled,
            selectedTemplate,
            selectedAccount,
            accountTrades,
            activeStrategyId,
            selectedSymbol,
            selectedSymbolId,
            chartTemplate,
            timeframe,
            vwapAnchor,
            stPeriod,
            stMultiplier,
            activeSymbolHistories
        };
    }, [isAutoTradeEnabled, selectedTemplate, selectedAccount, accountTrades, activeStrategyId, selectedSymbol, selectedSymbolId, chartTemplate, timeframe, vwapAnchor, stPeriod, stMultiplier, activeSymbolHistories]);

    const handleAutoTrade = useCallback(async () => {
        if (!selectedSymbol) {
            alert('Vui lòng chọn một Symbol trước khi Auto Trade.');
            return;
        }

        const symName = selectedSymbol.Name || selectedSymbol.name;
        setAutoTrading(true);

        try {
            // 1. Determine template & configuration
            const tpl = selectedTemplate;
            const cfg = tpl?.config || {};
            const stratFile = tpl?.strategyFile || (chartTemplate === 'VWAP' ? 'strategy_vwap_ma9.py' : 'strategy_supertrend_ma288.py');
            const isVWAP = chartTemplate === 'VWAP' || (stratFile && stratFile.toLowerCase().includes('vwap')) || (tpl?.name && tpl.name.toLowerCase().includes('vwap'));
            const targetTf = tpl?.timeframe || timeframe || 'D1';

            let entry = null;
            let sl = null;
            let tp = null;

            // 2. Try Python Strategy scan if template or python strategy is specified
            if (tpl?.strategyFile || tpl?.type === 'Python' || stratFile) {
                try {
                    const scanParams = {
                        strategyFile: stratFile,
                        ticker: symName,
                        timeframe: targetTf,
                        countback: 500,
                        ...(cfg || {})
                    };
                    const res = await scanPythonStrategy(scanParams);
                    if (res) {
                        const activeTrade = res.summary?.activeTrade;
                        const latestTrade = res.summary?.latestTrade;
                        
                        if (activeTrade && activeTrade.entry_price && activeTrade.stop_loss) {
                            entry = activeTrade.entry_price;
                            sl = activeTrade.stop_loss;
                            tp = activeTrade.take_profit;
                        } else if (latestTrade && latestTrade.entry_price && latestTrade.stop_loss) {
                            entry = latestTrade.entry_price;
                            sl = latestTrade.stop_loss;
                            tp = latestTrade.take_profit;
                        } else if (res.summary?.currentPrice) {
                            entry = livePrice || res.summary.currentPrice;
                            if (isVWAP) {
                                const lastCandle = res.candles?.at(-1);
                                const vwapVal = lastCandle?.vwap || res.summary?.vwap;
                                sl = vwapVal ? +Number(vwapVal).toFixed(2) : null;
                                if (entry && sl) {
                                    const dist = Math.abs(entry - sl);
                                    tp = +(entry >= sl ? entry + dist * (cfg.rr || 1.5) : entry - dist * (cfg.rr || 1.5)).toFixed(2);
                                }
                            } else {
                                const stVal = res.summary.supertrend || res.candles?.at(-1)?.supertrend;
                                const stDir = res.summary.st_direction || res.candles?.at(-1)?.st_direction || 1;
                                sl = stVal ? +Number(stVal).toFixed(2) : null;
                                if (entry && sl) {
                                    const dist = Math.abs(entry - sl);
                                    tp = +(stDir === 1 ? entry + dist * (cfg.rr || 1.5) : entry - dist * (cfg.rr || 1.5)).toFixed(2);
                                }
                            }
                        }
                    }
                } catch (scanErr) {
                    console.warn('Python strategy scan fallback to local indicator:', scanErr);
                }
            }

            // 3. Fallback to client-side indicator calculation if Entry/SL/TP not yet computed
            if (!entry || !sl || !tp) {
                const sortedHistory = [...activeSymbolHistories]
                    .sort((a, b) => new Date(a.date) - new Date(b.date));

                const candles = sortedHistory.map(candle => ({
                    time: candle.date,
                    open: Number(candle.open),
                    high: Number(candle.high),
                    low: Number(candle.low),
                    close: Number(candle.close),
                    volume: Number(candle.volume || 0),
                }));

                if (candles.length > 0) {
                    const lastCandle = candles[candles.length - 1];
                    const curPrice = Number(livePrice || lastCandle.close);
                    entry = curPrice;

                    if (isVWAP) {
                        const anchor = cfg.vwapAnchor || vwapAnchor || 'Year';
                        const vwapData = calculateVWAP(candles, anchor);
                        const lastVwap = vwapData.at(-1);
                        if (lastVwap) {
                            sl = lastVwap.value;
                            if (curPrice >= lastVwap.value) {
                                tp = lastVwap.upper1 || Number((curPrice + Math.abs(curPrice - sl) * 1.5).toFixed(2));
                            } else {
                                tp = lastVwap.lower1 || Number((curPrice - Math.abs(curPrice - sl) * 1.5).toFixed(2));
                            }
                        }
                    } else {
                        const curStPeriod = parseInt(cfg.stPeriod || stPeriod || 10, 10);
                        const curStMultiplier = parseFloat(cfg.stMultiplier || stMultiplier || 3.0);
                        const curRr = parseFloat(cfg.rr || 1.5);
                        const stData = calculateSupertrend(curStPeriod, curStMultiplier, candles);
                        const lastSt = stData.at(-1);
                        if (lastSt) {
                            sl = lastSt.value;
                            const risk = Math.abs(curPrice - sl);
                            if (lastSt.direction === 1 || curPrice >= sl) {
                                tp = Number((curPrice + risk * curRr).toFixed(2));
                            } else {
                                tp = Number((curPrice - risk * curRr).toFixed(2));
                            }
                        }
                    }
                }
            }

            // 4. Update the order form state
            if (entry && sl) {
                const actualEntry = livePrice && Number(livePrice) > 0 ? Number(livePrice) : Number(entry);
                const actualSl = Number(sl);
                const isLong = actualEntry >= actualSl;
                const rrRatio = cfg.rr ? parseFloat(cfg.rr) : 1.5;
                const calculatedTp = isLong ? (actualEntry + Math.abs(actualEntry - actualSl) * rrRatio) : (actualEntry - Math.abs(actualEntry - actualSl) * rrRatio);
                const finalTp = tp ? Number(tp) : calculatedTp;

                setTradeFormSetup({
                    price: String(Number(actualEntry.toFixed(6))),
                    slPrice: String(Number(actualSl.toFixed(6))),
                    tpPrice: String(Number(finalTp.toFixed(6)))
                });
            } else {
                alert('Chưa tính được điểm Entry/SL/TP. Vui lòng kiểm tra lại lịch sử giá hoặc template.');
            }
        } catch (err) {
            console.error('Auto Trade calculation failed:', err);
            alert(`Auto Trade thất bại: ${err?.message || err}`);
        } finally {
            setAutoTrading(false);
        }
    }, [selectedSymbol, selectedTemplate, chartTemplate, timeframe, livePrice, activeSymbolHistories, vwapAnchor, stPeriod, stMultiplier]);

    // 3. Mỗi lần change symbol từ watchlist, hãy kiểm tra từ localStorage xem symbol đó đã có data của ngày hôm nay chưa (chỉ cho D1).
    useEffect(() => {
        if (!symbolParam || !selectedSymbol || !selectedSymbolId) return;
        if (timeframe && timeframe !== 'D1') return; // Only auto-refresh D1 candles on symbol param change

        let symbolCandles = [];
        const cachedStr = localStorage.getItem('watchlist_histories');
        if (cachedStr) {
            try {
                const cached = JSON.parse(cachedStr);
                symbolCandles = cached.filter(h => {
                    const symId = h.symbol?.documentId || h.symbol?.id;
                    return symId && symId.toString() === selectedSymbolId.toString();
                });
            } catch (e) {
                console.error('Error parsing watchlist_histories from localStorage:', e);
            }
        }

        if (symbolCandles.length === 0 && activeSymbolHistories && activeSymbolHistories.length > 0) {
            symbolCandles = activeSymbolHistories;
        }

        const hasToday = hasTodayCandle(symbolCandles);
        if (hasToday) {
            console.log(`Symbol ${selectedSymbol.Name} already has today's candle. Skipping refresh.`);
            return;
        }

        console.log(`Symbol ${selectedSymbol.Name} does NOT have today's candle. Getting latest data from API...`);
        const refreshKey = `${selectedSymbolId}:${symbolParam}`;
        if (lastAutoRefreshedSymbolRef.current === refreshKey) return;

        lastAutoRefreshedSymbolRef.current = refreshKey;
        handleRefresh();
    }, [activeSymbolHistories, handleRefresh, selectedSymbol, selectedSymbolId, symbolParam, timeframe]);

    return (
        <div className="flex flex-col h-[calc(100vh-6rem)] gap-4">
            <CreateSymbolModal
                key={symbolParam || 'create-symbol'}
                isOpen={showCreateSymbolModal}
                onClose={() => setShowCreateSymbolModal(false)}
                onSubmit={handleCreateMissingSymbol}
                initialName={symbolParam || ''}
                isSubmitting={creatingSymbol}
            />

            <div className="flex flex-1 gap-4 min-h-0">
                {/* Left Column: Chart & Strategy */}
                <div className="flex flex-col flex-1 gap-4 min-h-0">
                    {/* Left Panel: Chart */}
                    <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col">
                        <div className="p-2 border-b border-gray-700 bg-gray-900/50 flex justify-between items-center flex-wrap gap-2">
                            <div className="flex items-center gap-3 flex-wrap">
                                <h2 className="text-xl font-bold text-white">
                                    {selectedSymbol ? `${selectedSymbol.Name}` : 'Select a Symbol'}
                                </h2>
                                <span className="text-sm text-gray-400">{selectedSymbol?.exchange} - {selectedSymbol?.sector}</span>

                                {isCryptoSymbol && (
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition ${
                                            wsStatus === 'connected'
                                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                                : wsStatus === 'connecting'
                                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                                                : 'bg-gray-700/50 text-gray-400 border border-gray-600'
                                        }`}>
                                            <span className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : 'bg-gray-400'}`} />
                                            <span>{wsStatus === 'connected' ? 'Binance Live' : wsStatus === 'connecting' ? 'Connecting...' : 'Offline'}</span>
                                        </span>
                                        {livePrice && (
                                            <span className="text-xs font-mono font-bold text-emerald-300 bg-gray-900 px-2 py-0.5 rounded border border-emerald-500/30 shadow-sm animate-pulse">
                                                ${Number(livePrice).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={toggleAutoTrade}
                                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold transition cursor-pointer shadow-sm ${
                                                isAutoTradeEnabled
                                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/60 hover:bg-emerald-500/30'
                                                    : 'bg-gray-800/80 text-gray-400 border border-gray-700 hover:bg-gray-700 hover:text-gray-300'
                                            }`}
                                            title={isAutoTradeEnabled ? 'Auto Trade đang BẬT: Quét nến đóng và gửi Order Binance' : 'Bấm để Bật Auto Trade'}
                                        >
                                            <span className={`w-2 h-2 rounded-full ${isAutoTradeEnabled ? 'bg-emerald-400 animate-ping' : 'bg-gray-500'}`} />
                                            <span>{isAutoTradeEnabled ? 'Auto Trade: ON' : 'Auto Trade: OFF'}</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {loading && <span className="text-sm text-blue-400 animate-pulse">Loading data...</span>}

                            <div className="ml-auto flex items-center justify-end gap-2 flex-wrap">
                                {/* Timeframe Dropdown */}
                                <label className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                                    <span>Timeframe</span>
                                    <select
                                        aria-label="Timeframe"
                                        value={timeframe}
                                        onChange={e => handleTimeframeChange(e.target.value)}
                                        className="rounded-lg border border-gray-600 bg-gray-700 px-2.5 py-1.5 text-xs text-white transition hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer"
                                    >
                                        <option value="M1">1m (M1)</option>
                                        <option value="M5">5m (M5)</option>
                                        <option value="M15">15m (M15)</option>
                                        <option value="M30">30m (M30)</option>
                                        <option value="H1">1h (H1)</option>
                                        <option value="H4">4h (H4)</option>
                                        <option value="D1">1D (D1)</option>
                                        <option value="W1">1W (W1)</option>
                                    </select>
                                </label>

                                {/* Strategy Template Dropdown */}
                                <label className="inline-flex items-center gap-1.5 text-xs text-cyan-300">
                                    <BookmarkCheck size={14} className="text-cyan-400 shrink-0" />
                                    <span>Template</span>
                                    <select
                                        aria-label="Strategy Template"
                                        value={selectedTemplateId}
                                        onChange={e => handleSelectTemplate(e.target.value)}
                                        className="rounded-lg border border-cyan-700/60 bg-gray-900 px-2.5 py-1.5 text-xs text-cyan-200 transition hover:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[170px] truncate font-medium cursor-pointer"
                                    >
                                        <option value="">-- Template ({symbolTemplates.length}) --</option>
                                        {symbolTemplates.map(tpl => {
                                            const tplId = String(tpl.documentId || tpl.id);
                                            return (
                                                <option key={tplId} value={tplId}>
                                                    {tpl.name} ({tpl.timeframe || 'D1'})
                                                </option>
                                            );
                                        })}
                                    </select>
                                </label>
                                {chartTemplate === 'VWAP' && (
                                    <label className="inline-flex items-center gap-1.5 text-xs text-gray-400">
                                        <span>Anchor</span>
                                        <select
                                            aria-label="VWAP Anchor"
                                            value={vwapAnchor}
                                            onChange={event => setVwapAnchor(event.target.value)}
                                            className="rounded-lg border border-gray-600 bg-gray-700 px-2.5 py-1.5 text-xs text-white transition hover:bg-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium cursor-pointer"
                                        >
                                            <option value="Day">Day</option>
                                            <option value="Week">Week</option>
                                            <option value="Month">Month</option>
                                            <option value="Year">Year</option>
                                        </select>
                                    </label>
                                )}
                                {selectedSymbol && (
                                    <button
                                        type="button"
                                        onClick={handleAddCurrentSymbolToWatchlist}
                                        disabled={addingToWatchlist || !defaultWatchlist}
                                        className="inline-flex items-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2 text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                                        title={addingToWatchlist ? 'Adding...' : (defaultWatchlist ? 'Add symbol to default watchlist' : 'No default watchlist available')}
                                    >
                                        <Plus size={18} />
                                    </button>
                                )}
                                {selectedSymbol && (
                                    <button
                                        type="button"
                                        onClick={handleClearHistory}
                                        className="inline-flex items-center rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-amber-300 transition hover:bg-amber-500/20"
                                        title="Clear all price history records for this symbol"
                                    >
                                        <History size={18} />
                                    </button>
                                )}
                                {selectedSymbol && (
                                    <button
                                        type="button"
                                        onClick={handleRefresh}
                                        disabled={historyLoading}
                                        className="refresh-btn inline-flex items-center rounded-lg bg-gray-700 p-2 text-blue-400 transition hover:bg-gray-600 disabled:opacity-50 cursor-pointer"
                                        title={historyLoading ? 'Refreshing...' : 'Refresh data'}
                                    >
                                        <RefreshCw size={18} className={historyLoading ? 'animate-spin' : ''} />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 min-h-0">
                            <TradingViewChart
                                data={activeSymbolHistories}
                                symbol={selectedSymbol?.Name}
                                signals={symbolSignals}
                                strategy={activeStrategy}
                                template={chartTemplate}
                                vwapAnchor={vwapAnchor}
                                supertrendPeriod={stPeriod}
                                supertrendMultiplier={stMultiplier}
                                maPeriod={maPeriod}
                                timeframe={timeframe}
                                liveCandle={liveCandle}
                            />
                        </div>
                    </div>

                    {/* Strategy Panel */}
                    <StrategyPanel
                        activeStrategy={activeStrategy}
                        trades={symbolTrades}
                        onTradeClick={setSelectedTrade}
                        signals={symbolSignals}
                        recommendations={tcbsRecommendations}
                        tcbsSignals={tcbsRecentSignals}
                        loadingTcbsInsights={loadingTcbsInsights}
                        selectedTemplate={selectedTemplate}
                        onAutoTrade={handleAutoTrade}
                        autoTrading={autoTrading}
                        isAutoTradeEnabled={isAutoTradeEnabled}
                        onToggleAutoTrade={toggleAutoTrade}
                        autoTradeLogs={autoTradeLogs}
                        isScanningOnCandleClose={isScanningOnCandleClose}
                        selectedSymbol={selectedSymbol}
                        timeframe={timeframe}
                        onClearLogs={() => setAutoTradeLogs([])}
                    />
                </div>
                <div className="w-80 flex flex-col gap-4 h-full shrink-0">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 p-3 shadow-lg flex flex-col">
                        <WatchlistSelector
                            className="justify-between mt-2"
                            showSymbols={true}
                            selectedSymbolId={selectedSymbolId}
                            onSymbolClick={(symbol) => {
                                setSelectedSymbolId(symbol.documentId || symbol.id);
                                setSearchParams({ symbol: symbol.Name }, { replace: true });
                            }}
                        />
                    </div>
                    <TradeStationOrderForm
                        key={tradeSetupKey}
                        selectedAccount={selectedAccount}
                        selectedSymbol={selectedSymbol}
                        activeStrategy={activeStrategy}
                        value={tradeSetupValue}
                        onSaved={refreshSelectedAccountTrades}
                    />
                    <TechnicalPanel externalIndicators={externalIndicators} />
                </div>
            </div>
            <TradeDetailModal
                isOpen={Boolean(selectedTrade)}
                onClose={() => setSelectedTrade(null)}
                trade={selectedTrade}
                onEdit={handleEditTrade}
            />
            <TradeModal
                isOpen={isTradeModalOpen}
                onClose={() => {
                    setIsTradeModalOpen(false);
                    setTradeToEdit(null);
                }}
                onSubmit={handleSaveTrade}
                onDelete={handleDeleteTrade}
                initialData={tradeToEdit}
            />
        </div>
    );
};

export default TradeStation;
