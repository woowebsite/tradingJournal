import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Trash2, AlertCircle, Filter, RefreshCw } from 'lucide-react';
import { fetchSignals, deleteSignal, scanSignals } from '../features/signalSlice';
import { fetchRules } from '../features/ruleSlice';
import { fetchStrategies } from '../features/strategySlice';
import { useAccount } from '../context/AccountContext';

const Signals = () => {
    const dispatch = useDispatch();
    const { items: signals, loading } = useSelector(state => state.signals);
    const { items: rules } = useSelector(state => state.rules);
    const { items: strategies } = useSelector(state => state.strategies);
    const { selectedAccount } = useAccount();

    const [selectedRule, setSelectedRule] = useState('');

    useEffect(() => {
        dispatch(fetchSignals());
        dispatch(fetchRules());
        dispatch(fetchStrategies());
    }, [dispatch]);

    const handleLoadSignals = () => {
        if (!selectedRule) {
            if (window.confirm('No rule selected. Just refresh list? (Cancel to select a rule for scanning)')) {
                dispatch(fetchSignals());
            }
            return;
        }

        const accountId = selectedAccount ? (selectedAccount.documentId || selectedAccount.id) : null;

        dispatch(scanSignals({ selectedRuleId: selectedRule, accountId }))
            .unwrap()
            .then((count) => {
                alert(`Scan complete. Found ${count} new signals.`);
            })
            .catch((err) => {
                alert(`Scan failed: ${err}`);
            });
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this signal?')) {
            dispatch(deleteSignal(id));
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
    const activeStrategyId = (() => {
        if (!selectedAccount || !selectedAccount.strategy) return null;
        if (typeof selectedAccount.strategy === 'object') {
            return selectedAccount.strategy.documentId || selectedAccount.strategy.id;
        }
        return selectedAccount.strategy; // Fallback if it's just an ID
    })();

    const activeStrategy = (() => {
        if (!activeStrategyId) return null;
        // console.log('Looking for strategy:', activeStrategyId, 'in', strategies.length, 'strategies'); 
        return strategies.find(s => (s.documentId == activeStrategyId || s.id == activeStrategyId));
    })();

    const availableRules = (() => {
        if (!activeStrategy || !activeStrategy.rules) return [];
        const stratRuleIds = activeStrategy.rules.map(r => (r.documentId || r.id).toString());
        return rules.filter(r => stratRuleIds.includes((r.documentId || r.id).toString()));
    })();

    // Filter signals based on selected rule AND active strategy
    const filteredSignals = (() => {
        if (!selectedAccount) return [];
        if (!activeStrategy) return [];

        let list = signals;

        // 1. Filter by Strategy Rules
        // Robust strategy: Collect ALL valid identifiers (id and documentId) from the strategy's rules
        const strategyRuleIdentifiers = new Set();
        activeStrategy.rules.forEach(r => {
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

        return list;
    })();

    const TypeBadge = ({ type }) => {
        const colors = {
            entry: 'text-blue-400',
            takeprofit: 'text-green-400',
            stoploss: 'text-red-400',
            exit: 'text-orange-400'
        };
        return (
            <span className={`font-mono uppercase font-bold ${colors[type] || 'text-gray-400'}`}>
                {type}
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
                    <div className="flex items-center gap-4">
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
                    </div>

                    <button
                        onClick={handleLoadSignals}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-lg transition shadow-lg shadow-blue-600/20"
                    >
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                        <span>Scan Signals</span>
                    </button>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/50 text-gray-400 text-sm uppercase">
                            <tr>
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
                                    <td colSpan="5" className="p-8 text-center text-gray-500">Loading signals...</td>
                                </tr>
                            ) : filteredSignals.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="p-8 text-center text-gray-500">
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
                                filteredSignals.map((signal) => (
                                    <tr key={signal.id || signal.documentId} className={`hover:bg-gray-700/30 transition ${isToday(signal.date) ? 'bg-blue-600/10 border-1 border-blue-500' : ''}`}>
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
                                            <div className="flex flex-wrap gap-2">
                                                {signal.rules?.length > 0 ? (
                                                    signal.rules.map(rule => (
                                                        <>
                                                            <span key={rule.id || rule.documentId} className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-xs">
                                                                {rule.Name}
                                                            </span>
                                                            <TypeBadge type={rule.Type} />
                                                        </>
                                                    ))
                                                ) : (
                                                    <span className="text-gray-500 text-sm">-</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`px - 2 py - 1 rounded text - xs font - bold ${signal.expired ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'} `}>
                                                {signal.expired ? 'Expired' : 'Active'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => handleDelete(signal.documentId || signal.id)}
                                                className="p-2 text-gray-500 hover:text-red-400 transition"
                                                title="Delete Signal"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Signals;
