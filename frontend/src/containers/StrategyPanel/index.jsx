import React, { useState } from 'react';
import { Activity, Sparkles, TrendingUp } from 'lucide-react';
import RecentTradeBox from '../RecentTradeBox';
import TCBSRecommendPanel from '../TCBSRecommendPanel';
import TCBSSignalPanel from '../TCBSSignalPanel';
import StrategySummary from '../StrategySummary';
import dayjs from 'dayjs';

const StrategyPanel = ({ activeStrategy, trades, onTradeClick, signals = [], recommendations = [], tcbsSignals = [], loadingTcbsInsights = false }) => {
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
                    />
                ) : activeTab === 'signals' ? (
                    <div className="text-sm text-gray-300 p-1">
                        {(!signals || signals.length === 0) ? (
                            <p className="text-gray-500 italic text-center mt-4">No signals available.</p>
                        ) : (
                            <ul className="space-y-2">
                                {signals.map((signal, i) => (
                                    <li key={i} className="border-b border-gray-700/50 pb-1.5 last:border-0">
                                        <div className="font-semibold text-gray-200">{signal.type || signal.name || 'Unknown'}</div>
                                        <div>
                                            {signal.date && <span className="text-xs text-gray-500">{dayjs(signal.date).format('YYYY-MM-DD HH:mm')}</span>}
                                        </div>
                                    </li>
                                ))}
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
