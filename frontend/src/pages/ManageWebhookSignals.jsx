import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchWebhookSignals, updateWebhookSignalStatus, fetchWebhookSignalById } from '../features/webhookSignalSlice';
import { executeSignalTrade } from '../features/tradeSlice';
import api from '../services/api';
import { Activity, Check, X, Image, ExternalLink } from 'lucide-react';
import getDecimalPlaces from '../utils/getDecimalPlaces';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAccount } from '../context/AccountContext';
import { Filter } from 'lucide-react';


const ManageWebhookSignals = () => {
    const dispatch = useDispatch();
    const { items: signals, loading, error } = useSelector((state) => state.webhookSignals);

    const [executingSignal, setExecutingSignal] = useState(null);
    const [executeForm, setExecuteForm] = useState({
        price: '',
        volume: '',
        slPnL: '', // SL theo PnL
        tpPnL: '', // TP theo PnL
    });
    const [screenshotFile, setScreenshotFile] = useState(null);
    const [screenshotPreview, setScreenshotPreview] = useState(null);
    const [savingImage, setSavingImage] = useState(false);
    const [fetchingSignalId, setFetchingSignalId] = useState(null);
    const { accountSymbols, selectedAccount } = useAccount();
    const [selectedSymbolFilter, setSelectedSymbolFilter] = useState('');
    
    // Binance execution states
    const [isExecuting, setIsExecuting] = useState(false);
    const [modalError, setModalError] = useState('');


    useEffect(() => {
        dispatch(fetchWebhookSignals(selectedSymbolFilter));
    }, [dispatch, selectedSymbolFilter]);

    // Handle Escape key to close modal
    useEffect(() => {
        const handleEsc = (event) => {
            if (event.key === 'Escape') {
                if (!isExecuting) handleCloseExecuteModal();
            }
        };

        if (executingSignal) {
            window.addEventListener('keydown', handleEsc);
        }

        return () => {
            window.removeEventListener('keydown', handleEsc);
        };
    }, [executingSignal, isExecuting]);

    // Handle incoming realtime signals to refresh the list automatically
    useWebSocket({
        'tradingview_signal': () => {
            dispatch(fetchWebhookSignals(selectedSymbolFilter));
        }
    });

    const handleOpenExecuteModal = async (signal) => {
        const id = signal.documentId || signal.id;
        setFetchingSignalId(id);
        try {
            const result = await dispatch(fetchWebhookSignalById(id)).unwrap();
            setExecutingSignal(result);
            setExecuteForm({ price: result.price || '', volume: '', slPnL: '', tpPnL: '' });
            setModalError('');
        } catch (error) {
            console.error("Failed to fetch signal details:", error);
            // Fallback to existing signal if fetch fails
            setExecutingSignal(signal);
            setModalError('');
        } finally {
            setFetchingSignalId(null);
        }
    };

    const handleCloseExecuteModal = () => {
        if (isExecuting) return;
        setExecutingSignal(null);
        setExecuteForm({ price: '', volume: '', slPnL: '', tpPnL: '' });
        setScreenshotFile(null);
        setScreenshotPreview(null);
        setModalError('');
    };

    const handleConfirmExecute = async (e) => {
        e.preventDefault();
        if (!executingSignal || isExecuting) return;

        const id = executingSignal.documentId || executingSignal.id;
        const accountId = selectedAccount?.documentId || selectedAccount?.id;
        const symbolId = executingSignal.linked_symbol?.documentId || executingSignal.linked_symbol?.id;

        setIsExecuting(true);
        setModalError('');

        const decimals = getDecimalPlaces(executeForm.price);
        const slPriceFormatted = calculatedSlPrice !== null ? calculatedSlPrice.toFixed(Math.max(2, decimals)) : '';
        const tpPriceFormatted = calculatedTpPrice !== null ? calculatedTpPrice.toFixed(Math.max(2, decimals)) : '';

        try {
            await dispatch(executeSignalTrade({
                signal: executingSignal,
                price: executeForm.price,
                volume: executeForm.volume,
                accountId,
                symbolId,
                screenshotFile,
                account: selectedAccount,
                slPnL: executeForm.slPnL,
                tpPnL: executeForm.tpPnL,
                slPrice: slPriceFormatted,
                tpPrice: tpPriceFormatted,
            })).unwrap();

            await dispatch(updateWebhookSignalStatus({ id, status: 'Execute' })).unwrap();
            handleCloseExecuteModal();
        } catch (err) {
            console.error("Execution failed:", err);
            const errorMsg = typeof err === 'string' 
                ? err 
                : err?.message || err?.error || 'An error occurred during execution. Please check your inputs and Binance API credentials.';
            setModalError(errorMsg);
        } finally {
            setIsExecuting(false);
        }
    };

    const handleScreenshotChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setScreenshotFile(file);
        setScreenshotPreview(URL.createObjectURL(file));
    };

    const handleRemoveScreenshot = () => {
        if (screenshotPreview) URL.revokeObjectURL(screenshotPreview);
        setScreenshotFile(null);
        setScreenshotPreview(null);
    };

    const handleSaveScreenshot = async () => {
        if (!screenshotFile || !executingSignal) return;
        setSavingImage(true);
        try {
            const token = localStorage.getItem('strapi_token');
            const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:1337/api';

            // Upload file
            const formData = new FormData();
            formData.append('files', screenshotFile);
            const uploadRes = await fetch(`${API_URL}/upload`, {
                method: 'POST',
                headers: { 'Authorization': token ? `Bearer ${token}` : '' },
                body: formData
            });

            if (!uploadRes.ok) throw new Error('Upload failed');
            const files = await uploadRes.json();
            const fileObj = Array.isArray(files) ? files[0] : files;
            const fileId = fileObj.id || fileObj.documentId;

            // Update webhook signal image relation
            const id = executingSignal.documentId || executingSignal.id;
            await api.put(`/webhook-signals/${id}`, {
                data: { image: fileId }
            });

            // Refresh signal data
            const result = await dispatch(fetchWebhookSignalById(id)).unwrap();
            setExecutingSignal(result);
            URL.revokeObjectURL(screenshotPreview);
            setScreenshotFile(null);
            setScreenshotPreview(null);
        } catch (err) {
            console.error('Failed to save screenshot:', err);
        } finally {
            setSavingImage(false);
        }
    };

    const handleUpdateStatus = (signal, status) => {
        const id = signal.documentId || signal.id;
        dispatch(updateWebhookSignalStatus({ id, status }));
    };

    // Calculate USD value dynamically
    const usdValue = (parseFloat(executeForm.price || 0) * parseFloat(executeForm.volume || 0)).toFixed(2);

    // Tính giá TP/SL dựa trên PnL nhập vào
    const signalType = executingSignal?.signal?.toUpperCase() || '';
    const entryPrice = parseFloat(executeForm.price);
    const slPnL = parseFloat(executeForm.slPnL);
    const tpPnL = parseFloat(executeForm.tpPnL);

    // Tính toán giá SL/TP
    const calculatedSlPrice = useMemo(() => {
        if (!entryPrice || !slPnL) return null;
        if (["LONG", "BUY"].includes(signalType)) {
            return entryPrice - Math.abs(slPnL);
        } else if (["SHORT", "SELL"].includes(signalType)) {
            return entryPrice + Math.abs(slPnL);
        }
        return null;
    }, [entryPrice, slPnL, signalType]);

    const calculatedTpPrice = useMemo(() => {
        if (!entryPrice || !tpPnL) return null;
        if (["LONG", "BUY"].includes(signalType)) {
            return (entryPrice + Math.abs(tpPnL))
        } else if (["SHORT", "SELL"].includes(signalType)) {
            return (entryPrice - Math.abs(tpPnL))
        }
        return null;
    }, [entryPrice, tpPnL, signalType]);

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                        <Activity className="w-6 h-6 text-blue-400" />
                        Webhook Signals
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Manage and execute incoming signals</p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5">
                        <Filter className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-400 font-medium">Filter:</span>
                        <select
                            value={selectedSymbolFilter}
                            onChange={(e) => setSelectedSymbolFilter(e.target.value)}
                            className="bg-transparent border-none text-sm text-gray-200 focus:ring-0 cursor-pointer outline-none min-w-[150px]"
                        >
                            <option value="" className="bg-gray-800">All Symbols</option>
                            {accountSymbols.map(sym => (
                                <option key={sym.id} value={sym.id} className="bg-gray-800">
                                    {sym.Name || sym.name}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
                    <p>{typeof error === 'string' ? error : 'An error occurred'}</p>
                </div>
            )}

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-900/50 text-sm uppercase text-gray-400">
                            <tr>
                                <th className="p-4">Date</th>
                                <th className="p-4">Symbol</th>
                                <th className="p-4">Signal</th>
                                <th className="p-4">TF</th>
                                <th className="p-4">Webhook</th>
                                <th className="p-4">Status</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                            {loading && signals.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-gray-400">Loading signals...</td>
                                </tr>
                            ) : signals.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="p-8 text-center text-gray-500">
                                        {selectedSymbolFilter ? 'No signals found for this symbol.' : 'No signals found.'}
                                    </td>
                                </tr>
                            ) : (
                                signals.map(signal => {
                                    const isUnread = signal.signalStatus === 'Unread';
                                    const isReject = signal.signalStatus === 'Reject';
                                    const isExecute = signal.signalStatus === 'Execute';

                                    return (
                                        <tr
                                            key={signal.documentId || signal.id}
                                            className={`transition-colors ${isUnread ? 'bg-blue-900/20 hover:bg-blue-900/30' :
                                                isReject ? 'opacity-50 grayscale bg-gray-900/30' :
                                                    'hover:bg-gray-700/30'
                                                }`}
                                        >
                                            <td className="p-4 text-sm text-gray-400">
                                                {new Date(signal.createdDate || signal.createdAt).toLocaleString()}
                                            </td>
                                            <td className={`p-4 font-bold ${isUnread ? 'text-blue-300' : 'text-gray-200'}`}>
                                                <div className="flex flex-col">
                                                    <span>{signal.symbol}</span>
                                                    {signal.linked_symbol && (
                                                        <span className="text-[10px] text-gray-500 font-normal uppercase">
                                                            Linked: {signal.linked_symbol.Name || signal.linked_symbol.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${['LONG', 'BUY'].includes(signal.signal?.toUpperCase()) ? 'bg-green-500/20 text-green-400' :
                                                    ['SHORT', 'SELL'].includes(signal.signal?.toUpperCase()) ? 'bg-red-500/20 text-red-400' :
                                                        'bg-gray-700 text-gray-300'
                                                    }`}>
                                                    {signal.signal}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-gray-400">{signal.tf}</td>
                                            <td className="p-4 text-sm text-gray-400">
                                                {signal.webhook?.Title || '-'}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-bold ${isUnread ? 'bg-blue-500/20 text-blue-400' :
                                                    isExecute ? 'bg-green-500/20 text-green-400' :
                                                        'bg-gray-700 text-gray-400'
                                                    }`}>
                                                    {signal.signalStatus}
                                                </span>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={() => handleOpenExecuteModal(signal)}
                                                        disabled={isExecute}
                                                        className={`p-1.5 rounded-lg transition-colors ${isExecute ? 'text-green-500 opacity-50 cursor-not-allowed' :
                                                            'text-gray-400 hover:text-green-400 hover:bg-green-400/10'
                                                            }`}
                                                        title="Execute"
                                                    >
                                                        <Check className={`w-5 h-5 ${fetchingSignalId === (signal.documentId || signal.id) ? 'animate-pulse' : ''}`} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleUpdateStatus(signal, 'Reject')}
                                                        disabled={isReject}
                                                        className={`p-1.5 rounded-lg transition-colors ${isReject ? 'text-red-500 opacity-50 cursor-not-allowed' :
                                                            'text-gray-400 hover:text-red-400 hover:bg-red-400/10'
                                                            }`}
                                                        title="Reject"
                                                    >
                                                        <X className="w-5 h-5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Execute Modal */}
            {executingSignal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-5xl overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-gray-700">
                            <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
                                <Activity className="w-5 h-5 text-blue-400" />
                                Execute Signal
                                <span className={`px-2 py-1 rounded text-xs font-bold ${['LONG', 'BUY'].includes(executingSignal.signal?.toUpperCase()) ? 'bg-green-500/20 text-green-400' :
                                    ['SHORT', 'SELL'].includes(executingSignal.signal?.toUpperCase()) ? 'bg-red-500/20 text-red-400' :
                                        'bg-gray-700 text-gray-300'
                                    }`}>
                                    {executingSignal.signal}
                                </span>
                            </h2>
                            <button
                                onClick={handleCloseExecuteModal}
                                className="text-gray-400 hover:text-gray-200 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2">
                            {/* Left Column: Form */}
                            <form onSubmit={handleConfirmExecute} className="p-6 space-y-4 border-r border-gray-700">
                                {modalError && (
                                    <div className="p-3 bg-red-900/40 border border-red-500/50 rounded-lg text-red-200 text-xs whitespace-pre-wrap break-words">
                                        {modalError}
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Symbol</label>
                                    <input
                                        type="text"
                                        readOnly
                                        value={executingSignal.symbol}
                                        className="w-full bg-gray-900/50 border border-gray-700 text-gray-400 rounded-lg px-4 py-2 cursor-not-allowed outline-none"
                                    />
                                </div>

                                {executingSignal.desc && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                                        <div className="w-full bg-gray-900/50 border border-gray-700 text-gray-200 rounded-lg px-4 py-2">
                                            {executingSignal.desc}
                                        </div>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Price</label>
                                        <input
                                            type="number"
                                            step="any"
                                            required
                                            disabled={isExecuting}
                                            value={executeForm.price}
                                            onChange={(e) => setExecuteForm(prev => ({ ...prev, price: e.target.value }))}
                                            className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">Volume</label>
                                        <input
                                            type="number"
                                            step="any"
                                            required
                                            disabled={isExecuting}
                                            value={executeForm.volume}
                                            onChange={(e) => setExecuteForm(prev => ({ ...prev, volume: e.target.value }))}
                                            className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            placeholder="0.00"
                                        />
                                        <p className="text-s text-blue-500 mt-1 ml-2">
                                            <span>{isNaN(usdValue) ? '0.00' : usdValue} $</span>
                                        </p>
                                    </div>
                                </div>

                                {/* TP/SL theo PnL */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">SL (PnL)</label>
                                        <input
                                            type="number"
                                            step="any"
                                            min="0"
                                            disabled={isExecuting}
                                            value={executeForm.slPnL}
                                            onChange={e => setExecuteForm(prev => ({ ...prev, slPnL: e.target.value }))}
                                            className="w-full bg-gray-900 border border-gray-700 text-red-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-red-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            placeholder="Nhập SL theo PnL"
                                        />
                                        <div className="text-xs text-red-400 mt-1">Giá Stoploss: <span className="font-mono">{calculatedSlPrice || '--'}</span></div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-300 mb-1">TP (PnL)</label>
                                        <input
                                            type="number"
                                            step="any"
                                            min="0"
                                            disabled={isExecuting}
                                            value={executeForm.tpPnL}
                                            onChange={e => setExecuteForm(prev => ({ ...prev, tpPnL: e.target.value }))}
                                            className="w-full bg-gray-900 border border-gray-700 text-green-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 outline-none disabled:opacity-50 disabled:cursor-not-allowed"
                                            placeholder="Nhập TP theo PnL"
                                        />
                                        <div className="text-xs text-green-400 mt-1">Giá Takeprofit: <span className="font-mono">{calculatedTpPrice || '--'}</span></div>
                                    </div>
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <button
                                        type="button"
                                        onClick={handleCloseExecuteModal}
                                        disabled={isExecuting}
                                        className="px-4 py-2 text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isExecuting}
                                        className={`px-6 py-2 text-white font-medium rounded-lg transition-colors shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${['LONG', 'BUY'].includes(executingSignal.signal?.toUpperCase())
                                            ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20'
                                            : ['SHORT', 'SELL'].includes(executingSignal.signal?.toUpperCase())
                                                ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20'
                                                : 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/20'
                                            }`}
                                    >
                                        {isExecuting && (
                                            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                        )}
                                        {isExecuting ? 'Executing...' : (
                                            ['LONG', 'BUY'].includes(executingSignal.signal?.toUpperCase()) ? 'Long' :
                                            ['SHORT', 'SELL'].includes(executingSignal.signal?.toUpperCase()) ? 'Short' :
                                            'Execute'
                                        )}
                                    </button>
                                </div>
                            </form>

                            {/* Right Column: Screenshot */}
                            <div className="p-6 bg-gray-900/30 flex flex-col gap-3">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-medium text-gray-400 uppercase tracking-wide">Chart Screenshot</label>
                                    <div className="flex items-center gap-2">
                                        {screenshotPreview && (
                                            <button
                                                onClick={handleSaveScreenshot}
                                                disabled={savingImage}
                                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-800 text-white text-xs font-medium rounded-lg transition-colors"
                                            >
                                                {savingImage ? 'Saving...' : 'Save'}
                                            </button>
                                        )}
                                        <label className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors">
                                            Upload
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleScreenshotChange}
                                                className="hidden"
                                            />
                                        </label>
                                    </div>
                                </div>
                                {(screenshotPreview || executingSignal.image?.url) ? (
                                    <div className="relative flex-1 rounded-lg overflow-hidden border border-gray-700 cursor-pointer group bg-gray-900">
                                        <img
                                            src={screenshotPreview || executingSignal.image.url}
                                            alt={`Chart ${executingSignal.symbol}`}
                                            className="w-full h-full object-contain transition-transform group-hover:scale-[1.01]"
                                        />
                                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-all">
                                            <div className="opacity-0 group-hover:opacity-100 bg-black/60 rounded-full p-2 transition-opacity">
                                                {screenshotPreview ? (
                                                    <button onClick={(e) => { e.stopPropagation(); handleRemoveScreenshot(); }} className="text-white"><X className="w-6 h-6" /></button>
                                                ) : (
                                                    <ExternalLink className="w-6 h-6 text-white" />
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 rounded-lg border-2 border-dashed border-gray-700 flex flex-col items-center justify-center text-gray-500 gap-2">
                                        <Image className="w-12 h-12 opacity-20" />
                                        <span className="text-sm">No screenshot available</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageWebhookSignals;
