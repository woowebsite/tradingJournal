import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import dayjs from 'dayjs';
import RecentTradeBox from '../components/RecentTradeBox';

const SignalPanel = ({ trades, signals }) => {
    const [activeTab, setActiveTab] = useState('trades');

    return (
        <div className="w-80 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col mt-4 flex-shrink-0 min-h-[300px]">
            <div className="flex border-b border-gray-700 bg-gray-900/50">
                <button
                    onClick={() => setActiveTab('trades')}
                    className={`flex-1 p-2 text-center text-sm font-semibold transition flex items-center justify-center gap-1.5 ${activeTab === 'trades' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
                    title="Recent Trades"
                >
                    <Activity size={14} />
                    Recent Trades
                </button>
                <button
                    onClick={() => setActiveTab('signals')}
                    className={`flex-1 p-2 text-center text-sm font-semibold transition flex items-center justify-center gap-1.5 ${activeTab === 'signals' ? 'bg-gray-800 text-purple-400 border-b-2 border-purple-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
                    title="Signals"
                >
                    <Activity size={14} />
                    Signals
                </button>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                {activeTab === 'trades' && (
                    <div className="text-sm text-gray-300">
                        <RecentTradeBox trades={trades} onTradeClick={(trade) => console.log('Trade clicked:', trade)} />
                    </div>
                )}
                {activeTab === 'signals' && (
                    <div className="text-sm text-gray-300">
                        {(!signals || signals.length === 0) ? (
                            <p className="text-gray-500 italic text-center mt-4">No signals available.</p>
                        ) : (
                            <ul className="space-y-2">
                                {signals.map((signal, i) => (
                                    <li key={i} className="border-b border-gray-700 pb-1">
                                        {signal.type || signal.name || 'Unknown'}
                                        <div>
                                            {signal.date && <span className="text-xs text-gray-500">{dayjs(signal.date).format('YYYY-MM-DD HH:mm')}</span>}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SignalPanel;
