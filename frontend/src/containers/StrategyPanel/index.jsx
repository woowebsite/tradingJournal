import React, { useState } from 'react';
import { Activity, Sparkles, TrendingUp } from 'lucide-react';
import RecentTradeBox from '../RecentTradeBox';
import TCBSRecommendPanel from '../TCBSRecommendPanel';
import TCBSSignalPanel from '../TCBSSignalPanel';
import StrategySummary from '../StrategySummary';

const StrategyPanel = ({ activeStrategy, allSignals, trades, recommendations = [], tcbsSignals = [], loadingTcbsInsights = false }) => {
    const [activeTab, setActiveTab] = useState('summary');

    return (
        <div className="h-60 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col shrink-0">
            <div className="flex border-b border-gray-700 bg-gray-900/50">
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex-1 py-3 px-2 cursor-pointer text-sm font-bold transition flex justify-start items-center gap-2 ${activeTab === 'summary' ? 'text-white border-b-2 border-blue-500 bg-gray-800/50' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    <Activity size={14} className={activeTab === 'summary' ? 'text-purple-400' : 'text-gray-500'} />
                    Strategy Summary
                </button>
                <button
                    onClick={() => setActiveTab('trades')}
                    className={`flex-1 py-3 px-2 cursor-pointer text-sm font-bold transition flex justify-start items-center gap-2 ${activeTab === 'trades' ? 'text-white border-b-2 border-blue-500 bg-gray-800/50' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    Recent Trades ({trades ? trades.length : 0})
                </button>
                <button
                    onClick={() => setActiveTab('recommendation')}
                    className={`flex-1 py-3 px-2 cursor-pointer text-sm font-bold transition flex justify-start items-center gap-2 ${activeTab === 'recommendation' ? 'text-white border-b-2 border-blue-500 bg-gray-800/50' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    <Sparkles size={14} className={activeTab === 'recommendation' ? 'text-amber-300' : 'text-gray-500'} />
                    Recommendation ({recommendations.length})
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
                        allSignals={allSignals}
                    />
                ) : activeTab === 'trades' ? (
                    <RecentTradeBox trades={trades || []} onTradeClick={(trade) => console.log('Clicked trade:', trade)} />
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
