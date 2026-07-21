import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Trash2, AlertCircle, Filter, RefreshCw } from 'lucide-react';
import { fetchSignals, deleteSignal, scanSignals } from '../features/signalSlice';
import { fetchRules } from '../features/ruleSlice';
import { fetchStrategies } from '../features/strategySlice';
import { useAccount } from '../context/AccountContext';
import { getStrategyId } from '../utils/roadmapCalculations';

const Signals = () => {
    const dispatch = useDispatch();
    const { items: signals, loading } = useSelector(state => state.signals);
    const { items: rules } = useSelector(state => state.rules);
    const { items: strategies } = useSelector(state => state.strategies);
    const { items: watchlists } = useSelector(state => state.watchlists);
    const { selectedAccount, accountSymbols, defaultWatchlist } = useAccount();

    const [selectedRule, setSelectedRule] = useState('');
    const [selectedSymbol, setSelectedSymbol] = useState('');
    const [selectedIds, setSelectedIds] = useState([]);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        dispatch(fetchSignals());
        dispatch(fetchRules());
        dispatch(fetchStrategies());
    }, [dispatch]);

    const handleLoadSignals = () => {
        if (!selectedRule && availableRules.length === 0) {
            alert('No rules available to scan.');
            return;
        }

        const accountId = selectedAccount ? (selectedAccount.documentId || selectedAccount.id) : null;
        const selectedRuleIds = selectedRule
            ? [selectedRule]
            : availableRules.map(rule => rule.documentId || rule.id).filter(Boolean);
        const scanSymbols = selectedSymbol
            ? availableSymbols.filter(symbol => symbol.id === selectedSymbol)
            : availableSymbols;

        if (scanSymbols.length === 0) {
            alert('No symbols available to scan.');
            return;
        }

        dispatch(scanSignals({ selectedRuleIds, scanSymbols, accountId, strategyId: activeStrategyId, syncDemoTrades: false }))
            .unwrap()
            .then((count) => {
                alert(`Scan complete. Found ${count} new signals.`);
            })
            .catch((err) => {
                alert(`Scan failed: ${err}`);
            });
    };

    const handleDelete = async (id) => {
        if (!id) return;
        if (window.confirm('Are you sure you want to delete this signal?')) {
            try {
                await dispatch(deleteSignal(id)).unwrap();
                setSelectedIds(prev => prev.filter(item => item !== id));
            } catch (err) {
                console.error('Failed to delete signal:', err);
                alert(`Failed to delete signal: ${err?.message || err}`);
            }
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString();
    };

    const isToday = (dateString) => {
        if (!dateString) return false;
        const date = new Date(dateString);
        const today = new Date();
        return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
    };

    // Safe extraction of Strategy ID
    const activeStrategyId = getStrategyId(selectedAccount?.strategy);

    const activeStrategy = (() => {
        if (!activeStrategyId) return null;
        return strategies.find(s => {
            const strategyId = getStrategyId(s);
            return strategyId === activeStrategyId || s.documentId === activeStrategyId || s.id === activeStrategyId;
        });
    })();

    const availableRules = (() => {
        if (!activeStrategy) return [];
        const stratRuleIds = [
            ...(activeStrategy.rules || []),
            ...(activeStrategy.entryRules || []),
            ...(activeStrategy.takeProfitRules || []),
            ...(activeStrategy.stoplossRules || []),
            ...(activeStrategy.exitRules || [])
        ].map(r => (r.documentId || r.id).toString());
        return rules.filter(r => stratRuleIds.includes((r.documentId || r.id).toString()));
    })();

    // Filter signals based on selected rule AND active strategy
    const baseFilteredSignals = (() => {
        if (!selectedAccount) return [];
        if (!activeStrategy) return [];

        let list = signals;

        // 1. Filter by Strategy Rules
        // Collect ALL valid identifiers (id and documentId) from all strategy rule categories
        const strategyRuleIdentifiers = new Set();
        [
            ...(activeStrategy.rules || []),
            ...(activeStrategy.entryRules || []),
            ...(activeStrategy.takeProfitRules || []),
            ...(activeStrategy.stoplossRules || []),
            ...(activeStrategy.exitRules || [])
        ].forEach(r => {
            if (r.id) strategyRuleIdentifiers.add(r.id.toString());
            if (r.documentId) strategyRuleIdentifiers.add(r.documentId.toString());
        });

        list = list.filter(signal => {
            if (!signal.rules || signal.rules.length === 0) return false;

            // Check if ANY of the signal's rules have an identifier in our allowed set
            const matches = signal.rules.some(r => {
                const idMatch = r.id && strategyRuleIdentifiers.has(r.id.toString());
                const docIdMatch = r.documentId && strategyRuleIdentifiers.has(r.documentId.toString());
                return idMatch || docIdMatch;
            });
            return matches;
        });

        // 2. Filter by Specific Selected Rule
        if (selectedRule) {
            list = list.filter(signal =>
                signal.rules?.some(r => (r.id || r.documentId).toString() === selectedRule)
            );
        }

        // 3. Filter by Active Account Watchlists
        // Get all watchlists for this account
        const accountWatchlists = watchlists.filter(wl => {
            const wlAccountId = wl.account?.documentId || wl.account?.id;
            const currentAccountId = selectedAccount.documentId || selectedAccount.id;
            return wlAccountId === currentAccountId;
        });

        // Collect all symbol IDs from these watchlists
        const allowedSymbolIds = new Set();
        accountWatchlists.forEach(wl => {
            if (wl.symbols && Array.isArray(wl.symbols)) {
                wl.symbols.forEach(s => {
                    if (s.id) allowedSymbolIds.add(s.id);
                    if (s.documentId) allowedSymbolIds.add(s.documentId);
                });
            }
        });

        // Filter signals to only show those where symbol is in the allowed list
        list = list.filter(signal => {
            const sigSymId = signal.symbol?.documentId || signal.symbol?.id;
            return allowedSymbolIds.has(sigSymId);
        });

        return list;
    })();

    const availableSymbols = (() => {
        const sourceSymbols = defaultWatchlist?.symbols?.length
            ? defaultWatchlist.symbols
            : accountSymbols;

        return sourceSymbols
            .map(symbol => {
                const symbolId = symbol.documentId || symbol.id;
                if (!symbolId) return null;

                return {
                    id: symbolId.toString(),
                    name: symbol.Name || 'Unknown'
                };
            })
            .filter(Boolean)
            .sort((a, b) => a.name.localeCompare(b.name));
    })();

    useEffect(() => {
        if (!selectedSymbol) return;
        if (!availableSymbols.some(symbol => symbol.id === selectedSymbol)) {
            setSelectedSymbol('');
        }
    }, [availableSymbols, selectedSymbol]);

    const filteredSignals = selectedSymbol
        ? baseFilteredSignals.filter(signal => {
            const symbolId = signal.symbol?.documentId || signal.symbol?.id;
            return symbolId?.toString() === selectedSymbol;
        })
        : baseFilteredSignals;

    // Checkbox & Selection Helpers
    const isAllSelected = filteredSignals.length > 0 && filteredSignals.every(signal => {
        const id = signal.documentId || signal.id;
        return selectedIds.includes(id);
    });

    const handleSelectAll = (e) => {
        if (e.target.checked) {
            const allFilteredIds = filteredSignals.map(signal => signal.documentId || signal.id);
            const nextSelected = Array.from(new Set([...selectedIds, ...allFilteredIds]));
            setSelectedIds(nextSelected);
        } else {
            const filteredIdSet = new Set(filteredSignals.map(signal => signal.documentId || signal.id));
            setSelectedIds(selectedIds.filter(id => !filteredIdSet.has(id)));
        }
    };

    const handleSelectOne = (id) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
        );
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        if (window.confirm(`Are you sure you want to delete ${selectedIds.length} selected signal(s)?`)) {
            setIsDeleting(true);
            try {
                const results = await Promise.allSettled(
                    selectedIds.map(id => dispatch(deleteSignal(id)).unwrap())
                );
                const succeeded = results.filter(r => r.status === 'fulfilled').length;
                const failed = results.filter(r => r.status === 'rejected').length;

                setSelectedIds([]);

                if (failed === 0) {
                    alert(`Successfully deleted ${succeeded} signal(s).`);
                } else {
                    alert(`Deleted ${succeeded} signal(s), but ${failed} failed.`);
                }
            } catch (err) {
                console.error('Failed batch delete signals:', err);
                alert(`Error during batch delete: ${err?.message || err}`);
            } finally {
                setIsDeleting(false);
            }
        }
    };

    const rulePurposeConfig = {
        entryRules: { label: 'Entry', className: 'bg-blue-500/20 text-blue-400' },
        stoplossRules: { label: 'Stoploss', className: 'bg-red-500/20 text-red-400' },
        takeProfitRules: { label: 'Take Profit', className: 'bg-green-500/20 text-green-400' },
        exitRules: { label: 'Exit', className: 'bg-yellow-500/20 text-yellow-400' }
    };

    const getRulePurpose = (rule) => {
        const ruleId = (rule.documentId || rule.id)?.toString();
        if (!ruleId || !activeStrategy) return null;

        for (const [fieldName, config] of Object.entries(rulePurposeConfig)) {
            const hasRule = activeStrategy[fieldName]?.some(strategyRule =>
                (strategyRule.documentId || strategyRule.id)?.toString() === ruleId
            );
            if (hasRule) return config;
        }

        return null;
    };

    const RulePurposeBadge = ({ rule }) => {
        const purpose = getRulePurpose(rule);

        return (
            <span className={`px-2 py-1 rounded text-xs font-bold ${purpose?.className || 'bg-gray-500/20 text-gray-400'}`}>
                {purpose?.label || 'Rule'}
            </span>
        );
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-bold text-white">Signals</h2>
                    {selectedAccount && (
                        <p className="text-gray-400 flex items-center gap-2">
                            Account: <span className="text-white font-medium">{selectedAccount.name}</span>
                            {activeStrategy ? (
                                <>
                                    <span>•</span>
                                    Strategy: <span className="text-blue-400 font-medium">{activeStrategy.name}</span>
                                    <span className="text-xs bg-gray-700 px-2 py-0.5 rounded text-gray-300">
                                        {availableRules.length} Rules
                                    </span>
                                </>
                            ) : (
                                <>
                                    <span>•</span>
                                    <span className="text-red-400">No Strategy Selected</span>
                                </>
                            )}
                        </p>
                    )}
                </div>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-sm">
                {/* Toolbar */}
                <div className="p-4 border-b border-gray-700 bg-gray-900/30 flex items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <div className="flex items-center gap-2">
                            <Filter size={18} className="text-gray-400" />
                            <span className="text-sm font-medium text-gray-400">Filter by Rule:</span>
                        </div>
                        <select
                            value={selectedRule}
                            onChange={(e) => setSelectedRule(e.target.value)}
                            className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none min-w-[200px]"
                        >
                            <option value="">All Rules</option>
                            {availableRules.map(rule => (
                                <option key={rule.id || rule.documentId} value={rule.id || rule.documentId}>
                                    {rule.Name}
                                </option>
                            ))}
                        </select>

                        <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-400">Filter by Symbol:</span>
                        </div>
                        <select
                            value={selectedSymbol}
                            onChange={(e) => setSelectedSymbol(e.target.value)}
                            className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2.5 outline-none min-w-[180px]"
                        >
                            <option value="">All Symbols</option>
                            {availableSymbols.map(symbol => (
                                <option key={symbol.id} value={symbol.id}>
                                    {symbol.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center gap-2">
                        {selectedIds.length > 0 && (
                            <button
                                onClick={handleDeleteSelected}
                                disabled={isDeleting || loading}
                                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-600/50 text-white rounded-lg transition shadow-lg shadow-red-600/20"
                            >
                                <Trash2 size={18} className={isDeleting ? "animate-spin" : ""} />
                                <span>Delete Selected ({selectedIds.length})</span>
                            </button>
                        )}

                        <button
                            onClick={handleLoadSignals}
                            disabled={loading || isDeleting}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg transition shadow-lg shadow-blue-600/20"
                        >
                            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                            <span>Scan Signals</span>
                        </button>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/50 text-gray-400 text-sm uppercase">
                            <tr>
                                <th className="p-4 w-12 text-center">
                                    <input
                                        type="checkbox"
                                        checked={isAllSelected}
                                        onChange={handleSelectAll}
                                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                        disabled={filteredSignals.length === 0 || loading || isDeleting}
                                    />
                                </th>
                                <th className="p-4">Date</th>
                                <th className="p-4">Name</th>
                                <th className="p-4">Rules</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {loading ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">Loading signals...</td>
                                </tr>
                            ) : filteredSignals.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="p-8 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <AlertCircle size={32} className="text-gray-600" />
                                            <p>
                                                {!selectedAccount ? "No account selected." :
                                                    !activeStrategy ? "Active Account has no strategy selected." :
                                                        availableRules.length === 0 ? "Strategy has no rules defined." :
                                                            signals.length === 0 ? "No signals recorded yet." :
                                                                "No signals match the current strategy rules."}
                                            </p>
                                            <div className="text-xs text-gray-600 mt-2">
                                                Total Signals: {signals.length} | Available Rules: {availableRules.length}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredSignals.map((signal) => {
                                    const signalId = signal.documentId || signal.id;
                                    const isSelected = selectedIds.includes(signalId);
                                    return (
                                        <tr key={signalId} className={`hover:bg-gray-700/30 transition ${isSelected ? 'bg-blue-900/20' : isToday(signal.date) ? 'bg-blue-600/10 border-1 border-blue-500' : ''}`}>
                                            <td className="p-4 w-12 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={isSelected}
                                                    onChange={() => handleSelectOne(signalId)}
                                                    className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            </td>
                                            <td className="p-4 text-gray-300 font-medium">
                                                {formatDate(signal.date)}
                                            </td>
                                            <td className="p-4 text-white">
                                                <Link
                                                    to={`/trade-station?symbol=${signal.symbol?.Name || ''}`}
                                                    className="hover:text-blue-400 hover:underline block font-bold"
                                                >   {signal.symbol?.Name}
                                                </Link>
                                                <span className="text-gray-400 text-sm">
                                                    {signal.name}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                {signal.rules?.length > 0 ? (
                                                    <div className="flex flex-wrap gap-2">
                                                        {signal.rules.map(rule => (
                                                            <div key={rule.id || rule.documentId} className="flex flex-col items-start gap-1">
                                                                <RulePurposeBadge rule={rule} />
                                                                <span className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                                                                    {rule.Name}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-500 text-sm">-</span>
                                                )}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${signal.expired ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'}`}>
                                                    {signal.expired ? 'Expired' : 'Active'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleDelete(signalId)}
                                                    className="p-2 text-gray-500 hover:text-red-400 transition"
                                                    title="Delete Signal"
                                                >
                                                    <Trash2 size={18} />
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Signals;
