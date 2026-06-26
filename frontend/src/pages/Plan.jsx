import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation } from 'react-router-dom';
import {
    Calendar,
    CalendarDays,
    CheckSquare,
    ChevronDown,
    Edit2,
    Plus,
    Save,
    Target,
    Trash2,
    ListChecks,
    TrendingUp,
    Activity,
    CheckCircle2,
    X
} from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import TradeDetailModal from '../components/TradeDetailModal';
import TradeModal from '../components/TradeModal';
import api from '../services/api';
import { fetchBatchLatestMinutePrices, fetchLatestHistory } from '../features/marketSlice';
import { deleteTrade, fetchTrades, saveTrade } from '../features/tradeSlice';
import { extractTextFromBlocks } from '../utils/textUtils';
import { createPlan, deletePlan, listPlans, updatePlan } from '../services/planService';
import { calculateTradePnL } from '../utils/tradeCalculations';
import { formatNumber } from '../utils/formatNumber';
import { formatMoney } from '../utils/formatMoney';
import { buildRoadmapProjection, resolveSetting, summarizeClosedTrades, toNumber } from '../utils/roadmapCalculations';

const getLocalDateValue = (date = new Date()) => {
    const d = new Date(date);
    const offset = d.getTimezoneOffset();
    return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const addDaysToDateValue = (value, days) => {
    if (!value) return '';
    const date = new Date(`${value}T12:00:00`);
    date.setDate(date.getDate() + days);
    return getLocalDateValue(date);
};

const isDateInRange = (dateValue, startValue, endValue) => {
    if (!dateValue || !startValue || !endValue) return false;
    const date = new Date(`${dateValue}T12:00:00`).getTime();
    const start = new Date(`${startValue}T12:00:00`).getTime();
    const end = new Date(`${endValue}T12:00:00`).getTime();
    return date >= start && date <= end;
};

const getVietnameseWeekdayLabel = (dateValue) => {
    if (!dateValue) return '';
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const date = new Date(`${dateValue}T12:00:00`);
    return labels[date.getDay()] || '';
};

const getDateValueFromDateLike = (dateLike) => {
    if (!dateLike) return '';
    if (typeof dateLike === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateLike)) {
        return dateLike;
    }
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return '';
    return getLocalDateValue(date);
};

const formatDetailTime = (dateLike) => {
    if (!dateLike) return '-';
    const date = new Date(dateLike);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    });
};

const isCryptoSymbol = (symbol) => {
    const symbolName = symbol?.Name || symbol?.name || '';
    const marketName = symbol?.market?.Name || symbol?.market?.name || '';

    return /crypto|binance/i.test(marketName)
        || /^BINANCE:/i.test(symbolName)
        || /(?:USDT|USDC|BUSD)(?:\.P)?$/i.test(symbolName);
};

const getAccountInfo = (accounts, accountId) => {
    const account = accounts.find(item => String(item.id || item.documentId) === String(accountId));
    return {
        accountId: account ? String(account.id || account.documentId) : '',
        accountName: account?.name || account?.account_name || account?.currency || 'Unknown Account'
    };
};

const buildEmptyForm = (selectedAccount, accounts) => {
    const now = getLocalDateValue();
    const accountId = selectedAccount ? String(selectedAccount.id || selectedAccount.documentId) : '';
    const accountInfo = getAccountInfo(accounts, accountId);

    return {
        id: null,
        documentId: null,
        accountId: accountInfo.accountId,
        accountName: accountInfo.accountName,
        title: '',
        scope: 'Daily',
        planDate: now,
        weekStart: now,
        weekEnd: addDaysToDateValue(now, 6),
        session: '',
        marketContext: '',
        symbols: '',
        entryPlan: '',
        riskPlan: '',
        checklist: '',
        reviewNotes: '',
        status: 'Draft',
        maxTrades: 3
    };
};

