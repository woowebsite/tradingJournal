import React from 'react';
import { Bot, Play, Square, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Info, Zap } from 'lucide-react';

const AutoTradeLogPanel = ({
    isAutoTradeEnabled = false,
    onToggleAutoTrade = () => {},
    logs = [],
    isScanning = false,
    selectedSymbol = null,
    selectedTemplate = null,
    timeframe = 'D1',
    onClearLogs = () => {}
}) => {
    return (
        <div className="flex flex-col h-full space-y-3">
            {/* Top Status & Controls Bar */}
            <div className="flex items-center justify-between flex-wrap gap-2 p-2.5 rounded-lg bg-gray-900/80 border border-gray-700/70">
                <div className="flex items-center gap-2.5 flex-wrap">
                    <button
                        type="button"
                        onClick={onToggleAutoTrade}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition shadow-sm cursor-pointer ${
                            isAutoTradeEnabled
                                ? 'bg-emerald-600/20 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-600/30'
                                : 'bg-gray-700/60 text-gray-300 border border-gray-600 hover:bg-gray-700'
                        }`}
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
                                <Square size={12} className="text-gray-400" />
                                <span>Auto Trade: OFF</span>
                            </>
                        )}
                    </button>

                    <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <span className="font-semibold text-gray-300">{selectedSymbol?.Name || 'Chưa chọn mã'}</span>
                        <span>•</span>
                        <span className="font-mono text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/50">{timeframe}</span>
                        {selectedTemplate && (
                            <>
                                <span>•</span>
                                <span className="text-purple-300 max-w-[140px] truncate" title={selectedTemplate.name}>
                                    {selectedTemplate.name}
                                </span>
                            </>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isScanning && (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 bg-amber-950/40 border border-amber-600/40 px-2 py-0.5 rounded-full animate-pulse">
                            <RefreshCw size={11} className="animate-spin" />
                            Đang quét nến đóng...
                        </span>
                    )}

                    {logs.length > 0 && (
                        <button
                            type="button"
                            onClick={onClearLogs}
                            className="text-[11px] text-gray-400 hover:text-gray-200 px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 transition"
                        >
                            Xóa log
                        </button>
                    )}
                </div>
            </div>

            {/* Logs List Area */}
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-1.5 pr-1 max-h-[160px]">
                {logs.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 text-xs italic flex flex-col items-center gap-1.5">
                        <Bot size={22} className="text-gray-600" />
                        <span>Chưa có nhật ký Auto Trade. Bật Auto Trade để tự động quét tín hiệu và gửi order khi nến đóng.</span>
                    </div>
                ) : (
                    logs.map((log) => {
                        const isSuccess = log.type === 'success';
                        const isError = log.type === 'error';
                        const isWarn = log.type === 'warn';
                        const isScan = log.type === 'scan';

                        return (
                            <div
                                key={log.id}
                                className={`text-xs p-2 rounded border flex items-start gap-2 transition ${
                                    isSuccess
                                        ? 'bg-emerald-950/30 border-emerald-600/40 text-emerald-200'
                                        : isError
                                        ? 'bg-red-950/30 border-red-600/40 text-red-200'
                                        : isWarn
                                        ? 'bg-amber-950/30 border-amber-600/40 text-amber-200'
                                        : isScan
                                        ? 'bg-blue-950/30 border-blue-600/40 text-blue-200'
                                        : 'bg-gray-900/40 border-gray-800 text-gray-300'
                                }`}
                            >
                                <span className="font-mono text-[10px] text-gray-500 shrink-0 mt-0.5">{log.time}</span>
                                <div className="shrink-0 mt-0.5">
                                    {isSuccess && <CheckCircle2 size={13} className="text-emerald-400" />}
                                    {isError && <XCircle size={13} className="text-red-400" />}
                                    {isWarn && <AlertTriangle size={13} className="text-amber-400" />}
                                    {isScan && <Zap size={13} className="text-blue-400" />}
                                    {!isSuccess && !isError && !isWarn && !isScan && <Info size={13} className="text-gray-400" />}
                                </div>
                                <div className="flex-1 leading-relaxed font-mono text-[11px] break-words">
                                    {log.message}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};

export default AutoTradeLogPanel;
