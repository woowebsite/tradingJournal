import React, { useState } from 'react';
import { Activity, Sparkles, TrendingUp, Bot } from 'lucide-react';
import RecentTradeBox from '../RecentTradeBox';
import TCBSRecommendPanel from '../TCBSRecommendPanel';
import TCBSSignalPanel from '../TCBSSignalPanel';
import StrategySummary from '../StrategySummary';
import AutoTradeLogPanel from '../AutoTradeLogPanel';
import dayjs from 'dayjs';

const StrategyPanel = ({ 
    activeStrategy, 
    trades, 
    onTradeClick, 
    signals = [], 
    recommendations = [], 
    tcbsSignals = [], 
    loadingTcbsInsights = false,
    selectedTemplate = null,
    onAutoTrade = null,
    autoTrading = false,
    isAutoTradeEnabled = false,
    onToggleAutoTrade = () => {},
    autoTradeLogs = [],
    isScanningOnCandleClose = false,
    selectedSymbol = null,
    timeframe = 'D1',
    onClearLogs = () => {}
}) => {
    const [activeTab, setActiveTab] = useState('summary');

    return (
        <div className="h-72 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col shrink-0">
            <div className="flex border-b border-gray-700 bg-gray-900/50">
                <div className={`flex-1 flex items-center ${activeTab === 'summary' ? 'border-b-2 border-blue-500 bg-gray-800/50' : ''}`}>
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`flex-1 py-3 px-2 cursor-pointer text-sm font-bold transition flex justify-start items-center gap-2 ${activeTab === 'summary' ? 'text-white' : 'text-gray-400 hover:text-gray-200'}`}
                    >
                        <Activity size={14} className={activeTab === 'summary' ? 'text-purple-400' : 'text-gray-500'} />
                        Strategy
                    </button>
                </div>
                <button
                    onClick={() => setActiveTab('autotrade')}
                    className={`flex-1 py-3 px-2 cursor-pointer text-sm font-bold transition flex justify-start items-center gap-2 ${activeTab === 'autotrade' ? 'text-white border-b-2 border-emerald-500 bg-gray-800/50' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    <div className="relative">
                        <Bot size={14} className={isAutoTradeEnabled ? 'text-emerald-400' : activeTab === 'autotrade' ? 'text-emerald-300' : 'text-gray-500'} />
                        {isAutoTradeEnabled && (
                            <span className="absolute -top-1 -right-1 flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                            </span>
                        )}
                    </div>
                    <span>Auto Trade ({autoTradeLogs.length})</span>
                </button>
                <button
                    onClick={() => setActiveTab('signals')}
                    className={`flex-1 py-3 px-2 cursor-pointer text-sm font-bold transition flex justify-start items-center gap-2 ${activeTab === 'signals' ? 'text-white border-b-2 border-blue-500 bg-gray-800/50' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    <Activity size={14} className={activeTab === 'signals' ? 'text-purple-400' : 'text-gray-500'} />
                    Signals ({signals ? signals.length : 0})
                </button>
                <button
                    onClick={() => setActiveTab('trades')}
                    className={`flex-1 py-3 px-2 cursor-pointer text-sm font-bold transition flex justify-start items-center gap-2 ${activeTab === 'trades' ? 'text-white border-b-2 border-blue-500 bg-gray-800/50' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    <Activity size={14} className={activeTab === 'trades' ? 'text-blue-400' : 'text-gray-500'} />
                    Recent Trades ({trades ? trades.length : 0})
                </button>
                <button
                    onClick={() => setActiveTab('recommendation')}
                    className={`flex-1 py-3 px-2 cursor-pointer text-sm font-bold transition flex justify-start items-center gap-2 ${activeTab === 'recommendation' ? 'text-white border-b-2 border-blue-500 bg-gray-800/50' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    <Sparkles size={14} className={activeTab === 'recommendation' ? 'text-amber-300' : 'text-gray-500'} />
                    Recommends ({recommendations.length})
                </button>
                <button
                    onClick={() => setActiveTab('tcbsSignals')}
                    className={`flex-1 py-3 px-2 cursor-pointer text-sm font-bold transition flex justify-start items-center gap-2 ${activeTab === 'tcbsSignals' ? 'text-white border-b-2 border-blue-500 bg-gray-800/50' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    <TrendingUp size={14} className={activeTab === 'tcbsSignals' ? 'text-green-400' : 'text-gray-500'} />
                    TCB Signals ({tcbsSignals.length})
                </button>
            </div>
            <div className="p-2 overflow-y-auto custom-scrollbar flex-1 text-sm text-gray-300">
                {activeTab === 'summary' ? (
                    <StrategySummary
                        activeStrategy={activeStrategy}
                        trades={trades}
                        selectedTemplate={selectedTemplate}
                        onAutoTrade={onAutoTrade}
                        autoTrading={autoTrading}
                        isAutoTradeEnabled={isAutoTradeEnabled}
                        onToggleAutoTrade={onToggleAutoTrade}
                        isScanningOnCandleClose={isScanningOnCandleClose}
                        autoTradeLogsCount={autoTradeLogs.length}
                        onSwitchToLogs={() => setActiveTab('autotrade')}
                    />
                ) : activeTab === 'autotrade' ? (
                    <AutoTradeLogPanel
                        isAutoTradeEnabled={isAutoTradeEnabled}
                        onToggleAutoTrade={onToggleAutoTrade}
                        logs={autoTradeLogs}
                        isScanning={isScanningOnCandleClose}
                        selectedSymbol={selectedSymbol}
                        selectedTemplate={selectedTemplate}
                        timeframe={timeframe}
                        onClearLogs={onClearLogs}
                    />
                ) : activeTab === 'signals' ? (
                    <div className="text-sm text-gray-300 p-1">
                        {(!signals || signals.length === 0) ? (
                            <p className="text-gray-500 italic text-center mt-4">Chưa có tín hiệu khớp lệnh (Trade / TradeDetail) nào cho mã này.</p>
                        ) : (
                            <ul className="space-y-2">
                                {signals.map((signal, i) => {
                                    const isBuy = signal.shape === 'arrowUp' || signal.type === 'entry' && signal.posType === 'Long';
                                    const isTP = signal.type === 'takeprofit' || signal.action?.toLowerCase().includes('take');
                                    const isSL = signal.type === 'stoploss' || signal.action?.toLowerCase().includes('stop');
                                    const badgeColor = isTP ? 'bg-blue-500/20 text-blue-300 border-blue-500/40' :
                                                       isSL ? 'bg-red-500/20 text-red-300 border-red-500/40' :
                                                       isBuy ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' :
                                                       'bg-amber-500/20 text-amber-300 border-amber-500/40';
                                    return (
                                        <li key={signal.id || i} className="border-b border-gray-700/50 pb-2 last:border-0">
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className={`px-1.5 py-0.5 rounded text-[11px] font-bold border ${badgeColor}`}>
                                                        {signal.action || signal.posType || 'Signal'}
                                                    </span>
                                                    <span className="font-semibold text-gray-200 text-xs">
                                                        {signal.text || signal.name || 'Executed Trade'}
                                                    </span>
                                                </div>
                                                {signal.status && (
                                                    <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${
                                                        signal.status === 'Open' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-gray-800 text-gray-400'
                                                    }`}>
                                                        {signal.status}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between text-[11px] text-gray-400 mt-1">
                                                <span>{signal.volume ? `Khối lượng: ${signal.volume}` : ''} {signal.price ? `| Giá: $${signal.price}` : ''}</span>
                                                {signal.date && <span className="font-mono text-gray-500">{dayjs(signal.date).format('YYYY-MM-DD HH:mm:ss')}</span>}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                ) : activeTab === 'trades' ? (
                    <RecentTradeBox trades={trades || []} onTradeClick={onTradeClick} />
                ) : activeTab === 'recommendation' ? (
                    <TCBSRecommendPanel recommendations={recommendations} loading={loadingTcbsInsights} />
                ) : (
                    <TCBSSignalPanel signals={tcbsSignals} loading={loadingTcbsInsights} />
                )}
            </div>
        </div>
    );
};

export default StrategyPanel;