const Plan = () => {
    const { accounts, selectedAccount } = useAccount();
    const location = useLocation();
    const dispatch = useDispatch();
    const { items: trades, loading: tradesLoading } = useSelector(state => state.trades);
    const [plans, setPlans] = useState([]);
    const [form, setForm] = useState(() => buildEmptyForm(selectedAccount, accounts));
    const [isEditing, setIsEditing] = useState(false);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [marketPricesMap, setMarketPricesMap] = useState({});
    const [selectedTrade, setSelectedTrade] = useState(null);
    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);
    const [tradeToEdit, setTradeToEdit] = useState(null);
    const [selectedWeekId, setSelectedWeekId] = useState('');
    const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false);
    const [processedRoadmap, setProcessedRoadmap] = useState(null);
    const [collapsedBoxes, setCollapsedBoxes] = useState({
        openTrades: false,
        createPlan: false,
        formGuide: false
    });

    // Auto-hide toast after 3 seconds
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    const selectedAccountId = selectedAccount ? String(selectedAccount.id || selectedAccount.documentId) : '';

    useEffect(() => {
        if (!selectedAccount) return;
        dispatch(fetchTrades({ accountId: selectedAccount.documentId || selectedAccount.id, pageSize: 1000 }));
    }, [dispatch, selectedAccount]);

    useEffect(() => {
        if (!trades || trades.length === 0) {
            setMarketPricesMap({});
            return;
        }

        const symbolsById = trades.reduce((acc, trade) => {
            const symbol = trade.symbol;
            const symbolId = symbol?.documentId || symbol?.id;
            if (symbol && symbolId) {
                acc[symbolId] = symbol;
            }
            return acc;
        }, {});

        const symbols = Object.values(symbolsById);
        if (symbols.length === 0) {
            setMarketPricesMap({});
            return;
        }

        const refreshMarketPrices = async () => {
            const cryptoSymbols = symbols.filter(isCryptoSymbol);
            const nonCryptoSymbols = symbols.filter(symbol => !isCryptoSymbol(symbol));
            const nextPricesMap = {};

            if (cryptoSymbols.length > 0) {
                const cryptoResult = await dispatch(fetchBatchLatestMinutePrices(cryptoSymbols));
                if (fetchBatchLatestMinutePrices.fulfilled.match(cryptoResult)) {
                    Object.assign(nextPricesMap, cryptoResult.payload || {});
                }
            }

            const nonCryptoEntries = await Promise.all(
                nonCryptoSymbols.map(async (symbol) => {
                    const symbolId = symbol?.documentId || symbol?.id;
                    if (!symbolId) return null;

                    try {
                        const result = await dispatch(fetchLatestHistory(symbolId));
                        if (fetchLatestHistory.fulfilled.match(result) && result.payload?.symbolId) {
                            return [String(result.payload.symbolId), result.payload.close];
                        }
                    } catch (error) {
                        console.warn(`Failed to fetch latest history for symbol ${symbolId}:`, error);
                    }

                    return null;
                })
            );

            nonCryptoEntries.forEach(entry => {
                if (!entry) return;
                const [symbolId, price] = entry;
                nextPricesMap[symbolId] = price;
            });

            setMarketPricesMap(nextPricesMap);
        };

        refreshMarketPrices();
        const intervalId = window.setInterval(refreshMarketPrices, 60 * 1000);

        return () => window.clearInterval(intervalId);
    }, [dispatch, trades]);

    const refreshPlans = async () => {
        try {
            setLoadingPlans(true);
            setError('');
            const allPlans = await listPlans();
            setPlans(allPlans);
        } catch (err) {
            console.error('Failed to load plans:', err);
            setError(err?.message || 'Failed to load plans.');
        } finally {
            setLoadingPlans(false);
        }
    };

    useEffect(() => {
        refreshPlans();
    }, []);

    useEffect(() => {
        if (!selectedAccount) {
            setProcessedRoadmap(null);
            return;
        }

        const loadProcessedRoadmap = async () => {
            try {
                const accountId = selectedAccount.documentId || selectedAccount.id;
                const res = await api.get(`/roadmaps?filters[account][documentId][$eq]=${accountId}&filters[status][$eq]=process&sort=updatedAt:desc&pagination[pageSize]=1&populate=*`);
                const data = res.data.data || [];
                setProcessedRoadmap(data[0] || null);
            } catch (error) {
                console.error('Failed to load processed roadmap:', error);
                setProcessedRoadmap(null);
            }
        };

        loadProcessedRoadmap();
    }, [selectedAccount]);

    useEffect(() => {
        if (!selectedAccount) return;

        if (isEditing) {
            const accountInfo = getAccountInfo(accounts, selectedAccount.id || selectedAccount.documentId);
            setForm(prev => ({
                ...prev,
                accountId: accountInfo.accountId,
                accountName: accountInfo.accountName
            }));
            return;
        }

        setForm(buildEmptyForm(selectedAccount, accounts));
    }, [selectedAccount, accounts, isEditing]);

    useEffect(() => {
        if (form.scope !== 'Weekly') return;
        setForm(prev => {
            if (!prev.weekStart) return prev;
            const nextWeekEnd = addDaysToDateValue(prev.weekStart, 6);
            return prev.weekEnd === nextWeekEnd ? prev : { ...prev, weekEnd: nextWeekEnd };
        });
    }, [form.scope, form.weekStart]);

    const filteredPlans = useMemo(() => {
        return [...plans]
            .filter(plan => !selectedAccountId || String(plan.accountId) === selectedAccountId)
            .sort((a, b) => new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0));
    }, [plans, selectedAccountId]);

    const planTree = useMemo(() => {
        const weeklyPlans = filteredPlans
            .filter(plan => plan.scope === 'Weekly')
            .sort((a, b) => new Date(b.weekStart || b.planDate || b.createdAt || 0) - new Date(a.weekStart || a.planDate || a.createdAt || 0));
        const dailyPlans = filteredPlans
            .filter(plan => plan.scope === 'Daily')
            .sort((a, b) => new Date(b.planDate || b.createdAt || 0) - new Date(a.planDate || a.createdAt || 0));

        const weeklyGroups = weeklyPlans.map(weeklyPlan => ({
            weeklyPlan,
            weeklyStart: getDateValueFromDateLike(weeklyPlan.weekStart || weeklyPlan.planDate || weeklyPlan.createdAt),
            weeklyEnd: getDateValueFromDateLike(weeklyPlan.weekEnd || weeklyPlan.weekStart || weeklyPlan.planDate || weeklyPlan.createdAt),
            children: []
        }));

        const standaloneDailyPlans = [];

        dailyPlans.forEach(dailyPlan => {
            const dailyDate = getDateValueFromDateLike(dailyPlan.planDate || dailyPlan.createdAt);

            let targetIndex = weeklyGroups.findIndex(group => isDateInRange(dailyDate, group.weeklyStart, group.weeklyEnd));

            if (targetIndex === -1 && weeklyGroups.length > 0) {
                let bestDistance = Number.POSITIVE_INFINITY;
                weeklyGroups.forEach((group, index) => {
                    const startDistance = Math.abs(new Date(`${dailyDate}T12:00:00`).getTime() - new Date(`${group.weeklyStart}T12:00:00`).getTime());
                    const endDistance = Math.abs(new Date(`${dailyDate}T12:00:00`).getTime() - new Date(`${group.weeklyEnd}T12:00:00`).getTime());
                    const distance = Math.min(startDistance, endDistance);
                    if (distance < bestDistance) {
                        bestDistance = distance;
                        targetIndex = index;
                    }
                });
            }

            if (targetIndex >= 0) {
                weeklyGroups[targetIndex].children.push(dailyPlan);
            } else {
                standaloneDailyPlans.push(dailyPlan);
            }
        });

        weeklyGroups.forEach(group => {
            group.children.sort((a, b) => new Date(b.planDate || b.createdAt || 0) - new Date(a.planDate || a.createdAt || 0));
        });

        return { weeklyGroups, standaloneDailyPlans };
    }, [filteredPlans]);

    const stats = useMemo(() => {
        const total = filteredPlans.length;
        const daily = filteredPlans.filter(plan => plan.scope === 'Daily').length;
        const weekly = filteredPlans.filter(plan => plan.scope === 'Weekly').length;
        const active = filteredPlans.filter(plan => plan.status === 'Active').length;
        return { total, daily, weekly, active };
    }, [filteredPlans]);

    const setting = useMemo(() => resolveSetting(selectedAccount), [selectedAccount]);
    const closedSummary = useMemo(() => summarizeClosedTrades(trades), [trades]);
    const currentBalance = useMemo(() => {
        if (!selectedAccount) return null;

        const baseBalance = toNumber(selectedAccount.initial_balance, 0);
        const totalTradePnl = (trades || []).reduce((sum, trade) => {
            const symbolId = trade.symbol?.documentId || trade.symbol?.id;
            const currentPrice = symbolId ? marketPricesMap[symbolId] : null;
            const tradeStatus = trade.trade_status || 'Open';

            if (tradeStatus === 'Closed') {
                return sum + toNumber(trade.pnl, calculateTradePnL(trade));
            }

            if (currentPrice !== null && currentPrice !== undefined && currentPrice !== '') {
                return sum + calculateTradePnL(trade, currentPrice);
            }

            return sum + toNumber(trade.pnl, 0);
        }, 0);

        return baseBalance + totalTradePnl;
    }, [marketPricesMap, selectedAccount, trades]);

    const roadmapSummary = useMemo(() => {
        if (!processedRoadmap) return null;

        const startingBalance = toNumber(processedRoadmap.startingBalance ?? processedRoadmap.snapshot?.startingBalance, 0);
        const targetGrowthPercent = toNumber(processedRoadmap.targetGrowthPercent ?? processedRoadmap.snapshot?.targetGrowthPercent, 0);
        const plannedTrades = Math.max(Math.floor(toNumber(processedRoadmap.plannedTrades ?? processedRoadmap.snapshot?.plannedTrades, 0)), 0);
        const riskPercent = toNumber(setting?.riskPerTrade, toNumber(processedRoadmap.riskPercent ?? processedRoadmap.snapshot?.riskPercent, 0));
        const rewardMultiple = closedSummary.rewardMultiple > 0
            ? closedSummary.rewardMultiple
            : toNumber(processedRoadmap.rewardMultiple ?? processedRoadmap.snapshot?.rewardMultiple, 0);
        const winRateEstimate = closedSummary.winRate > 0
            ? closedSummary.winRate
            : toNumber(processedRoadmap.winRateEstimate ?? processedRoadmap.snapshot?.winRateEstimate, 0);
        const maxDrawDownPercent = toNumber(setting?.maxDrawDown, toNumber(processedRoadmap.maxDrawDownPercent ?? processedRoadmap.snapshot?.maxDrawDownPercent, 0));

        const summary = buildRoadmapProjection({
            startBalance: startingBalance,
            riskPercent,
            targetGrowthPercent,
            rewardMultiple,
            plannedTrades,
            winRateEstimate,
            maxDrawDownPercent
        });

        const processBarPercent = (() => {
            const profitRange = summary.profitTarget;
            if (currentBalance == null || profitRange <= 0) {
                return currentBalance != null && summary.targetBalance > 0 && currentBalance >= summary.targetBalance ? 100 : 0;
            }

            const coverage = ((currentBalance - summary.baseBalance) / profitRange) * 100;
            return Math.max(0, Math.min(100, coverage));
        })();

        const balanceForRisk = currentBalance != null ? currentBalance : summary.baseBalance;
        const riskPerTradeAmount = balanceForRisk * (riskPercent / 100);
        const rewardPerTradeAmount = balanceForRisk * (summary.rewardPct / 100);

        return {
            ...summary,
            startingBalance,
            targetGrowthPercent,
            plannedTrades,
            maxDrawDownPercent,
            processBarPercent,
            riskPerTradeAmount,
            rewardPerTradeAmount,
            accountName: processedRoadmap.snapshot?.accountName || processedRoadmap.account?.name || 'Processed roadmap',
            settingName: processedRoadmap.snapshot?.settingName || processedRoadmap.setting?.Name || processedRoadmap.setting?.name || 'No linked setting'
        };
    }, [closedSummary.rewardMultiple, closedSummary.winRate, currentBalance, processedRoadmap, setting]);

    const weeklyPlanOptions = useMemo(() => {
        return planTree.weeklyGroups.map(({ weeklyPlan }) => ({
            id: weeklyPlan.documentId || weeklyPlan.id,
            title: weeklyPlan.title || 'Untitled plan',
            weekStart: weeklyPlan.weekStart || weeklyPlan.planDate || '',
            weekEnd: weeklyPlan.weekEnd || weeklyPlan.weekStart || weeklyPlan.planDate || ''
        }));
    }, [planTree.weeklyGroups]);

    const planDateQuery = useMemo(() => {
        const params = new URLSearchParams(location.search);
        return getDateValueFromDateLike(params.get('date'));
    }, [location.search]);

    const selectedWeeklyGroup = useMemo(() => {
        if (!planTree.weeklyGroups.length) return null;
        return planTree.weeklyGroups.find(({ weeklyPlan }) => String(weeklyPlan.documentId || weeklyPlan.id) === String(selectedWeekId))
            || planTree.weeklyGroups[0];
    }, [planTree.weeklyGroups, selectedWeekId]);

    useEffect(() => {
        if (!planTree.weeklyGroups.length) {
            setSelectedWeekId('');
            return;
        }

        if (planDateQuery) {
            const queryMatchedWeek = planTree.weeklyGroups.find(({ weeklyStart, weeklyEnd }) =>
                isDateInRange(planDateQuery, weeklyStart, weeklyEnd)
            );

            if (queryMatchedWeek) {
                const nextSelectedWeekId = queryMatchedWeek.weeklyPlan.documentId || queryMatchedWeek.weeklyPlan.id || '';
                if (nextSelectedWeekId && String(nextSelectedWeekId) !== String(selectedWeekId)) {
                    setSelectedWeekId(nextSelectedWeekId);
                }
                return;
            }
        }

        const today = getLocalDateValue();
        const currentWeek = planTree.weeklyGroups.find(({ weeklyStart, weeklyEnd }) =>
            isDateInRange(today, weeklyStart, weeklyEnd)
        );
        const selectedExists = planTree.weeklyGroups.some(({ weeklyPlan }) =>
            String(weeklyPlan.documentId || weeklyPlan.id) === String(selectedWeekId)
        );
        const nextSelectedWeekId = selectedExists
            ? selectedWeekId
            : (currentWeek?.weeklyPlan.documentId || currentWeek?.weeklyPlan.id || planTree.weeklyGroups[0].weeklyPlan.documentId || planTree.weeklyGroups[0].weeklyPlan.id || '');

        if (nextSelectedWeekId !== selectedWeekId) {
            setSelectedWeekId(nextSelectedWeekId);
        }
    }, [planTree.weeklyGroups, selectedWeekId]);

    const currentWeekRange = useMemo(() => {
        const now = new Date();
        const day = now.getDay();
        const mondayOffset = (day + 6) % 7;
        const weekStart = new Date(now);
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(weekStart.getDate() - mondayOffset);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return {
            weekStart: getLocalDateValue(weekStart),
            weekEnd: getLocalDateValue(weekEnd)
        };
    }, []);

    const weeklyTradeRows = useMemo(() => {
        if (!trades) return [];

        return trades.filter(trade => {
            const tradeDateValue = getDateValueFromDateLike(trade.date || trade.createdAt);
            return isDateInRange(tradeDateValue, currentWeekRange.weekStart, currentWeekRange.weekEnd);
        }).map(trade => {
            const details = trade.trade_details || [];
            const sortedDetails = [...details].sort((a, b) => new Date(a.date) - new Date(b.date));
            const firstEntry = sortedDetails.find(detail => detail.signal === 'Entry') || sortedDetails[0];
            const symbolId = trade.symbol?.documentId || trade.symbol?.id;
            const currentPrice = symbolId ? marketPricesMap[symbolId] : null;
            const pnl = calculateTradePnL(trade, currentPrice);

            return {
                ...trade,
                derivedDate: trade.date || firstEntry?.date || trade.createdAt,
                derivedEntryPrice: firstEntry?.price || 0,
                derivedCurrentPrice: currentPrice,
                derivedPnl: pnl
            };
        }).sort((a, b) => new Date(b.derivedDate || 0) - new Date(a.derivedDate || 0));
    }, [trades, marketPricesMap, currentWeekRange.weekStart, currentWeekRange.weekEnd]);

    const tradeDetailsByDate = useMemo(() => {
        const grouped = {};

        (trades || []).forEach(trade => {
            const details = trade.trade_details || [];
            details.forEach((detail, detailIndex) => {
                const detailDateKey = getDateValueFromDateLike(detail.date || trade.date || trade.createdAt);
                if (!detailDateKey) return;

                if (!grouped[detailDateKey]) {
                    grouped[detailDateKey] = [];
                }

                grouped[detailDateKey].push({
                    id: detail.documentId || detail.id || `${trade.documentId || trade.id || 'trade'}-${detailIndex}`,
                    trade,
                    detail,
                    symbolLabel: trade.symbol?.Name || trade.symbol?.name || 'Unknown',
                    noteText: extractTextFromBlocks(detail.note),
                    timeValue: detail.date || trade.date || trade.createdAt
                });
            });
        });

        Object.values(grouped).forEach(rows => {
            rows.sort((a, b) => new Date(a.timeValue || 0) - new Date(b.timeValue || 0));
        });

        return grouped;
    }, [trades]);

    const totalWeeklyPnl = useMemo(() => {
        return weeklyTradeRows.reduce((sum, trade) => sum + (trade.derivedPnl || 0), 0);
    }, [weeklyTradeRows]);

    const toggleBox = (boxName) => {
        setCollapsedBoxes(prev => ({
            ...prev,
            [boxName]: !prev[boxName]
        }));
    };

    const resetForm = () => {
        setForm(buildEmptyForm(selectedAccount, accounts));
        setIsEditing(false);
        setMessage('');
        setError('');
    };

    const handleEdit = (plan) => {
        setIsEditing(true);
        setCollapsedBoxes(prev => ({ ...prev, createPlan: false }));
        setMessage('');
        setError('');
        setForm({
            ...plan,
            id: plan.id ?? null,
            documentId: plan.documentId ?? null,
            accountId: String(plan.accountId || ''),
            maxTrades: Number(plan.maxTrades || 1)
        });
    };

    const handleDelete = async (plan) => {
        const planId = plan.documentId || plan.id;
        if (!planId) return;
        if (!window.confirm(`Delete plan "${plan.title || 'Untitled'}"?`)) return;

        try {
            setSaving(true);
            setMessage('');
            setError('');
            await deletePlan(planId);
            await refreshPlans();
            if (String(form.id || form.documentId) === String(planId)) resetForm();
            setMessage('Plan đã được xóa.');
        } catch (err) {
            console.error('Failed to delete plan:', err);
            setError(err?.response?.data?.error?.message || err?.message || 'Failed to delete plan.');
        } finally {
            setSaving(false);
        }
    };

    const refreshWeeklyTrades = () => {
        if (!selectedAccount) return;
        dispatch(fetchTrades({ accountId: selectedAccount.documentId || selectedAccount.id, pageSize: 1000 }));
    };

    const handleOpenTradeDetail = (trade) => {
        setSelectedTrade(trade);
    };

    const handleEditTrade = (trade) => {
        setSelectedTrade(null);
        setTradeToEdit(trade);
        setIsTradeModalOpen(true);
    };

    const handleCloseTradeModal = () => {
        setIsTradeModalOpen(false);
        setTradeToEdit(null);
    };

    const handleSaveTrade = async (tradeData) => {
        try {
            await dispatch(saveTrade({ tradeData, tradeToEdit })).unwrap();
            refreshWeeklyTrades();
            handleCloseTradeModal();
        } catch (err) {
            console.error('Error saving trade:', err);
            alert(`Failed to save trade: ${err.message || err}`);
        }
    };

    const handleDeleteTrade = async () => {
        if (!tradeToEdit) return;
        const tradeId = tradeToEdit.documentId || tradeToEdit.id;
        if (!window.confirm('Delete this trade and all of its trade details?')) return;

        try {
            await dispatch(deleteTrade({
                tradeId,
                tradeDetails: tradeToEdit.trade_details || []
            })).unwrap();
            refreshWeeklyTrades();
            handleCloseTradeModal();
        } catch (err) {
            console.error('Failed to delete trade:', err);
            alert(`Failed to delete trade: ${err.message || err}`);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setMessage('');
        setError('');

        if (!form.title.trim()) {
            setError('Vui lòng nhập tên plan.');
            return;
        }

        if (!form.accountId) {
            setError('Vui lòng chọn tài khoản.');
            return;
        }

        const accountInfo = getAccountInfo(accounts, form.accountId);
        const payload = {
            accountId: accountInfo.accountId,
            accountName: accountInfo.accountName,
            title: form.title.trim(),
            scope: form.scope,
            planDate: form.scope === 'Daily' ? form.planDate || null : null,
            weekStart: form.scope === 'Weekly' ? form.weekStart || null : null,
            weekEnd: form.scope === 'Weekly' ? form.weekEnd || null : null,
            session: form.session.trim(),
            marketContext: form.marketContext.trim(),
            symbols: form.symbols.trim(),
            entryPlan: form.entryPlan.trim(),
            riskPlan: form.riskPlan.trim(),
            checklist: form.checklist.trim(),
            reviewNotes: form.reviewNotes.trim(),
            status: form.status,
            maxTrades: Number(form.maxTrades || 1)
        };

        try {
            setSaving(true);
            const planId = form.documentId || form.id;
            const savedPlan = planId ? await updatePlan(planId, payload) : await createPlan(payload);
            await refreshPlans();
            setIsEditing(true);
            setForm(prev => ({
                ...prev,
                ...savedPlan,
                id: savedPlan?.id ?? planId ?? null,
                documentId: savedPlan?.documentId ?? form.documentId ?? null,
                maxTrades: Number(savedPlan?.maxTrades ?? payload.maxTrades)
            }));
            setMessage('Plan đã được lưu.');
        } catch (err) {
            console.error('Failed to save plan:', err);
            setError(err?.response?.data?.error?.message || err?.message || 'Failed to save plan.');
        } finally {
            setSaving(false);
        }
    };

    const renderPlanCard = (plan, variant) => {
        const isWeekly = variant === 'weekly';
        const handleCardClick = () => handleEdit(plan);
        const planDateKey = getDateValueFromDateLike(plan.planDate || plan.createdAt);
        const executedDetailRows = isWeekly ? [] : (tradeDetailsByDate[planDateKey] || []);

        return (
            <div
                key={plan.documentId || plan.id}
                className={isWeekly ? 'space-y-3' : 'ml-6 pl-5 border-l border-b border-gray-700/80 last:border-b-0'}
            >
                <div
                    className={clsx(
                        'relative cursor-pointer transition hover:border-blue-500/40',
                        isWeekly
                            ? 'rounded-2xl border border-gray-700 bg-gray-800 overflow-hidden shadow-lg shadow-black/10'
                            : 'rounded-2xl bg-gray-900/70 overflow-visible shadow-md shadow-black/10 -mx-4'
                    )}
                    role="button"
                    tabIndex={0}
                    onClick={handleCardClick}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleCardClick();
                        }
                    }}
                >
                    {isWeekly ? (
                        <div className="p-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold uppercase tracking-wider bg-purple-500/15 text-purple-300 border border-purple-500/20">
                                        Weekly
                                    </span>
                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-900 text-gray-300 border border-gray-700">
                                        {plan.status}
                                    </span>
                                    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                        {plan.accountName}
                                    </span>
                                </div>

                                <div>
                                    <h3 className="text-lg font-bold text-white">{plan.title || 'Untitled plan'}</h3>
                                    <p className="text-xs text-gray-400 mt-1">
                                        {plan.weekStart || '-'} → {plan.weekEnd || '-'}
                                        {plan.session ? ` • ${plan.session}` : ''}
                                    </p>
                                </div>

                                {plan.symbols && (
                                    <div className="flex flex-wrap gap-2">
                                        {plan.symbols.split(',').map(symbol => symbol.trim()).filter(Boolean).map(symbol => (
                                            <span
                                                key={symbol}
                                                className="px-2.5 py-1 rounded-full text-[10px] bg-gray-900 border border-gray-700 text-gray-300"
                                            >
                                                {symbol}
                                            </span>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-wrap gap-2 lg:justify-end">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleEdit(plan);
                                    }}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-200 hover:bg-gray-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <Edit2 size={16} />
                                    Edit
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(plan);
                                    }}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <Trash2 size={16} />
                                    Delete
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="absolute left-[-25px] top-6 w-10 flex flex-col items-center bg-[#101828]">
                                <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-300/80 whitespace-nowrap leading-none">
                                    {getVietnameseWeekdayLabel(plan.planDate)}
                                </div>
                                <div className="relative mt-3 w-3 h-4">
                                    <div className="absolute left-1/2 top-0 -translate-x-1/2 h-3 w-3 rounded-full bg-blue-400 ring-4 ring-blue-400/15" />
                                </div>

                            </div>

                            <div className="p-4 pl-4 flex items-start justify-between gap-4">
                                <div className="min-w-0 space-y-1 pt-0.5">

                                    <h3 className="text-sm font-semibold text-white truncate">
                                        {plan.title || 'Untitled plan'}
                                    </h3>
                                    <div className="mt-1 text-[10px] font-medium text-gray-500 whitespace-nowrap">
                                        {plan.planDate || '-'}
                                    </div>
                                    <p className="text-xs text-gray-400">
                                        {plan.session ? ` • ${plan.session}` : ''}
                                    </p>
                                    {plan.symbols && (
                                        <div className="flex flex-wrap gap-2 pt-1">
                                            {plan.symbols.split(',').map(symbol => symbol.trim()).filter(Boolean).map(symbol => (
                                                <span
                                                    key={symbol}
                                                    className="px-2.5 py-1 rounded-full text-[10px] bg-gray-900 border border-gray-700 text-gray-300"
                                                >
                                                    {symbol}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-green-500/15 text-green-300 border border-green-500/20">
                                        Daily
                                    </span>
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-gray-900 text-gray-300 border border-gray-700">
                                        {plan.status}
                                    </span>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEdit(plan);
                                        }}
                                        disabled={saving}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-200 hover:bg-gray-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <Edit2 size={14} />
                                        Edit
                                    </button>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDelete(plan);
                                        }}
                                        disabled={saving}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-300 hover:bg-red-500/20 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <Trash2 size={14} />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        </>
                    )}

                    {!isWeekly && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-4 pt-0">
                            <div className="p-0">
                                <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Entry</div>
                                <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                                    {plan.entryPlan || 'No entry plan yet.'}
                                </p>
                            </div>
                            <div className="p-0">
                                <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Risk</div>
                                <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                                    {plan.riskPlan || 'No risk plan yet.'}
                                </p>
                            </div>
                            <div className="p-0">
                                <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Checklist / Review</div>
                                <div className="space-y-2 text-xs text-gray-300 leading-relaxed">
                                    <p className="whitespace-pre-wrap">{plan.checklist || 'No checklist yet.'}</p>
                                    <p className="whitespace-pre-wrap">{plan.reviewNotes || 'No review notes yet.'}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isWeekly && executedDetailRows.length > 0 && (
                        <div className="px-4 pb-4">
                            <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-950/50">
                                <div className="flex items-center justify-between border-b border-gray-700 px-3 py-2">
                                    <div className="text-[10px] uppercase tracking-widest text-gray-500">
                                        Executed trade details
                                    </div>
                                    <div className="text-[10px] text-gray-400">
                                        {executedDetailRows.length} rows
                                    </div>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="min-w-full text-left text-[11px]">
                                        <thead className="bg-gray-900/80 text-gray-500 uppercase tracking-wider">
                                            <tr>
                                                <th className="px-3 py-2 font-medium">Time</th>
                                                <th className="px-3 py-2 font-medium">Symbol</th>
                                                <th className="px-3 py-2 font-medium">Signal</th>
                                                <th className="px-3 py-2 font-medium">Type</th>
                                                <th className="px-3 py-2 font-medium">Price</th>
                                                <th className="px-3 py-2 font-medium">Volume</th>
                                                <th className="px-3 py-2 font-medium">Note</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800">
                                            {executedDetailRows.map(row => {
                                                const signalTone = row.detail.signal === 'Entry'
                                                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/20'
                                                    : row.detail.signal === 'Stoploss'
                                                        ? 'bg-red-500/15 text-red-300 border-red-500/20'
                                                        : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20';

                                                return (
                                                    <tr
                                                        key={row.id}
                                                        role="button"
                                                        tabIndex={0}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleOpenTradeDetail(row.trade);
                                                        }}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter' || e.key === ' ') {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleOpenTradeDetail(row.trade);
                                                            }
                                                        }}
                                                        className="cursor-pointer hover:bg-gray-900/60 transition"
                                                    >
                                                        <td className="px-3 py-2 whitespace-nowrap text-gray-300">
                                                            {formatDetailTime(row.timeValue)}
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap font-medium text-gray-100">
                                                            {row.symbolLabel}
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap">
                                                            <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${signalTone}`}>
                                                                {row.detail.signal || '-'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap text-gray-300">
                                                            {row.detail.type || '-'}
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap text-gray-300">
                                                            {formatMoney(row.detail.price, selectedAccount)}
                                                        </td>
                                                        <td className="px-3 py-2 whitespace-nowrap text-gray-300">
                                                            {formatNumber(row.detail.volume, selectedAccount?.moneyFormat || '#,###.##')}
                                                        </td>
                                                        <td className="px-3 py-2 text-gray-400">
                                                            <div className="max-w-[280px] truncate" title={row.noteText || ''}>
                                                                {row.noteText || '-'}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    )}

                    {isWeekly && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 p-5 pt-0">
                            <div className="space-y-3">
                                <div className="rounded-xl bg-gray-900/70 border border-gray-700 p-4">
                                    <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Market context</div>
                                    <p className="text-xs text-gray-300 whitespace-pre-wrap">
                                        {plan.marketContext || 'No market context yet.'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="rounded-xl bg-gray-900/70 border border-gray-700 p-4">
                                    <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Review notes</div>
                                    <p className="text-xs text-gray-300 whitespace-pre-wrap">
                                        {plan.reviewNotes || 'No review notes yet.'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    return (
        <div id="plan" className="p-6 space-y-6">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                        <Activity className="w-6 h-6 text-blue-400" />
                        Journal Plans
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Manage and execute incoming signals</p>
                </div>

                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setIsWeekDropdownOpen(prev => !prev)}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 transition"
                        >
                            <CalendarDays size={16} />
                            {selectedWeeklyGroup
                                ? `${selectedWeeklyGroup.weeklyPlan.title || 'Untitled plan'}`
                                : 'Weeks'}
                            <ChevronDown size={16} className={clsx('transition-transform', isWeekDropdownOpen && 'rotate-180')} />
                        </button>

                        {isWeekDropdownOpen && (
                            <div className="absolute right-0 top-full z-20 mt-2 w-80 overflow-hidden rounded-xl border border-gray-700 bg-gray-900 shadow-2xl shadow-black/30">
                                <div className="border-b border-gray-700 px-4 py-3">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                                        Weeks with plans
                                    </p>
                                </div>
                                <div className="max-h-72 overflow-y-auto py-2">
                                    {weeklyPlanOptions.length === 0 ? (
                                        <div className="px-4 py-3 text-sm text-gray-500">
                                            No weekly plan yet.
                                        </div>
                                    ) : (
                                        weeklyPlanOptions.map(option => (
                                            <button
                                                key={option.id}
                                                type="button"
                                                onClick={() => {
                                                    setSelectedWeekId(option.id);
                                                    setIsWeekDropdownOpen(false);
                                                }}
                                                className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left hover:bg-gray-800 transition"
                                            >
                                                <span className="text-sm font-medium text-gray-100">
                                                    {option.title}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {option.weekStart || '-'} → {option.weekEnd || '-'}
                                                </span>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {error && (
                <div className="rounded-xl px-4 py-3 text-sm border border-red-500/30 bg-red-500/10 text-red-200">
                    {error}
                </div>
            )}

            <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 shadow-xl shadow-black/20">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-3 lg:flex-[0.8] lg:max-w-2xl">
                        <div className="flex items-center gap-2">
                            <Target size={18} className="text-emerald-400" />
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-300">Processed Roadmap</p>
                            {roadmapSummary ? (
                                <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                                    Process
                                </span>
                            ) : (
                                <span className="rounded-full border border-gray-600 bg-gray-700/50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                                    Waiting
                                </span>
                            )}
                        </div>

                        <div>
                            <h2 className="balance text-xl font-black text-white xl:text-2xl">
                                {currentBalance === null
                                    ? '-'
                                    : formatMoney(currentBalance, selectedAccount)}
                            </h2>
                            <p className="mt-1.5 max-w-2xl text-xs text-gray-400 xl:text-sm">
                                {roadmapSummary
                                    ? roadmapSummary.accountName + ' ? +' + roadmapSummary.targetGrowthPercent.toFixed(2) + '%'
                                    : 'No processed roadmap for this account'}
                            </p>
                        </div>

                        {roadmapSummary ? (
                            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                                <MiniMetric label="Target NAV" value={formatMoney(roadmapSummary.targetBalance, selectedAccount)} />
                                <MiniMetric label="Profit needed" value={formatMoney(roadmapSummary.profitTarget, selectedAccount)} />
                                <MiniMetric label="Risk / trade" value={formatMoney(roadmapSummary.riskPerTradeAmount, selectedAccount)} />
                                <MiniMetric label="Reward / trade" value={formatMoney(roadmapSummary.rewardPerTradeAmount, selectedAccount)} />
                            </div>
                        ) : null}
                    </div>

                    <div className="w-full rounded-2xl border border-gray-700 bg-gray-900/70 p-3 lg:flex-[1.2] lg:max-w-none">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-gray-500">Process Bar</p>
                                <h3 className="text-lg font-bold text-white">Roadmap coverage</h3>
                            </div>
                            <div className="text-right">
                                <p className="text-xs uppercase tracking-wider text-gray-500">Coverage</p>
                                <p className="text-xl font-black text-emerald-400">
                                    {roadmapSummary ? roadmapSummary.processBarPercent.toFixed(1) + '%' : '0.0%'}
                                </p>
                            </div>
                        </div>

                        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-gray-700">
                            <div
                                className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-blue-400 to-cyan-400 transition-all duration-500"
                                style={{ width: (roadmapSummary ? roadmapSummary.processBarPercent : 0) + '%' }}
                            />
                        </div>

                        {roadmapSummary ? (
                            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                                <div className="rounded-xl border border-gray-700 bg-gray-800/80 p-2.5">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Estimated Trades</p>
                                    <p className="mt-1 font-semibold text-white">{roadmapSummary.estimatedTradesToGoal || 'N/A'}</p>
                                </div>
                                <div className="rounded-xl border border-gray-700 bg-gray-800/80 p-2.5">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Wins in Plan</p>
                                    <p className="mt-1 font-semibold text-white">{roadmapSummary.winsNeededInPlannedTrades ?? 'N/A'}</p>
                                </div>
                                <div className="rounded-xl border border-gray-700 bg-gray-800/80 p-2.5">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Equity if all wins</p>
                                    <p className="mt-1 font-semibold text-white">{formatMoney(roadmapSummary.equityAfterPlannedTradesIfAllWins, selectedAccount)}</p>
                                </div>
                                <div className="rounded-xl border border-gray-700 bg-gray-800/80 p-2.5">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Loss Budget</p>
                                    <p className="mt-1 font-semibold text-white">{formatMoney(roadmapSummary.lossBudget, selectedAccount)}</p>
                                </div>
                                <div className="rounded-xl border border-gray-700 bg-gray-800/80 p-2.5">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Max Drawdown</p>
                                    <p className="mt-1 font-semibold text-white">{roadmapSummary.maxDrawDownPercent.toFixed(2)}%</p>
                                </div>
                                <div className="rounded-xl border border-gray-700 bg-gray-800/80 p-2.5">
                                    <p className="text-[10px] uppercase tracking-wider text-gray-500">Current Win Rate</p>
                                    <p className="mt-1 font-semibold text-white">{roadmapSummary.winRateEstimate.toFixed(1)}%</p>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-4 rounded-xl border border-dashed border-gray-700 bg-gray-800/40 p-4 text-sm text-gray-500">
                                No processed roadmap yet. Choose one in Roadmap to surface it here.
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-gray-700 bg-gray-800/80 p-4">
                    <div className="flex items-center gap-3 text-gray-400">
                        <ListChecks size={18} />
                        <span className="text-xs font-medium">Total Plans</span>
                    </div>
                    <div className="mt-3 text-2xl font-bold text-white">{stats.total}</div>
                </div>
                <div className="rounded-2xl border border-gray-700 bg-gray-800/80 p-4">
                    <div className="flex items-center gap-3 text-gray-400">
                        <Calendar size={18} />
                        <span className="text-xs font-medium">Daily</span>
                    </div>
                    <div className="mt-3 text-2xl font-bold text-white">{stats.daily}</div>
                </div>
                <div className="rounded-2xl border border-gray-700 bg-gray-800/80 p-4">
                    <div className="flex items-center gap-3 text-gray-400">
                        <CalendarDays size={18} />
                        <span className="text-xs font-medium">Weekly</span>
                    </div>
                    <div className="mt-3 text-2xl font-bold text-white">{stats.weekly}</div>
                </div>
                <div className="rounded-2xl border border-gray-700 bg-gray-800/80 p-4">
                    <div className="flex items-center gap-3 text-gray-400">
                        <TrendingUp size={18} />
                        <span className="text-xs font-medium">Active</span>
                    </div>
                    <div className="mt-3 text-2xl font-bold text-white">{stats.active}</div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
                <div className="xl:col-span-2 space-y-4">
                    <div className="rounded-2xl border border-gray-700 bg-gray-800 p-4">
                        <div className={clsx('flex items-start justify-between gap-3', !collapsedBoxes.openTrades && 'mb-3')}>
                            <div>
                                <h2 className="text-base font-bold text-white">Trades This Week</h2>
                                <p className="text-xs text-gray-400 mt-1">
                                    Trades from this week for the current account.
                                </p>
                            </div>
                            <div className="flex shrink-0 items-center gap-2">
                                <div className={clsx(
                                    'text-right font-mono text-sm font-bold',
                                    totalWeeklyPnl >= 0 ? 'text-green-400' : 'text-red-400'
                                )}>
                                    {formatNumber(totalWeeklyPnl)} USD
                                </div>
                                <button
                                    type="button"
                                    onClick={() => toggleBox('openTrades')}
                                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition"
                                    aria-label={collapsedBoxes.openTrades ? 'Expand weekly trades' : 'Collapse weekly trades'}
                                >
                                    <ChevronDown
                                        size={16}
                                        className={clsx('transition-transform', collapsedBoxes.openTrades && '-rotate-90')}
                                    />
                                </button>
                            </div>
                        </div>

                        {!collapsedBoxes.openTrades && (
                            tradesLoading ? (
                                <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-5 text-center text-sm text-gray-400">
                                    Loading weekly trades...
                                </div>
                            ) : weeklyTradeRows.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-gray-700 bg-gray-900/50 p-5 text-center text-sm text-gray-500">
                                    No trades in the current week.
                                </div>
                            ) : (
                                <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-700">
                                    <table className="w-full table-fixed text-xs">
                                        <thead className="sticky top-0 z-10 bg-gray-900 text-[10px] uppercase tracking-wider text-gray-500">
                                            <tr>
                                                <th className="w-[30%] px-3 py-2 text-left font-semibold">Symbol</th>
                                                <th className="w-[15%] px-2 py-2 text-left font-semibold">Side</th>
                                                <th className="w-[22%] px-2 py-2 text-right font-semibold">Current</th>
                                                <th className="w-[33%] px-3 py-2 text-right font-semibold">PnL</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-700/80 bg-gray-900/35">
                                            {weeklyTradeRows.map(trade => {
                                                const isClosedTrade = trade.trade_status === 'Closed';

                                                return (
                                                    <tr
                                                        key={trade.documentId || trade.id}
                                                        onClick={() => handleOpenTradeDetail(trade)}
                                                        className={clsx(
                                                            'cursor-pointer transition',
                                                            isClosedTrade
                                                                ? 'bg-gray-900/45 hover:bg-gray-800/60'
                                                                : 'hover:bg-gray-900/70'
                                                        )}
                                                    >
                                                        <td className="px-3 py-2">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <span className={clsx(
                                                                    'h-2 w-2 shrink-0 rounded-full',
                                                                    trade.type === 'Long' ? 'bg-green-400' : 'bg-red-400'
                                                                )} />
                                                                <div className="min-w-0">
                                                                    <div className={clsx(
                                                                        'truncate font-semibold',
                                                                        isClosedTrade ? 'text-gray-400' : 'text-gray-100'
                                                                    )}>
                                                                        {trade.symbol?.Name || trade.symbol?.name || 'Unknown'}
                                                                    </div>
                                                                    <div className={clsx(
                                                                        'text-[10px]',
                                                                        isClosedTrade ? 'text-gray-600' : 'text-gray-500'
                                                                    )}>
                                                                        {trade.derivedDate
                                                                            ? new Date(trade.derivedDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
                                                                            : '-'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className={clsx('px-2 py-2', isClosedTrade ? 'text-gray-500' : 'text-gray-300')}>
                                                            {trade.type || '-'}
                                                        </td>
                                                        <td className={clsx('px-2 py-2 text-right font-mono', isClosedTrade ? 'text-gray-500' : 'text-gray-200')}>
                                                            {formatNumber(trade.derivedCurrentPrice)}
                                                        </td>
                                                        <td className={clsx(
                                                            'px-3 py-2 text-right font-mono font-bold',
                                                            isClosedTrade
                                                                ? 'text-gray-400'
                                                                : (trade.derivedPnl >= 0 ? 'text-green-400' : 'text-red-400')
                                                        )}>
                                                            {formatNumber(trade.derivedPnl)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )
                        )}
                    </div>

                    <div className="rounded-2xl border border-gray-700 bg-gray-800 p-4">
                        <div className="flex items-center justify-between gap-3">
                            <h2 className="whitespace-nowrap text-lg font-bold text-white">{isEditing ? 'Edit Plan' : 'Create Plan'}</h2>
                            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-xs font-medium text-gray-200 transition hover:bg-gray-700 hover:text-white"
                                >
                                    <Plus size={14} />
                                    New Plan
                                </button>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="inline-flex items-center gap-1.5 rounded-md border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-medium text-gray-300 transition hover:bg-gray-800 hover:text-white"
                                >
                                    Reset
                                </button>
                                <button
                                    type="submit"
                                    form="plan-form"
                                    disabled={saving}
                                    className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    <Save size={14} />
                                    {saving ? 'Saving...' : (isEditing ? 'Update Plan' : 'Save Plan')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => toggleBox('createPlan')}
                                    className="rounded-md p-1.5 text-gray-400 transition hover:bg-gray-700 hover:text-white"
                                    aria-label={collapsedBoxes.createPlan ? 'Expand create plan' : 'Collapse create plan'}
                                >
                                    <ChevronDown
                                        size={15}
                                        className={clsx('transition-transform', collapsedBoxes.createPlan && '-rotate-90')}
                                    />
                                </button>
                            </div>
                        </div>
                        <p className="create-plan-desc mt-2 mb-4 text-xs text-gray-400">
                            Gợi ý form: bối cảnh, setup, rủi ro, checklist, và review sau phiên.
                        </p>

                        {!collapsedBoxes.createPlan && (
                            <form id="plan-form" className="max-h-[68vh] space-y-4 overflow-y-auto pr-1" onSubmit={handleSubmit}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="space-y-2">
                                        <span className="text-xs font-medium text-gray-300">Account</span>
                                        <select
                                            value={form.accountId}
                                            onChange={(e) => {
                                                const accountId = e.target.value;
                                                const accountInfo = getAccountInfo(accounts, accountId);
                                                setForm(prev => ({ ...prev, accountId, accountName: accountInfo.accountName }));
                                            }}
                                            className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500"
                                        >
                                            <option value="">Select account</option>
                                            {accounts.map(account => (
                                                <option key={account.id || account.documentId} value={String(account.id || account.documentId)}>
                                                    {account.name || account.currency || `Account ${account.id || account.documentId}`}
                                                </option>
                                            ))}
                                        </select>
                                    </label>

                                    <label className="space-y-2">
                                        <span className="text-xs font-medium text-gray-300">Scope</span>
                                        <select
                                            value={form.scope}
                                            onChange={(e) => {
                                                const scope = e.target.value;
                                                setForm(prev => ({
                                                    ...prev,
                                                    scope,
                                                    weekEnd: scope === 'Weekly' ? addDaysToDateValue(prev.weekStart, 6) : prev.weekEnd
                                                }));
                                            }}
                                            className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500"
                                        >
                                            <option value="Daily">Daily</option>
                                            <option value="Weekly">Weekly</option>
                                        </select>
                                    </label>
                                </div>

                                <label className="space-y-2 block">
                                    <span className="text-xs font-medium text-gray-300">Plan title</span>
                                    <input
                                        value={form.title}
                                        onChange={(e) => setForm(prev => ({ ...prev, title: e.target.value }))}
                                        placeholder="Example: Breakout setup for VN30 futures"
                                        className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500"
                                    />
                                </label>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {form.scope === 'Daily' ? (
                                        <label className="space-y-2">
                                            <span className="text-xs font-medium text-gray-300">Plan date</span>
                                            <input
                                                type="date"
                                                value={form.planDate}
                                                onChange={(e) => setForm(prev => ({ ...prev, planDate: e.target.value }))}
                                                className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500"
                                            />
                                        </label>
                                    ) : (
                                        <>
                                            <label className="space-y-2">
                                                <span className="text-xs font-medium text-gray-300">Week start</span>
                                                <input
                                                    type="date"
                                                    value={form.weekStart}
                                                    onChange={(e) => setForm(prev => ({
                                                        ...prev,
                                                        weekStart: e.target.value,
                                                        weekEnd: addDaysToDateValue(e.target.value, 6)
                                                    }))}
                                                    className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500"
                                                />
                                            </label>
                                            <label className="space-y-2">
                                                <span className="text-xs font-medium text-gray-300">Week end</span>
                                                <input
                                                    type="date"
                                                    value={form.weekEnd}
                                                    onChange={(e) => setForm(prev => ({ ...prev, weekEnd: e.target.value }))}
                                                    className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500"
                                                />
                                            </label>
                                        </>
                                    )}

                                    <label className="space-y-2">
                                        <span className="text-xs font-medium text-gray-300">Session / frame</span>
                                        <input
                                            value={form.session}
                                            onChange={(e) => setForm(prev => ({ ...prev, session: e.target.value }))}
                                            placeholder="Morning, Afternoon, London, NY..."
                                            className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500"
                                        />
                                    </label>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="space-y-2">
                                        <span className="text-xs font-medium text-gray-300">Max trades</span>
                                        <input
                                            type="number"
                                            min="1"
                                            value={form.maxTrades}
                                            onChange={(e) => setForm(prev => ({ ...prev, maxTrades: e.target.value }))}
                                            className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500"
                                        />
                                    </label>

                                    <label className="space-y-2">
                                        <span className="text-xs font-medium text-gray-300">Status</span>
                                        <select
                                            value={form.status}
                                            onChange={(e) => setForm(prev => ({ ...prev, status: e.target.value }))}
                                            className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500"
                                        >
                                            <option value="Draft">Draft</option>
                                            <option value="Active">Active</option>
                                            <option value="Done">Done</option>
                                            <option value="Skipped">Skipped</option>
                                        </select>
                                    </label>
                                </div>

                                <label className="space-y-2 block">
                                    <span className="text-xs font-medium text-gray-300">Symbols / watchlist</span>
                                    <input
                                        value={form.symbols}
                                        onChange={(e) => setForm(prev => ({ ...prev, symbols: e.target.value }))}
                                        placeholder="FPT, SSI, VN30, BTC..."
                                        className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500"
                                    />
                                </label>

                                <label className="space-y-2 block">
                                    <span className="text-xs font-medium text-gray-300">Market context</span>
                                    <textarea
                                        rows="3"
                                        value={form.marketContext}
                                        onChange={(e) => setForm(prev => ({ ...prev, marketContext: e.target.value }))}
                                        placeholder="Xu hướng thị trường, catalyst, vùng giá quan trọng, lưu ý tin tức..."
                                        className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500 resize-y"
                                    />
                                </label>

                                <label className="space-y-2 block">
                                    <span className="text-xs font-medium text-gray-300">Entry plan</span>
                                    <textarea
                                        rows="3"
                                        value={form.entryPlan}
                                        onChange={(e) => setForm(prev => ({ ...prev, entryPlan: e.target.value }))}
                                        placeholder="Điều kiện vào lệnh, tín hiệu xác nhận, khi nào bỏ qua setup..."
                                        className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500 resize-y"
                                    />
                                </label>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <label className="space-y-2 block">
                                        <span className="text-xs font-medium text-gray-300">Risk plan</span>
                                        <textarea
                                            rows="4"
                                            value={form.riskPlan}
                                            onChange={(e) => setForm(prev => ({ ...prev, riskPlan: e.target.value }))}
                                            placeholder="Risk/trade, max loss, stop loss, sizing, số lệnh tối đa..."
                                            className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500 resize-y"
                                        />
                                    </label>

                                    <label className="space-y-2 block">
                                        <span className="text-xs font-medium text-gray-300">Checklist</span>
                                        <textarea
                                            rows="4"
                                            value={form.checklist}
                                            onChange={(e) => setForm(prev => ({ ...prev, checklist: e.target.value }))}
                                            placeholder="News cleared, trend confirmed, liquidity ok, not overtrading..."
                                            className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500 resize-y"
                                        />
                                    </label>
                                </div>

                                <label className="space-y-2 block">
                                    <span className="text-xs font-medium text-gray-300">Review notes</span>
                                    <textarea
                                        rows="4"
                                        value={form.reviewNotes}
                                        onChange={(e) => setForm(prev => ({ ...prev, reviewNotes: e.target.value }))}
                                        placeholder="Sau khi kết thúc ngày/tuần: what worked, what failed, lesson learned..."
                                        className="w-full rounded-lg bg-gray-900 border border-gray-700 px-3 py-2.5 text-gray-100 outline-none focus:border-blue-500 resize-y"
                                    />
                                </label>

                            </form>
                        )}
                    </div>

                    <div className="rounded-2xl border border-gray-700 bg-gray-800 p-4">
                        <div className={clsx('flex items-center justify-between gap-3', !collapsedBoxes.formGuide && 'mb-3')}>
                            <div className="flex items-center gap-2 text-gray-200 font-semibold text-sm">
                                <CheckSquare size={18} />
                                Form gợi ý
                            </div>
                            <button
                                type="button"
                                onClick={() => toggleBox('formGuide')}
                                className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition"
                                aria-label={collapsedBoxes.formGuide ? 'Expand form guide' : 'Collapse form guide'}
                            >
                                <ChevronDown
                                    size={16}
                                    className={clsx('transition-transform', collapsedBoxes.formGuide && '-rotate-90')}
                                />
                            </button>
                        </div>
                        {!collapsedBoxes.formGuide && (
                            <div className="space-y-3 text-xs text-gray-400">
                                <p>
                                    <span className="text-gray-200 font-medium">1. Bối cảnh:</span> xu hướng, tin tức, vùng giá, và lý do chọn setup.
                                </p>
                                <p>
                                    <span className="text-gray-200 font-medium">2. Entry / Exit:</span> điều kiện vào lệnh, điểm invalidation, và khi nào không trade.
                                </p>
                                <p>
                                    <span className="text-gray-200 font-medium">3. Risk:</span> % rủi ro, số lệnh tối đa, giới hạn lỗ/ngày, và position sizing.
                                </p>
                                <p>
                                    <span className="text-gray-200 font-medium">4. Review:</span> sau phiên ghi lại sai sót, bài học, và điều chỉnh cho ngày/tuần tiếp theo.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="xl:col-span-3 space-y-4">
                    {loadingPlans ? (
                        <div className="rounded-2xl border border-gray-700 bg-gray-800/40 p-10 text-center text-gray-400">
                            Loading plans...
                        </div>
                    ) : filteredPlans.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-800/40 p-10 text-center text-gray-400">
                            Chưa có plan cho tài khoản này. Hãy tạo plan đầu tiên ở form bên trái.
                        </div>
                    ) : !selectedWeeklyGroup ? (
                        <div className="rounded-2xl border border-dashed border-gray-700 bg-gray-800/40 p-10 text-center text-gray-400">
                            No weekly plan available for the selected account.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div
                                id={`weekly-plan-${selectedWeeklyGroup.weeklyPlan.documentId || selectedWeeklyGroup.weeklyPlan.id}`}
                                className="space-y-3"
                            >
                                {renderPlanCard(selectedWeeklyGroup.weeklyPlan, 'weekly')}
                            </div>
                            <div id="daily-plans">
                                {selectedWeeklyGroup.children.map(dailyPlan => renderPlanCard(dailyPlan, 'daily'))}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <TradeDetailModal
                isOpen={!!selectedTrade}
                onClose={() => setSelectedTrade(null)}
                trade={selectedTrade}
                onEdit={handleEditTrade}
            />

            <TradeModal
                isOpen={isTradeModalOpen}
                onClose={handleCloseTradeModal}
                onSubmit={handleSaveTrade}
                onDelete={handleDeleteTrade}
                initialData={tradeToEdit}
            />

            {message && (
                <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-10 fade-in duration-300">
                    <div className="flex items-center gap-3 px-5 py-4 bg-gray-900 border border-green-500/50 rounded-2xl shadow-2xl shadow-green-500/10 backdrop-blur-xl">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle2 size={20} className="text-green-500" />
                        </div>
                        <div className="min-w-[200px]">
                            <p className="text-sm font-bold text-gray-100">{message}</p>
                        </div>
                        <button
                            onClick={() => setMessage('')}
                            className="p-1 hover:bg-gray-800 rounded-lg transition-colors text-gray-500"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

const MiniMetric = ({ label, value }) => (
    <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-500">{label}</p>
        <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
);

export default Plan;
