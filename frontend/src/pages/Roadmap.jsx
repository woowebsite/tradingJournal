import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { ArrowUpRight, TrendingUp, Shield, Target, Wallet, BadgeInfo, Flame, Save, Edit2, Trash2, CheckCircle2, X } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import AccountModal from '../components/AccountModal';
import api from '../services/api';
import { fetchTrades } from '../features/tradeSlice';
import { formatNumber } from '../utils/formatNumber';
import {
    buildRoadmapProjection,
    recommendGrowthTarget,
    resolveSetting,
    summarizeClosedTrades,
    toNumber
} from '../utils/roadmapCalculations';

const formatMoney = (value, currency = 'USD', pattern = '#,###.##') => {
    const formatted = formatNumber(value, pattern);
    if (formatted === '-') return '-';
    return currency ? `${formatted} ${currency}` : formatted;
};

const ROADMAP_STATUS_META = {
    unprocess: {
        label: 'Unprocess',
        className: 'bg-gray-500/15 text-gray-300 border border-gray-500/30'
    },
    process: {
        label: 'Process',
        className: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
    },
    completed: {
        label: 'Completed',
        className: 'bg-blue-500/15 text-blue-300 border border-blue-500/30'
    }
};

const Roadmap = () => {
    const dispatch = useDispatch();
    const { selectedAccount, setSelectedAccount } = useAccount();
    const { items: trades, loading } = useSelector(state => state.trades);
    const [startingBalance, setStartingBalance] = useState('');
    const [targetGrowth, setTargetGrowth] = useState('10');
    const [plannedTrades, setPlannedTrades] = useState('25');
    const [roadmapHistory, setRoadmapHistory] = useState([]);
    const [loadingRoadmaps, setLoadingRoadmaps] = useState(false);
    const [editingRoadmap, setEditingRoadmap] = useState(null);
    const [savingRoadmap, setSavingRoadmap] = useState(false);
    const [roadmapMessage, setRoadmapMessage] = useState('');
    const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);

    const setting = useMemo(() => resolveSetting(selectedAccount), [selectedAccount]);
    const closedSummary = useMemo(() => summarizeClosedTrades(trades), [trades]);
    const recommendedGrowth = useMemo(() => recommendGrowthTarget(setting), [setting]);
    const maxDrawDownPercent = useMemo(() => toNumber(setting?.maxDrawDown, 0), [setting]);

    // Auto-hide toast after 3 seconds
    useEffect(() => {
        if (roadmapMessage) {
            const timer = setTimeout(() => setRoadmapMessage(''), 3000);
            return () => clearTimeout(timer);
        }
    }, [roadmapMessage]);

    const applyRoadmapToForm = useCallback((record) => {
        if (!selectedAccount) return;

        if (record) {
            setStartingBalance(String(record.startingBalance ?? selectedAccount.initial_balance ?? ''));
            setTargetGrowth(String(record.targetGrowthPercent ?? recommendedGrowth));
            setPlannedTrades(String(record.plannedTrades ?? 25));
            return;
        }

        const nextBalance = toNumber(selectedAccount.initial_balance, 0);
        setStartingBalance(String(nextBalance || ''));
        setTargetGrowth(String(recommendedGrowth));
        setPlannedTrades('25');
    }, [recommendedGrowth, selectedAccount]);

    const syncRoadmaps = useCallback(async ({ keepEditing = false } = {}) => {
        if (!selectedAccount) return [];

        try {
            setLoadingRoadmaps(true);
            const accountId = selectedAccount.documentId || selectedAccount.id;
            const res = await api.get(`/roadmaps?filters[account][documentId][$eq]=${accountId}&sort=updatedAt:desc&pagination[pageSize]=100&populate=*`);
            const data = res.data.data || [];
            setRoadmapHistory(data);

            if (!keepEditing) {
                setEditingRoadmap(null);
                const processedRoadmap = data.find(item => (item.status || 'unprocess') === 'process') || data[0] || null;
                applyRoadmapToForm(processedRoadmap);
            }

            return data;
        } catch (error) {
            console.error('Failed to load roadmap history:', error);
            if (!keepEditing) {
                setEditingRoadmap(null);
                applyRoadmapToForm(null);
            }
            return [];
        } finally {
            setLoadingRoadmaps(false);
        }
    }, [applyRoadmapToForm, selectedAccount]);

    useEffect(() => {
        if (!selectedAccount) return;

        const accountId = selectedAccount.documentId || selectedAccount.id;
        dispatch(fetchTrades({ accountId, pageSize: 1000 }));
    }, [dispatch, selectedAccount]);

    useEffect(() => {
        if (!selectedAccount) return;

        syncRoadmaps();
    }, [selectedAccount, syncRoadmaps]);

    const activeBalance = toNumber(startingBalance, 0);
    const riskPercent = toNumber(setting?.riskPerTrade, 0);
    const targetGrowthValue = toNumber(targetGrowth, recommendedGrowth);
    const plannedTradesValue = Math.max(Math.floor(toNumber(plannedTrades, 25)), 1);
    const rewardMultiple = closedSummary.rewardMultiple > 0 ? closedSummary.rewardMultiple : 2;
    const winRateEstimate = closedSummary.winRate > 0 ? closedSummary.winRate : 55;

    const roadmap = useMemo(() => buildRoadmapProjection({
        startBalance: activeBalance,
        riskPercent,
        targetGrowthPercent: targetGrowthValue,
        rewardMultiple,
        plannedTrades: plannedTradesValue,
        winRateEstimate,
        maxDrawDownPercent
    }), [activeBalance, riskPercent, targetGrowthValue, rewardMultiple, plannedTradesValue, winRateEstimate, maxDrawDownPercent]);

    const milestones = useMemo(() => [10, 25, 50, 100].map(growth => {
        const projection = buildRoadmapProjection({
            startBalance: activeBalance,
            riskPercent,
            targetGrowthPercent: growth,
            rewardMultiple,
            plannedTrades: Math.max(plannedTradesValue, 25),
            winRateEstimate
        });

        return {
            growth,
            recommended: growth === recommendedGrowth,
            ...projection
        };
    }), [activeBalance, riskPercent, rewardMultiple, plannedTradesValue, winRateEstimate, recommendedGrowth]);

    const processedRoadmap = useMemo(
        () => roadmapHistory.find(item => (item.status || 'unprocess') === 'process') || null,
        [roadmapHistory]
    );
    const processedRoadmapGrowth = processedRoadmap
        ? Number(processedRoadmap.targetGrowthPercent || processedRoadmap.snapshot?.targetGrowthPercent || 0)
        : recommendedGrowth;
    const processedRoadmapTitle = processedRoadmap?.snapshot?.accountName
        || processedRoadmap?.snapshot?.settingName
        || 'No processed roadmap';
    const sortedRoadmapHistory = useMemo(() => {
        return [...roadmapHistory].sort((a, b) => {
            const aStatus = a.status || 'unprocess';
            const bStatus = b.status || 'unprocess';

            if (aStatus === 'process' && bStatus !== 'process') return -1;
            if (aStatus !== 'process' && bStatus === 'process') return 1;

            const aTarget = toNumber(a.targetGrowthPercent ?? a.snapshot?.targetGrowthPercent, 0);
            const bTarget = toNumber(b.targetGrowthPercent ?? b.snapshot?.targetGrowthPercent, 0);
            if (aTarget !== bTarget) return aTarget - bTarget;

            const aSavedAt = new Date(a.snapshot?.savedAt || a.updatedAt || a.createdAt || 0).getTime();
            const bSavedAt = new Date(b.snapshot?.savedAt || b.updatedAt || b.createdAt || 0).getTime();
            return bSavedAt - aSavedAt;
        });
    }, [roadmapHistory]);

    const activeSettingName = setting?.Name || setting?.name || 'No linked setting';
    const accountLabel = selectedAccount?.name || selectedAccount?.currency || 'Selected account';

    const handleOpenAccountModal = () => {
        if (!selectedAccount) return;
        setIsAccountModalOpen(true);
    };

    const handleSaveAccount = async (data) => {
        if (!selectedAccount) return;

        try {
            const accountId = selectedAccount.documentId || selectedAccount.id;
            await api.put(`/accounts/${accountId}`, { data });

            const refreshed = await api.get(`/accounts/${accountId}?populate=*`);
            const updatedAccount = refreshed.data.data;
            if (updatedAccount) {
                setSelectedAccount(updatedAccount);
            }

            setIsAccountModalOpen(false);
            setRoadmapMessage('Account updated.');
        } catch (error) {
            console.error('Failed to update account:', error.response?.data || error);
            const message = error.response?.data?.error?.message
                || error.response?.data?.message
                || error.message
                || 'Failed to update account';
            alert(message);
        }
    };

    const handleEditRoadmap = (record) => {
        setEditingRoadmap(record);
        setRoadmapMessage(`Editing roadmap from ${new Date(record.updatedAt || record.createdAt || Date.now()).toLocaleString()}.`);
        setStartingBalance(String(record.startingBalance ?? selectedAccount?.initial_balance ?? ''));
        setTargetGrowth(String(record.targetGrowthPercent ?? recommendedGrowth));
        setPlannedTrades(String(record.plannedTrades ?? 25));
    };

    const handleDeleteRoadmap = async (record) => {
        const roadmapId = record.documentId || record.id;
        if (!roadmapId) return;
        if (!window.confirm('Delete this roadmap snapshot?')) return;

        try {
            setSavingRoadmap(true);
            await api.delete(`/roadmaps/${roadmapId}`);
            setRoadmapMessage('Roadmap deleted.');
            if (editingRoadmap && String((editingRoadmap.documentId || editingRoadmap.id)) === String(roadmapId)) {
                setEditingRoadmap(null);
            }
            await syncRoadmaps();
        } catch (error) {
            console.error('Failed to delete roadmap:', error.response?.data || error);
            const message = error.response?.data?.error?.message
                || error.response?.data?.message
                || error.message
                || 'Failed to delete roadmap';
            alert(message);
        } finally {
            setSavingRoadmap(false);
        }
    };

    const handleSaveRoadmap = async () => {
        if (!selectedAccount) return;

        try {
            setSavingRoadmap(true);
            setRoadmapMessage('');

            const accountId = selectedAccount.documentId || selectedAccount.id;
            const settingId = setting?.documentId || setting?.id || null;
            const payload = {
                account: accountId,
                setting: settingId,
                status: editingRoadmap?.status || 'unprocess',
                startingBalance: activeBalance,
                targetGrowthPercent: targetGrowthValue,
                plannedTrades: plannedTradesValue,
                riskPercent,
                rewardMultiple: roadmap.rewardMultiple,
                maxDrawDownPercent,
                targetBalance: roadmap.targetBalance,
                profitTarget: roadmap.profitTarget,
                winRateEstimate: roadmap.winRateEstimate,
                snapshot: {
                    accountName: accountLabel,
                    settingName: activeSettingName,
                    targetGrowthPercent: targetGrowthValue,
                    targetBalance: roadmap.targetBalance,
                    profitTarget: roadmap.profitTarget,
                    winsOnlyNeeded: roadmap.winsOnlyNeeded,
                    winsNeededInPlannedTrades: roadmap.winsNeededInPlannedTrades,
                    estimatedTradesToGoal: roadmap.estimatedTradesToGoal,
                    rewardMultiple: roadmap.rewardMultiple,
                    riskPercent,
                    maxDrawDownPercent,
                    savedAt: new Date().toISOString()
                }
            };

            if (editingRoadmap?.documentId || editingRoadmap?.id) {
                const roadmapId = editingRoadmap.documentId || editingRoadmap.id;
                await api.put(`/roadmaps/${roadmapId}`, { data: payload });
                setRoadmapMessage('Roadmap updated.');
            } else {
                await api.post('/roadmaps', { data: payload });
                setRoadmapMessage('Roadmap saved.');
            }

            setEditingRoadmap(null);
            await syncRoadmaps();
        } catch (error) {
            console.error('Failed to save roadmap:', error.response?.data || error);
            const message = error.response?.data?.error?.message
                || error.response?.data?.message
                || error.message
                || 'Failed to save roadmap';
            alert(message);
        } finally {
            setSavingRoadmap(false);
        }
    };

    const handleProcessRoadmap = async (record) => {
        const roadmapId = record.documentId || record.id;
        if (!roadmapId || !selectedAccount) return;

        try {
            setSavingRoadmap(true);
            setRoadmapMessage('');

            const latestRoadmaps = roadmapHistory.length > 0 ? roadmapHistory : await syncRoadmaps({ keepEditing: true });
            const currentRoadmaps = Array.isArray(latestRoadmaps) ? latestRoadmaps : [];

            await api.put(`/roadmaps/${roadmapId}`, {
                data: {
                    status: 'process'
                }
            });

            await Promise.all(
                currentRoadmaps
                    .filter(item => String(item.documentId || item.id) !== String(roadmapId))
                    .map(item => {
                        const nextStatus = (item.status || 'unprocess') === 'completed' ? 'completed' : 'unprocess';
                        if ((item.status || 'unprocess') === nextStatus) return null;

                        const itemId = item.documentId || item.id;
                        if (!itemId) return null;

                        return api.put(`/roadmaps/${itemId}`, {
                            data: {
                                status: nextStatus
                            }
                        });
                    })
                    .filter(Boolean)
            );

            setEditingRoadmap(null);
            setRoadmapMessage('Roadmap processed.');
            await syncRoadmaps();
        } catch (error) {
            console.error('Failed to process roadmap:', error.response?.data || error);
            const message = error.response?.data?.error?.message
                || error.response?.data?.message
                || error.message
                || 'Failed to process roadmap';
            alert(message);
        } finally {
            setSavingRoadmap(false);
        }
    };

    return (
        <div className="space-y-6">
            <AccountModal
                isOpen={isAccountModalOpen}
                onClose={() => setIsAccountModalOpen(false)}
                onSubmit={handleSaveAccount}
                account={selectedAccount}
            />

            <div className="rounded-3xl border border-gray-700 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-6 shadow-2xl shadow-black/20">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                    <div className="space-y-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-blue-300">
                            <ArrowUpRight size={14} />
                            Journal / Roadmap
                        </div>
                        <div>
                            <h1 className="text-3xl md:text-4xl font-black text-white">Account Growth Roadmap</h1>
                            <p className="mt-2 max-w-2xl text-gray-400">
                                Build a compounding plan from your account balance, linked risk setting, and realistic win targets.
                                The target suggestions below are intentionally milestone-based so you can grow without overreaching.
                            </p>
                        </div>
                        <p className="text-xs uppercase tracking-widest text-gray-500">
                            {loading ? 'Syncing trades for roadmap...' : 'Roadmap is ready'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full lg:w-[420px]">
                        <div className="rounded-2xl border border-gray-700 bg-gray-800/80 p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-wider text-gray-500">Active Setting</p>
                                <BadgeInfo size={16} className="text-blue-400" />
                            </div>
                            <h3 className="mt-2 text-lg font-bold text-white truncate" title={activeSettingName}>{activeSettingName}</h3>
                            <p className="mt-1 text-sm text-gray-400">Account: {accountLabel}</p>
                            <button
                                type="button"
                                onClick={handleOpenAccountModal}
                                disabled={!selectedAccount}
                                className="mt-3 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1.5 text-xs font-semibold text-blue-300 transition hover:bg-blue-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                <Edit2 size={14} />
                                Change
                            </button>
                        </div>

                        <div className="rounded-2xl border border-gray-700 bg-gray-800/80 p-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs uppercase tracking-wider text-gray-500">Processed</p>
                                <Target size={16} className={processedRoadmap ? 'text-emerald-400' : 'text-blue-400'} />
                            </div>
                            <h3 className="mt-2 text-2xl font-black text-emerald-400">
                                +{processedRoadmapGrowth.toFixed(2)}%
                            </h3>
                            <p className="mt-1 text-sm text-gray-400 truncate" title={processedRoadmapTitle}>
                                {processedRoadmap
                                    ? `Process roadmap: ${processedRoadmapTitle}`
                                    : 'No roadmap is processed yet'}
                            </p>
                            {processedRoadmap ? (
                                <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${ROADMAP_STATUS_META.process.className}`}>
                                    Process
                                </span>
                            ) : (
                                <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${ROADMAP_STATUS_META.unprocess.className}`}>
                                    Waiting
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
                    <div className="flex items-center justify-between gap-3 mb-5">
                        <div>
                            <p className="text-xs uppercase tracking-wider text-gray-500">Goal Builder</p>
                            <h2 className="text-2xl font-bold text-white">Choose your growth target</h2>
                        </div>
                        <div className="balance inline-flex items-center gap-2 rounded-full border border-gray-700 bg-gray-900 px-3 py-2 text-sm text-gray-300">
                            <Wallet size={16} className="text-blue-400" />
                            {formatMoney(activeBalance, selectedAccount?.currency, selectedAccount?.moneyFormat)}
                        </div>
                        <button
                            type="button"
                            onClick={handleSaveRoadmap}
                            disabled={!selectedAccount || savingRoadmap}
                            className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Save size={16} />
                            {savingRoadmap ? 'Saving...' : editingRoadmap ? 'Update' : 'Save'}
                        </button>
                    </div>

                    {editingRoadmap && (
                        <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
                            Editing roadmap snapshot from {new Date(editingRoadmap.updatedAt || editingRoadmap.createdAt || Date.now()).toLocaleString()}.
                        </div>
                    )}

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                        {[10, 25, 50, 100].map(preset => (
                            <button
                                key={preset}
                                type="button"
                                onClick={() => setTargetGrowth(String(preset))}
                                className={`rounded-xl border px-4 py-3 text-left transition ${
                                    String(targetGrowth) === String(preset)
                                        ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 shadow-lg shadow-emerald-500/10'
                                        : 'border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
                                }`}
                            >
                                <div className="text-xs uppercase tracking-wider text-gray-500">Target</div>
                                <div className="mt-1 text-xl font-black">+{preset}%</div>
                            </button>
                        ))}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="space-y-2 block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Starting capital</span>
                            <input
                                type="number"
                                min="0"
                                step="any"
                                value={startingBalance}
                                onChange={(e) => setStartingBalance(e.target.value)}
                                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-gray-100 outline-none focus:border-blue-500"
                                placeholder="0"
                            />
                        </label>

                        <label className="space-y-2 block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Target growth %</span>
                            <input
                                type="number"
                                min="1"
                                step="any"
                                value={targetGrowth}
                                onChange={(e) => setTargetGrowth(e.target.value)}
                                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-gray-100 outline-none focus:border-blue-500"
                                placeholder="10"
                            />
                        </label>

                        <label className="space-y-2 block">
                            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Plan trades</span>
                            <input
                                type="number"
                                min="1"
                                step="1"
                                value={plannedTrades}
                                onChange={(e) => setPlannedTrades(e.target.value)}
                                className="w-full rounded-xl border border-gray-700 bg-gray-900 px-4 py-3 text-gray-100 outline-none focus:border-blue-500"
                                placeholder="25"
                            />
                        </label>
                    </div>

                    <div className="mt-5 rounded-2xl border border-gray-700 bg-gray-900/70 p-4">
                        <div className="flex items-center justify-between mb-3">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-gray-500">Projected path</p>
                                <h3 className="text-lg font-bold text-white">Win-only compounding ladder</h3>
                            </div>
                            <div className="text-sm text-gray-400">
                                Based on risk {riskPercent}% and reward {roadmap.rewardPct.toFixed(2)}% per trade
                            </div>
                        </div>

                        <div className="overflow-auto max-h-[520px] rounded-xl border border-gray-700">
                            <table className="min-w-full text-sm">
                                <thead className="sticky top-0 bg-gray-900 text-gray-400">
                                    <tr className="text-left">
                                        <th className="px-4 py-3">Trade</th>
                                        <th className="px-4 py-3">Start NAV</th>
                                        <th className="px-4 py-3">Win NAV</th>
                                        <th className="px-4 py-3">Profit</th>
                                        <th className="px-4 py-3">Loss NAV</th>
                                        <th className="px-4 py-3">Loss</th>
                                        <th className="px-4 py-3">Goal Progress</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-700">
                                    {loading ? (
                                        <tr>
                                            <td className="px-4 py-8 text-center text-gray-500" colSpan="7">
                                                Loading account trades...
                                            </td>
                                        </tr>
                                    ) : roadmap.rows.length === 0 ? (
                                        <tr>
                                            <td className="px-4 py-8 text-center text-gray-500" colSpan="7">
                                                Set a starting capital and trade count to see the roadmap.
                                            </td>
                                        </tr>
                                    ) : roadmap.rows.map(row => (
                                        <tr key={row.tradeNumber} className="hover:bg-gray-800/70 transition">
                                            <td className="px-4 py-3 font-semibold text-white">{row.tradeNumber}</td>
                                            <td className="px-4 py-3 font-mono text-gray-300">{formatMoney(row.startEquity, selectedAccount?.currency, selectedAccount?.moneyFormat)}</td>
                                            <td className="px-4 py-3 font-mono text-emerald-300">{formatMoney(row.winEquity, selectedAccount?.currency, selectedAccount?.moneyFormat)}</td>
                                            <td className="px-4 py-3 font-mono text-emerald-400">+{formatMoney(row.winProfit, selectedAccount?.currency, selectedAccount?.moneyFormat)}</td>
                                            <td className="px-4 py-3 font-mono text-red-300">{formatMoney(row.lossEquity, selectedAccount?.currency, selectedAccount?.moneyFormat)}</td>
                                            <td className="px-4 py-3 font-mono text-red-400">-{formatMoney(row.lossAmount, selectedAccount?.currency, selectedAccount?.moneyFormat)}</td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="h-2 w-28 rounded-full bg-gray-700 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-blue-400"
                                                            style={{ width: `${row.progress}%` }}
                                                        />
                                                    </div>
                                                    <span className="text-xs text-gray-400">{row.progress.toFixed(1)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="rounded-2xl border border-gray-700 bg-gray-800 p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-gray-500">Roadmap Summary</p>
                                <h3 className="text-xl font-bold text-white">What it takes to hit the target</h3>
                            </div>
                            <TrendingUp className="text-emerald-400" size={18} />
                        </div>

                        <div className="mt-4 space-y-3">
                            <Metric label="Target NAV" value={formatMoney(roadmap.targetBalance, selectedAccount?.currency, selectedAccount?.moneyFormat)} accent="text-white" />
                            <Metric label="Profit needed" value={formatMoney(roadmap.profitTarget, selectedAccount?.currency, selectedAccount?.moneyFormat)} accent="text-emerald-400" />
                            <Metric label="Risk / trade" value={`${roadmap.riskPct.toFixed(2)}%`} accent="text-blue-400" />
                            <Metric label="Reward / trade" value={`${roadmap.rewardPct.toFixed(2)}%`} accent="text-purple-400" />
                            <Metric label="Min wins if all wins" value={roadmap.winsOnlyNeeded ?? 'N/A'} accent="text-amber-400" />
                            <Metric label={`Wins needed in ${plannedTrades} trades`} value={roadmap.winsNeededInPlannedTrades ?? 'N/A'} accent="text-gray-100" />
                            <Metric label="Estimated trades at current win rate" value={roadmap.estimatedTradesToGoal ?? 'N/A'} accent="text-gray-100" />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-700 bg-gray-800 p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-xs uppercase tracking-wider text-gray-500">Risk Context</p>
                                <h3 className="text-xl font-bold text-white">Setting-driven guardrails</h3>
                            </div>
                            <Shield className="text-blue-400" size={18} />
                        </div>

                        <div className="mt-4 space-y-3">
                            <Metric label="Setting" value={activeSettingName} accent="text-blue-300" />
                            <Metric label="Avg win / loss" value={closedSummary.avgLoss > 0 ? `${(closedSummary.avgWin / closedSummary.avgLoss).toFixed(2)}R` : 'N/A'} accent="text-emerald-400" />
                            <Metric label="Historical win rate" value={`${closedSummary.winRate.toFixed(1)}%`} accent="text-amber-400" />
                            <Metric label="Loss budget at start" value={formatMoney(roadmap.lossBudget, selectedAccount?.currency, selectedAccount?.moneyFormat)} accent="text-red-400" />
                            <Metric label="Max drawdown budget" value={formatMoney(roadmap.maxDrawDownLossBudget, selectedAccount?.currency, selectedAccount?.moneyFormat)} accent="text-red-300" />
                            <Metric label="Projected NAV after all wins" value={formatMoney(roadmap.equityAfterPlannedTradesIfAllWins, selectedAccount?.currency, selectedAccount?.moneyFormat)} accent="text-gray-100" />
                        </div>
                    </div>
                </div>
            </div>

            {roadmapMessage && (
                <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-right-10 fade-in duration-300">
                    <div className="flex items-center gap-3 px-5 py-4 bg-gray-900 border border-green-500/50 rounded-2xl shadow-2xl shadow-green-500/10 backdrop-blur-xl">
                        <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                            <CheckCircle2 size={20} className="text-green-500" />
                        </div>
                        <div className="min-w-[200px]">
                            <p className="text-sm font-bold text-gray-100">{roadmapMessage}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setRoadmapMessage('')}
                            className="p-1 hover:bg-gray-800 rounded-lg transition-colors text-gray-500"
                            aria-label="Dismiss roadmap notification"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            )}

            <div className="rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
                <div className="flex items-center justify-between gap-3 mb-5">
                    <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500">Milestones</p>
                        <h3 className="text-2xl font-bold text-white">Progress checkpoints</h3>
                    </div>
                    <div className="text-sm text-gray-400">Recommended first step is highlighted</div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                    {milestones.map(item => (
                        <div
                            key={item.growth}
                            className={`rounded-2xl border p-4 ${
                                item.recommended
                                    ? 'border-emerald-500/40 bg-emerald-500/10'
                                    : 'border-gray-700 bg-gray-900/60'
                            }`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="text-xs uppercase tracking-wider text-gray-500">Milestone</div>
                                {item.recommended && <Flame size={16} className="text-emerald-400" />}
                            </div>
                            <div className="mt-2 text-2xl font-black text-white">+{item.growth}%</div>
                            <div className="mt-3 space-y-2 text-sm">
                                <div className="flex justify-between gap-3"><span className="text-gray-400">Target NAV</span><span className="font-mono text-gray-100">{formatMoney(item.targetBalance, selectedAccount?.currency, selectedAccount?.moneyFormat)}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-gray-400">Min wins</span><span className="font-mono text-emerald-300">{item.winsOnlyNeeded ?? 'N/A'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-gray-400">Wins in plan</span><span className="font-mono text-gray-100">{item.winsNeededInPlannedTrades ?? 'N/A'}</span></div>
                                <div className="flex justify-between gap-3"><span className="text-gray-400">Est. trades</span><span className="font-mono text-gray-100">{item.estimatedTradesToGoal ?? 'N/A'}</span></div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-2xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <div>
                        <p className="text-xs uppercase tracking-wider text-gray-500">History</p>
                        <h3 className="text-2xl font-bold text-white">Saved Roadmaps</h3>
                    </div>
                    <div className="text-sm text-gray-400">
                        {loadingRoadmaps ? 'Loading roadmap history...' : `${roadmapHistory.length} saved snapshots`}
                    </div>
                </div>

                <div className="overflow-hidden rounded-xl border border-gray-700">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-900 text-gray-400">
                            <tr>
                                <th className="px-4 py-3">Saved At</th>
                                <th className="px-4 py-3">Target</th>
                                <th className="px-4 py-3">Starting</th>
                                <th className="px-4 py-3">Planned Trades</th>
                                <th className="px-4 py-3">Risk</th>
                                <th className="px-4 py-3">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {loadingRoadmaps ? (
                                <tr>
                                    <td className="px-4 py-8 text-center text-gray-500" colSpan="7">
                                        Loading roadmap history...
                                    </td>
                                </tr>
                            ) : roadmapHistory.length === 0 ? (
                                <tr>
                                    <td className="px-4 py-8 text-center text-gray-500" colSpan="7">
                                        No saved roadmaps yet. Hit Save to create your first snapshot.
                                    </td>
                                </tr>
                            ) : sortedRoadmapHistory.map((item) => {
                                const itemId = item.documentId || item.id;
                                const savedAt = item.snapshot?.savedAt || item.updatedAt || item.createdAt;
                                const isEditing = editingRoadmap && String(editingRoadmap.documentId || editingRoadmap.id) === String(itemId);
                                const roadmapStatus = item.status || 'unprocess';
                                const statusMeta = ROADMAP_STATUS_META[roadmapStatus] || ROADMAP_STATUS_META.unprocess;

                                return (
                                    <tr key={itemId} className={`transition ${isEditing ? 'bg-amber-500/10' : 'hover:bg-gray-700/30'}`}>
                                        <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                                            {savedAt ? new Date(savedAt).toLocaleString() : '-'}
                                        </td>
                                        <td className="px-4 py-3 font-mono text-emerald-300">
                                            +{Number(item.targetGrowthPercent || item.snapshot?.targetGrowthPercent || 0).toFixed(2)}%
                                        </td>
                                        <td className="px-4 py-3 font-mono text-gray-200">
                                            {formatMoney(item.startingBalance, selectedAccount?.currency, selectedAccount?.moneyFormat)}
                                        </td>
                                        <td className="px-4 py-3 text-gray-200">
                                            {item.plannedTrades ?? '-'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-200">
                                            {(Number(item.riskPercent || 0)).toFixed(2)}%
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col gap-1">
                                                <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusMeta.className}`}>
                                                    {statusMeta.label}
                                                </span>
                                                {isEditing && (
                                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                                                        Editing
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex justify-end gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleProcessRoadmap(item)}
                                                    disabled={savingRoadmap}
                                                    className={`inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                                                        roadmapStatus === 'process'
                                                            ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20'
                                                            : 'border-gray-700 bg-gray-900 text-gray-200 hover:border-emerald-500 hover:text-emerald-300'
                                                    }`}
                                                >
                                                    <Target size={14} />
                                                    Process
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditRoadmap(item)}
                                                    disabled={savingRoadmap}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:border-blue-500 hover:text-blue-300"
                                                >
                                                    <Edit2 size={14} />
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteRoadmap(item)}
                                                    disabled={savingRoadmap}
                                                    className="inline-flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-900 px-3 py-1.5 text-xs font-semibold text-gray-200 transition hover:border-red-500 hover:text-red-300"
                                                >
                                                    <Trash2 size={14} />
                                                    Delete
                                                </button>
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
    );
};

const Metric = ({ label, value, accent = 'text-white' }) => (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-700 bg-gray-900/60 px-4 py-3">
        <span className="text-sm text-gray-400">{label}</span>
        <span className={`text-sm font-semibold ${accent}`}>{value}</span>
    </div>
);

export default Roadmap;
