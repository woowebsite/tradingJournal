import { useEffect, useMemo, useState } from 'react';
import clsx from 'clsx';
import {
    Calendar,
    CalendarDays,
    CheckSquare,
    Edit2,
    Plus,
    Save,
    Target,
    Trash2,
    ListChecks,
    TrendingUp,
    Activity
} from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import { createPlan, deletePlan, listPlans, updatePlan } from '../services/planService';

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
    const { accounts, selectedAccount, loading } = useAccount();
    const [plans, setPlans] = useState([]);
    const [form, setForm] = useState(() => buildEmptyForm(selectedAccount, accounts));
    const [isEditing, setIsEditing] = useState(false);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');

    const selectedAccountId = selectedAccount ? String(selectedAccount.id || selectedAccount.documentId) : '';

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

        const usedDailyIds = new Set();
        const weeklyGroups = weeklyPlans.map(weeklyPlan => {
            const children = dailyPlans.filter(dailyPlan => {
                const dailyId = String(dailyPlan.documentId || dailyPlan.id);
                if (usedDailyIds.has(dailyId)) return false;
                const inRange = isDateInRange(dailyPlan.planDate, weeklyPlan.weekStart, weeklyPlan.weekEnd);
                if (inRange) usedDailyIds.add(dailyId);
                return inRange;
            });
            return { weeklyPlan, children };
        });

        const standaloneDailyPlans = dailyPlans.filter(plan => !usedDailyIds.has(String(plan.documentId || plan.id)));
        return { weeklyGroups, standaloneDailyPlans };
    }, [filteredPlans]);

    const stats = useMemo(() => {
        const total = filteredPlans.length;
        const daily = filteredPlans.filter(plan => plan.scope === 'Daily').length;
        const weekly = filteredPlans.filter(plan => plan.scope === 'Weekly').length;
        const active = filteredPlans.filter(plan => plan.status === 'Active').length;
        return { total, daily, weekly, active };
    }, [filteredPlans]);

    const resetForm = () => {
        setForm(buildEmptyForm(selectedAccount, accounts));
        setIsEditing(false);
        setMessage('');
        setError('');
    };

    const handleEdit = (plan) => {
        setIsEditing(true);
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

        return (
            <div key={plan.documentId || plan.id} className={isWeekly ? 'space-y-3' : 'ml-6 pl-5 border-l border-gray-700/80'}>
                <div
                    className={clsx(
                        'relative',
                        isWeekly
                            ? 'rounded-2xl border border-gray-700 bg-gray-800 overflow-hidden shadow-lg shadow-black/10'
                            : 'rounded-2xl bg-gray-900/70 overflow-visible shadow-md shadow-black/10'
                    )}
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
                                    onClick={() => handleEdit(plan)}
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-200 hover:bg-gray-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                >
                                    <Edit2 size={16} />
                                    Edit
                                </button>
                                <button
                                    onClick={() => handleDelete(plan)}
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
                            <div className="absolute left-[-54px] top-5 w-16 flex flex-col items-center">
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
                                        onClick={() => handleEdit(plan)}
                                        disabled={saving}
                                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gray-900 border border-gray-700 text-gray-200 hover:bg-gray-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <Edit2 size={14} />
                                        Edit
                                    </button>
                                    <button
                                        onClick={() => handleDelete(plan)}
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
                            <div className="rounded-xl bg-gray-950/50 border border-gray-700 p-3.5">
                                <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Entry</div>
                                <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                                    {plan.entryPlan || 'No entry plan yet.'}
                                </p>
                            </div>
                            <div className="rounded-xl bg-gray-950/50 border border-gray-700 p-3.5">
                                <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Risk</div>
                                <p className="text-xs text-gray-300 whitespace-pre-wrap leading-relaxed">
                                    {plan.riskPlan || 'No risk plan yet.'}
                                </p>
                            </div>
                            <div className="rounded-xl bg-gray-950/50 border border-gray-700 p-3.5">
                                <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Checklist / Review</div>
                                <div className="space-y-2 text-xs text-gray-300 leading-relaxed">
                                    <p className="whitespace-pre-wrap">{plan.checklist || 'No checklist yet.'}</p>
                                    <p className="whitespace-pre-wrap">{plan.reviewNotes || 'No review notes yet.'}</p>
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
                                <div className="rounded-xl bg-gray-900/70 border border-gray-700 p-4">
                                    <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Entry plan</div>
                                    <p className="text-xs text-gray-300 whitespace-pre-wrap">
                                        {plan.entryPlan || 'No entry plan yet.'}
                                    </p>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="rounded-xl bg-gray-900/70 border border-gray-700 p-4">
                                    <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">Risk & checklist</div>
                                    <div className="space-y-3 text-xs text-gray-300">
                                        <p className="whitespace-pre-wrap">{plan.riskPlan || 'No risk plan yet.'}</p>
                                        <p className="whitespace-pre-wrap">{plan.checklist || 'No checklist yet.'}</p>
                                    </div>
                                </div>
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
        <div id="plan" className="p-6 space-y-6 text-[13px] [&_*]:!text-[13px]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                 <div>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                        <Activity className="w-6 h-6 text-blue-400" />
                        Journal Plans
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Manage and execute incoming signals</p>
                </div>

                <button
                    onClick={resetForm}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 transition"
                >
                    <Plus size={16} />
                    New Plan
                </button>
            </div>

            {(message || error) && (
                <div className={clsx(
                    'rounded-xl px-4 py-3 text-sm border',
                    error ? 'border-red-500/30 bg-red-500/10 text-red-200' : 'border-blue-500/30 bg-blue-500/10 text-blue-200'
                )}>
                    {error || message}
                </div>
            )}

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
                <div className="xl:col-span-2 space-y-6">
                    <div className="rounded-2xl border border-gray-700 bg-gray-800 p-5">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            <div>
                                <h2 className="text-lg font-bold text-white">{isEditing ? 'Edit Plan' : 'Create Plan'}</h2>
                                <p className="text-xs text-gray-400 mt-1">
                                    Gợi ý form: bối cảnh, setup, rủi ro, checklist, và review sau phiên.
                                </p>
                            </div>
                            <div className="px-3 py-1 rounded-full bg-gray-900 border border-gray-700 text-[11px] text-gray-400">
                                {loading ? 'Loading accounts...' : (selectedAccount?.name || form.accountName || 'No account')}
                            </div>
                        </div>

                        <form className="space-y-4" onSubmit={handleSubmit}>
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

                            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="submit"
                                        disabled={saving}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-500 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <Save size={16} />
                                        {saving ? 'Saving...' : (isEditing ? 'Update Plan' : 'Save Plan')}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={resetForm}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-900 border border-gray-700 text-gray-200 hover:bg-gray-800 transition"
                                    >
                                        Reset
                                    </button>
                                </div>
                                <button
                                    type="button"
                                    onClick={resetForm}
                                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 transition"
                                >
                                    <Plus size={16} />
                                    New Plan
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="rounded-2xl border border-gray-700 bg-gray-800 p-5">
                        <div className="flex items-center gap-2 mb-3 text-gray-200 font-semibold text-sm">
                            <CheckSquare size={18} />
                            Form gợi ý
                        </div>
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
                    ) : (
                        <div className="space-y-4">
                            {planTree.weeklyGroups.map(({ weeklyPlan, children }) => (
                                <div key={weeklyPlan.documentId || weeklyPlan.id} className="space-y-3">
                                    {renderPlanCard(weeklyPlan, 'weekly')}
                                    {children.map(dailyPlan => renderPlanCard(dailyPlan, 'daily'))}
                                </div>
                            ))}
                            {planTree.standaloneDailyPlans.map(dailyPlan => renderPlanCard(dailyPlan, 'daily'))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Plan;
