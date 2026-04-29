import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Pencil, Search, AlertCircle, X, Webhook, Camera } from 'lucide-react';
import {
    fetchWebhooks,
    createWebhook,
    updateWebhook,
    updateWebhookStatus,
    captureScreenshot
} from '../features/webhookSlice';
import { useWebSocket } from '../hooks/useWebSocket';

const ManageWebhooks = () => {
    const dispatch = useDispatch();
    const { items: webhooks, loading, error, screenshotLoading, lastScreenshot } = useSelector((state) => state.webhooks);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingWebhook, setEditingWebhook] = useState(null);
    const [signals, setSignals] = useState([]);
    const [isScreenshotModalOpen, setIsScreenshotModalOpen] = useState(false);
    const [screenshotSymbol, setScreenshotSymbol] = useState('');
    const [screenshotError, setScreenshotError] = useState(null);
    const [screenshotSuccess, setScreenshotSuccess] = useState(false);
    const [screenshotImageUrl, setScreenshotImageUrl] = useState(null);

    const handleNewSignal = (data) => {
        setSignals(prev => [data, ...prev].slice(0, 50));
    };

    const { isConnected } = useWebSocket({
        'tradingview_signal': handleNewSignal
    });

    const [formData, setFormData] = useState({
        Title: '',
        App: '',
        Description: '',
        WebhookUrl: '',
        webhookStatus: 'Enable'
    });

    useEffect(() => {
        dispatch(fetchWebhooks());
    }, [dispatch]);

    const handleOpenModal = (webhook = null) => {
        if (webhook) {
            setEditingWebhook(webhook);
            setFormData({
                Title: webhook.Title || '',
                App: webhook.App || '',
                Description: webhook.Description || '',
                WebhookUrl: webhook.WebhookUrl || '',
                webhookStatus: webhook.webhookStatus || 'Enable'
            });
        } else {
            setEditingWebhook(null);
            setFormData({
                Title: '',
                App: '',
                Description: '',
                WebhookUrl: '',
                webhookStatus: 'Enable'
            });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingWebhook(null);
    };

    const handleStatusToggle = (webhook) => {
        const newStatus = webhook.webhookStatus === 'Enable' ? 'Disable' : 'Enable';
        const id = webhook.documentId || webhook.id;
        dispatch(updateWebhookStatus({ id, status: newStatus }));
    };

    const handleScreenshot = async () => {
        if (!screenshotSymbol.trim()) {
            setScreenshotError('Symbol is required');
            return;
        }
        setScreenshotError(null);
        setScreenshotSuccess(false);
        setScreenshotImageUrl(null);
        try {
            const result = await dispatch(captureScreenshot({ symbol: screenshotSymbol.trim() })).unwrap();
            setScreenshotImageUrl(result.imageUrl);
            setScreenshotSuccess(true);
        } catch (err) {
            setScreenshotError(typeof err === 'string' ? err : err.message || 'Screenshot failed');
        }
    };

    const handleOpenScreenshotModal = () => {
        setScreenshotSymbol('BTCUSDT.P');
        setScreenshotError(null);
        setScreenshotSuccess(false);
        setScreenshotImageUrl(null);
        setIsScreenshotModalOpen(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingWebhook) {
                const id = editingWebhook.documentId || editingWebhook.id;
                await dispatch(updateWebhook({ id, data: formData })).unwrap();
            } else {
                await dispatch(createWebhook(formData)).unwrap();
            }
            handleCloseModal();
        } catch (err) {
            console.error('Failed to save webhook:', err);
            alert('Failed to save webhook');
        }
    };

    const filteredWebhooks = webhooks.filter(w =>
        w.Title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.App?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-100 flex items-center gap-2">
                        <Webhook className="w-6 h-6 text-blue-400" />
                        Webhooks Management
                    </h1>
                    <p className="text-gray-400 text-sm mt-1">Manage your webhooks integrations</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handleOpenScreenshotModal}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                        <Camera className="w-4 h-4" />
                        Screenshot
                    </button>
                    <button
                        onClick={() => handleOpenModal()}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        New Webhook
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-900/50 border border-red-500 rounded-lg flex items-center gap-3 text-red-200">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                    <p>{typeof error === 'string' ? error : error.message || 'An error occurred'}</p>
                </div>
            )}

            <div className="flex gap-6 h-[calc(100vh-180px)]">
                <div className="flex-1 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-gray-700">
                        <div className="relative max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search webhooks..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-lg pl-10 pr-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                            />
                        </div>
                    </div>

                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-gray-900/50 sticky top-0 z-10 backdrop-blur-sm">
                                <tr>
                                    <th className="p-4 text-sm font-semibold text-gray-400">Title</th>
                                    <th className="p-4 text-sm font-semibold text-gray-400">App</th>
                                    <th className="p-4 text-sm font-semibold text-gray-400">URL</th>
                                    <th className="p-4 text-sm font-semibold text-gray-400">Status</th>
                                    <th className="p-4 text-sm font-semibold text-gray-400 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700/50">
                                {loading && webhooks.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-gray-400">
                                            Loading webhooks...
                                        </td>
                                    </tr>
                                ) : filteredWebhooks.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" className="p-8 text-center text-gray-400">
                                            No webhooks found
                                        </td>
                                    </tr>
                                ) : (
                                    filteredWebhooks.map(webhook => (
                                        <tr key={webhook.documentId || webhook.id} className="hover:bg-gray-700/20 transition-colors">
                                            <td className="p-4 text-sm text-gray-200 font-medium">
                                                {webhook.Title}
                                                <p className="text-xs text-gray-400">{webhook.Description}
                                                </p>
                                            </td>
                                            <td className="p-4 text-sm text-gray-400">
                                                <span className="px-2 py-1 bg-gray-700 rounded text-xs font-medium">
                                                    {webhook.App}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-gray-400 max-w-xs truncate" title={webhook.WebhookUrl}>
                                                {webhook.WebhookUrl}
                                            </td>
                                            <td className="p-4 text-sm">
                                                <button
                                                    onClick={() => handleStatusToggle(webhook)}
                                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${webhook.webhookStatus === 'Enable'
                                                        ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                                                        : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                                                        }`}
                                                >
                                                    {webhook.webhookStatus}
                                                </button>
                                            </td>
                                            <td className="p-4 text-sm text-right">
                                                <button
                                                    onClick={() => handleOpenModal(webhook)}
                                                    className="p-2 text-gray-400 hover:text-blue-400 transition-colors"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="w-96 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden flex flex-col">
                    <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
                        <h2 className="text-sm font-semibold text-gray-200">Realtime Signals</h2>
                        <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-400">{isConnected ? 'Connected' : 'Disconnected'}</span>
                            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]' : 'bg-red-500'}`}></span>
                        </div>
                    </div>
                    <div className="flex-1 overflow-auto p-4 space-y-3">
                        {signals.map((signal, idx) => (
                            <div key={idx} className="p-3 bg-gray-900 rounded-lg border border-gray-700">
                                <div className="flex justify-between text-xs text-gray-400 mb-2">
                                    <span className="font-medium text-blue-400">{signal.title}</span>
                                    <span>{new Date(signal.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <pre className="text-xs text-gray-300 whitespace-pre-wrap font-mono overflow-x-auto">
                                    {JSON.stringify(signal.payload, null, 2)}
                                </pre>
                            </div>
                        ))}
                        {signals.length === 0 && <p className="text-xs text-gray-500 text-center mt-10">Waiting for signals...</p>}
                    </div>
                </div>
            </div>

            {/* Screenshot Modal */}
            {isScreenshotModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-md overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-gray-700">
                            <h2 className="text-xl font-semibold text-gray-100 flex items-center gap-2">
                                <Camera className="w-5 h-5 text-green-400" />
                                TradingView Screenshot
                            </h2>
                            <button
                                onClick={() => setIsScreenshotModalOpen(false)}
                                className="text-gray-400 hover:text-gray-200 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Symbol</label>
                                <input
                                    type="text"
                                    value={screenshotSymbol}
                                    onChange={(e) => setScreenshotSymbol(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleScreenshot()}
                                    className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                                    placeholder="e.g. BYBIT:BTCUSDT.P or BTCUSDT"
                                    autoFocus
                                />
                                <p className="text-xs text-gray-500 mt-1">Enter symbol with or without exchange prefix</p>
                            </div>

                            {screenshotError && (
                                <div className="p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200 text-sm">
                                    <AlertCircle className="w-4 h-4 inline mr-2" />
                                    {screenshotError}
                                </div>
                            )}

                            {screenshotSuccess && screenshotImageUrl && (
                                <div className="space-y-2">
                                    <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg text-green-200 text-sm flex items-center gap-2">
                                        <span>Screenshot captured successfully!</span>
                                    </div>
                                    <div className="relative rounded-lg overflow-hidden border border-gray-600 bg-gray-900">
                                        <img
                                            src={screenshotImageUrl}
                                            alt="Screenshot preview"
                                            className="w-full max-h-80 object-contain"
                                        />
                                    </div>
                                </div>
                            )}

                            <div className="pt-2 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsScreenshotModalOpen(false)}
                                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                                >
                                    Close
                                </button>
                                {!screenshotSuccess && (
                                    <button
                                        onClick={handleScreenshot}
                                        disabled={screenshotLoading}
                                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {screenshotLoading ? (
                                            <>
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Capturing...
                                            </>
                                        ) : (
                                            <>
                                                <Camera className="w-4 h-4" />
                                                Capture Screenshot
                                            </>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                    <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-lg overflow-hidden shadow-2xl">
                        <div className="flex items-center justify-between p-6 border-b border-gray-700">
                            <h2 className="text-xl font-semibold text-gray-100">
                                {editingWebhook ? 'Edit Webhook' : 'Create Webhook'}
                            </h2>
                            <button
                                onClick={handleCloseModal}
                                className="text-gray-400 hover:text-gray-200 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Title</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.Title}
                                    onChange={(e) => setFormData({ ...formData, Title: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    placeholder="e.g. TradingView Alert"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">App</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.App}
                                    onChange={(e) => setFormData({ ...formData, App: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                    placeholder="e.g. Discord, Telegram"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Webhook URL</label>
                                <input
                                    type="text"
                                    required
                                    value={formData.WebhookUrl}
                                    onChange={(e) => setFormData({ ...formData, WebhookUrl: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none font-mono text-sm"
                                    placeholder="https://..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Description</label>
                                <textarea
                                    value={formData.Description}
                                    onChange={(e) => setFormData({ ...formData, Description: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none h-24"
                                    placeholder="Optional details about this webhook..."
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-1">Status</label>
                                <select
                                    value={formData.webhookStatus}
                                    onChange={(e) => setFormData({ ...formData, webhookStatus: e.target.value })}
                                    className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                                >
                                    <option value="Enable">Enable</option>
                                    <option value="Disable">Disable</option>
                                </select>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={handleCloseModal}
                                    className="px-4 py-2 text-gray-300 hover:text-white transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                    disabled={loading}
                                >
                                    {loading ? 'Saving...' : 'Save Webhook'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ManageWebhooks;
