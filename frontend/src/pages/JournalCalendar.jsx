import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import clsx from 'clsx';
import { Calendar, ChevronLeft, ChevronRight, Wallet, TrendingUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '../context/AccountContext';
import { fetchTrades } from '../features/tradeSlice';
import { calculateTradePnL } from '../utils/tradeCalculations';
import { formatNumber } from '../utils/formatNumber';

const getLocalDateValue = (date = new Date()) => {
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    const offset = d.getTimezoneOffset();
    return new Date(d.getTime() - offset * 60000).toISOString().slice(0, 10);
};

const formatMoney = (value, currency = 'USD', pattern = '#,###.##') => {
    const formatted = formatNumber(value, pattern);
    if (formatted === '-') return '-';
    return currency ? `${formatted} ${currency}` : formatted;
};

const formatMonthLabel = (date) =>
    new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);

const getMonthStart = (date) => new Date(date.getFullYear(), date.getMonth(), 1);
const getMonthEnd = (date) => new Date(date.getFullYear(), date.getMonth() + 1, 0);
const addMonths = (date, delta) => new Date(date.getFullYear(), date.getMonth() + delta, 1);

const startOfWeekMonday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const endOfWeekSunday = (date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = day === 0 ? 0 : 7 - day;
    d.setDate(d.getDate() + diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const sameDay = (a, b) => a && b && a === b;
const isZeroPnl = (value) => Number(value) === 0;
const CLOSING_SIGNALS = new Set(['Exit', 'TakeProfit', 'Stoploss']);

const getTradeSymbolLabel = (trade) => {
    const symbol = trade.symbol || {};
    return (
        symbol.ticker ||
        symbol.symbol ||
        symbol.code ||
        symbol.Name ||
        symbol.name ||
        symbol.label ||
        'Unknown'
    );
};

const formatTradeVolume = (volume) => {
    const parsed = Number(volume);
    if (Number.isNaN(parsed)) return String(volume ?? '');
    return formatNumber(parsed, '#,###.##');
};

const getTradeActivityParts = (detail, trade) => {
    const action = detail.type || detail.signal || 'Trade';
    const symbolLabel = getTradeSymbolLabel(trade);
    const volumeLabel = formatTradeVolume(detail.volume);
    return { action, symbolLabel, volumeLabel };
};

const getTradeActivityTone = (detail) => {
    const type = String(detail.type || '').toLowerCase();
    const signal = String(detail.signal || '').toLowerCase();

    if (type === 'buy' || signal === 'entry') {
        return 'border-emerald-500/20 bg-emerald-500/15 text-emerald-300';
    }

    if (type === 'sell' || signal === 'exit') {
        return 'border-rose-500/20 bg-rose-500/15 text-rose-300';
    }

    if (signal === 'takeprofit') {
        return 'border-amber-500/20 bg-amber-500/15 text-amber-300';
    }

    if (signal === 'stoploss') {
        return 'border-red-500/20 bg-red-500/15 text-red-300';
    }

    return 'border-sky-500/20 bg-sky-500/15 text-sky-300';
};

const getTradeEntryDate = (item) => {
    const details = item.trade_details || [];
    const sortedDetails = [...details].sort((a, b) => new Date(a.date) - new Date(b.date));
    const firstEntry = sortedDetails.find(d => d.signal === 'Entry') || sortedDetails[0];

    return firstEntry?.date || item.date || item.createdAt;
};

const getTradeDerivedDate = (item) => {
    const details = item.trade_details || [];
    const sortedDetails = [...details].sort((a, b) => new Date(a.date) - new Date(b.date));

    if (item.trade_status === 'Closed') {
        const closingDetail = [...sortedDetails]
            .reverse()
            .find(d => CLOSING_SIGNALS.has(d.signal));

        return closingDetail?.date || sortedDetails.at(-1)?.date || item.date || item.createdAt;
    }

    const firstEntry = sortedDetails.find(d => d.signal === 'Entry') || sortedDetails[0];
    return item.date || firstEntry?.date || item.createdAt;
};

const JournalCalendar = () => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { selectedAccount } = useAccount();
    const { items: rawTrades, loading } = useSelector(state => state.trades);
    const [selectedMonthDate, setSelectedMonthDate] = useState(() => new Date());
    const [selectedDate, setSelectedDate] = useState(getLocalDateValue());

    useEffect(() => {
        if (!selectedAccount) return;
        const accountId = selectedAccount.documentId || selectedAccount.id;
        dispatch(fetchTrades({ accountId, pageSize: 1000 }));
    }, [dispatch, selectedAccount]);

    const trades = useMemo(() => {
        if (!rawTrades) return [];

        return rawTrades
            .filter(item => item.trade_status === 'Closed')
            .map(item => {
            const pnl = calculateTradePnL(item);

            return {
                id: item.id || item.documentId,
                ...item,
                derivedDate: getTradeDerivedDate(item),
                derivedPnl: pnl
            };
            });
    }, [rawTrades]);

    const entryTradeCounts = useMemo(() => {
        const map = new Map();

        if (!rawTrades) return map;

        rawTrades.forEach(item => {
            const dateKey = getLocalDateValue(getTradeEntryDate(item));
            if (!dateKey) return;

            map.set(dateKey, (map.get(dateKey) || 0) + 1);
        });

        return map;
    }, [rawTrades]);

    const tradeActivitiesByDay = useMemo(() => {
        const map = new Map();

        if (!rawTrades) return map;

        rawTrades.forEach(trade => {
            (trade.trade_details || []).forEach(detail => {
                const dateKey = getLocalDateValue(detail.date);
                if (!dateKey) return;

                const current = map.get(dateKey) || [];
                current.push({
                    id: detail.documentId || detail.id || `${trade.id || trade.documentId}-${detail.date}-${detail.type}-${detail.volume}`,
                    parts: getTradeActivityParts(detail, trade),
                    tone: getTradeActivityTone(detail),
                    sortValue: new Date(detail.date).getTime() || 0
                });
                map.set(dateKey, current);
            });
        });

        map.forEach((items, key) => {
            map.set(key, items.sort((a, b) => a.sortValue - b.sortValue));
        });

        return map;
    }, [rawTrades]);

    const accountBaseBalance = useMemo(() => {
        return Number.parseFloat(selectedAccount?.initial_balance) || 0;
    }, [selectedAccount]);

    const dailyStats = useMemo(() => {
        const map = new Map();

        trades.forEach(trade => {
            const dateKey = getLocalDateValue(trade.derivedDate);
            if (!dateKey) return;

            const current = map.get(dateKey) || { pnl: 0, count: 0 };
            current.pnl += Number(trade.derivedPnl) || 0;
            current.count += 1;
            map.set(dateKey, current);
        });

        return map;
    }, [trades]);

    const overallPnl = useMemo(() => {
        return trades.reduce((sum, trade) => sum + (Number(trade.derivedPnl) || 0), 0);
    }, [trades]);

    const calendarRange = useMemo(() => {
        const monthStart = getMonthStart(selectedMonthDate);
        const monthEnd = getMonthEnd(selectedMonthDate);
        const gridStart = startOfWeekMonday(monthStart);
        const gridEnd = endOfWeekSunday(monthEnd);
        return { monthStart, monthEnd, gridStart, gridEnd };
    }, [selectedMonthDate]);

    const calendarDays = useMemo(() => {
        const days = [];
        const cursor = new Date(calendarRange.gridStart);
        cursor.setHours(0, 0, 0, 0);
        const end = new Date(calendarRange.gridEnd);
        end.setHours(0, 0, 0, 0);

        let cumulativePnl = 0;
        const navMap = new Map();

        while (cursor <= end) {
            const key = getLocalDateValue(cursor);
            const dayStats = dailyStats.get(key) || { pnl: 0, count: 0 };
            cumulativePnl += dayStats.pnl;
            const nav = accountBaseBalance + cumulativePnl;

            navMap.set(key, nav);
            days.push({
                dateKey: key,
                date: new Date(cursor),
                dayStats,
                nav
            });

            cursor.setDate(cursor.getDate() + 1);
        }

        return { days, navMap };
    }, [accountBaseBalance, calendarRange.gridEnd, calendarRange.gridStart, dailyStats]);

    const currentNav = useMemo(() => accountBaseBalance + overallPnl, [accountBaseBalance, overallPnl]);

    const selectedDayData = useMemo(() => {
        const nav = calendarDays.navMap.get(selectedDate);
        const stats = dailyStats.get(selectedDate) || { pnl: 0, count: 0 };
        const entryCount = entryTradeCounts.get(selectedDate) || 0;
        const tradeCount = stats.count > 0 ? stats.count : entryCount;
        return {
            dateKey: selectedDate,
            nav: nav ?? accountBaseBalance,
            pnl: stats.pnl,
            count: tradeCount
        };
    }, [accountBaseBalance, calendarDays.navMap, dailyStats, entryTradeCounts, selectedDate]);

    useEffect(() => {
        const monthKey = `${selectedMonthDate.getFullYear()}-${String(selectedMonthDate.getMonth() + 1).padStart(2, '0')}`;
        if (!selectedDate.startsWith(monthKey)) {
            setSelectedDate(getLocalDateValue(selectedMonthDate));
        }
    }, [selectedDate, selectedMonthDate]);

    const weekdayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

    const monthlyTotals = useMemo(() => {
        let pnl = 0;
        let tradeCount = 0;

        trades.forEach(trade => {
            const key = getLocalDateValue(trade.derivedDate);
            if (!key) return;
            if (key.slice(0, 7) !== `${selectedMonthDate.getFullYear()}-${String(selectedMonthDate.getMonth() + 1).padStart(2, '0')}`) return;
            pnl += Number(trade.derivedPnl) || 0;
            tradeCount += 1;
        });

        return { pnl, tradeCount };
    }, [selectedMonthDate, trades]);

    return (
        <div className="space-y-6">
            <div className="rounded-3xl border border-gray-700 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 shadow-2xl shadow-black/20">
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                    <div className="space-y-3">
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                            <Calendar size={14} />
                            Journal / Calendar
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black text-white">Trading Calendar</h1>
                            <p className="mt-2 max-w-2xl text-gray-400">
                                Track daily PnL and NAV across the month. Each day shows the cumulative balance after that day’s trades.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full xl:w-[520px]">
                        <div className="rounded-2xl border border-gray-700 bg-gray-800/80 p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-wider text-gray-500">Current NAV</p>
                                <Wallet size={16} className="text-blue-400" />
                            </div>
                            <p className="mt-2 text-2xl font-black text-white">
                                {formatMoney(currentNav, selectedAccount?.currency, selectedAccount?.moneyFormat)}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-gray-700 bg-gray-800/80 p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-wider text-gray-500">Month PnL</p>
                                <TrendingUp size={16} className="text-emerald-400" />
                            </div>
                            <p className={clsx(
                                'mt-2 text-2xl font-black',
                                monthlyTotals.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                            )}>
                                {monthlyTotals.pnl >= 0 ? '+' : ''}
                                {formatMoney(monthlyTotals.pnl, selectedAccount?.currency, selectedAccount?.moneyFormat)}
                            </p>
                        </div>
                        <div className="rounded-2xl border border-gray-700 bg-gray-800/80 p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-wider text-gray-500">Trades</p>
                                <Calendar size={16} className="text-purple-400" />
                            </div>
                            <p className="mt-2 text-2xl font-black text-white">{monthlyTotals.tradeCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6">
                <div className="rounded-2xl border border-gray-700 bg-gray-800 p-4 shadow-lg">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between mb-5">
                        <div>
                            <p className="text-xs uppercase tracking-wider text-gray-500">Month View</p>
                            <h2 className="text-2xl font-bold text-white">{formatMonthLabel(selectedMonthDate)}</h2>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => setSelectedMonthDate(prev => addMonths(prev, -1))}
                                className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 transition hover:bg-gray-800"
                            >
                                <ChevronLeft size={16} />
                                Prev
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedMonthDate(new Date())}
                                className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-semibold text-blue-300 transition hover:bg-blue-500/20"
                            >
                                Today
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedMonthDate(prev => addMonths(prev, 1))}
                                className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-200 transition hover:bg-gray-800"
                            >
                                Next
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-2 mb-2 text-center text-[10px] uppercase tracking-[0.2em] text-gray-500">
                        {weekdayLabels.map(label => (
                            <div key={label} className="py-2">{label}</div>
                        ))}
                    </div>

                    {loading ? (
                        <div className="rounded-2xl border border-gray-700 bg-gray-900/60 p-10 text-center text-gray-400">
                            Loading calendar...
                        </div>
                    ) : (
                        <div className="grid grid-cols-7 gap-2">
                            {calendarDays.days.map(day => {
                                const isInMonth = day.date.getMonth() === selectedMonthDate.getMonth();
                                const isToday = sameDay(day.dateKey, getLocalDateValue());
                                const isSelected = sameDay(day.dateKey, selectedDate);
                                const entryCount = entryTradeCounts.get(day.dateKey) || 0;
                                const activityItems = tradeActivitiesByDay.get(day.dateKey) || [];
                                const displayCount = day.dayStats.count > 0 ? day.dayStats.count : entryCount;
                                const hasActivity = displayCount > 0;
                                const pnlIsPositive = day.dayStats.pnl >= 0;

                                return (
                                    <button
                                        key={day.dateKey}
                                        type="button"
                                        onClick={() => {
                                            setSelectedDate(day.dateKey);
                                            navigate(`/journal-plan?date=${day.dateKey}`);
                                        }}
                                        className={clsx(
                                            'min-h-[168px] rounded-2xl border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500/40 cursor-pointer',
                                            isInMonth ? 'bg-gray-900/70 border-gray-700 hover:border-blue-500/40' : 'bg-gray-950/40 border-gray-800 opacity-60',
                                            isSelected && 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10',
                                            isToday && 'ring-1 ring-inset ring-emerald-400/40'
                                        )}
                                    >
                                        <div className="trade-per-day flex items-start justify-between gap-2">
                                            <div className={clsx('text-sm font-bold', isInMonth ? 'text-white' : 'text-gray-500')}>
                                                {day.date.getDate()}
                                            </div>
                                            {hasActivity && (
                                                <span className={clsx(
                                                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                                    pnlIsPositive ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'
                                                )}>
                                                    {displayCount}
                                                </span>
                                            )}
                                        </div>

                                        <div className="mt-3 space-y-2">
                                            {activityItems.length > 0 && (
                                                <div className="space-y-1">
                                                    {activityItems.slice(0, 2).map(item => (
                                                        <p
                                                            key={item.id}
                                                            className={clsx(
                                                                'truncate rounded-lg border px-2 py-1 text-[10px] font-semibold shadow-sm',
                                                                item.tone
                                                            )}
                                                            title={[item.parts.action, item.parts.symbolLabel, item.parts.volumeLabel].filter(Boolean).join(' ')}
                                                        >
                                                            <span>{item.parts.action} </span>
                                                            <strong>{item.parts.symbolLabel}</strong>
                                                            <span> {item.parts.volumeLabel}</span>
                                                        </p>
                                                    ))}
                                                    {activityItems.length > 2 && (
                                                        <p className="px-2 text-[10px] text-gray-500">
                                                            +{activityItems.length - 2} more
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                            {!isZeroPnl(day.dayStats.pnl) && (
                                                <div>
                                                    <p className={clsx(
                                                        'mt-1 text-sm font-semibold font-mono',
                                                        day.dayStats.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                                                    )}>
                                                        {day.dayStats.pnl >= 0 ? '+' : ''}
                                                        {formatMoney(day.dayStats.pnl, selectedAccount?.currency, selectedAccount?.moneyFormat)}
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                <div className="space-y-4">
                    <div className="rounded-2xl border border-gray-700 bg-gray-800 p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-gray-500">Selected Day</p>
                                <h3 className="text-xl font-bold text-white">
                                    {new Intl.DateTimeFormat('en-US', {
                                        weekday: 'long',
                                        month: 'short',
                                        day: 'numeric',
                                        year: 'numeric'
                                    }).format(new Date(`${selectedDate}T12:00:00`))}
                                </h3>
                            </div>
                        </div>

                        <div className="mt-4 space-y-3">
                            {!isZeroPnl(selectedDayData.pnl) && (
                                <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
                                    <p className="text-xs uppercase tracking-wider text-gray-500">Day PnL</p>
                                    <p className={clsx(
                                        'mt-2 text-2xl font-black font-mono',
                                        selectedDayData.pnl >= 0 ? 'text-emerald-400' : 'text-red-400'
                                    )}>
                                        {selectedDayData.pnl >= 0 ? '+' : ''}
                                        {formatMoney(selectedDayData.pnl, selectedAccount?.currency, selectedAccount?.moneyFormat)}
                                    </p>
                                </div>
                            )}
                            <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
                                <p className="text-xs uppercase tracking-wider text-gray-500">NAV</p>
                                <p className="mt-2 text-2xl font-black font-mono text-white">
                                    {formatMoney(selectedDayData.nav, selectedAccount?.currency, selectedAccount?.moneyFormat)}
                                </p>
                            </div>
                            <div className="rounded-xl border border-gray-700 bg-gray-900/70 p-4">
                                <p className="text-xs uppercase tracking-wider text-gray-500">Trades</p>
                                <p className="mt-2 text-2xl font-black text-white">{selectedDayData.count}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default JournalCalendar;
