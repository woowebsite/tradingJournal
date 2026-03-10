import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import IndicatorTable from '../components/IndicatorTable';

const TechnicalPanel = ({ externalIndicators }) => {
    const [activeTab, setActiveTab] = useState('technical');

    return (
        <div className="w-80 bg-gray-800 rounded-xl border border-gray-700 overflow-hidden shadow-lg flex flex-col">
            <div className="flex border-b border-gray-700 bg-gray-900/50">
                <button
                    onClick={() => setActiveTab('technical')}
                    className={`flex-1 p-2 text-center text-sm font-semibold transition flex items-center justify-center gap-1.5 ${activeTab === 'technical' ? 'bg-gray-800 text-blue-400 border-b-2 border-blue-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
                    title="Technical Indicators"
                >
                    <Activity size={14} />
                    Indicators
                </button>
                <button
                    onClick={() => setActiveTab('ma')}
                    className={`flex-1 p-2 text-center text-sm font-semibold transition flex items-center justify-center gap-1.5 ${activeTab === 'ma' ? 'bg-gray-800 text-green-400 border-b-2 border-green-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
                    title="Moving Average"
                >
                    <Activity size={14} />
                    MA
                </button>
                <button
                    onClick={() => setActiveTab('summary')}
                    className={`flex-1 p-2 text-center text-sm font-semibold transition flex items-center justify-center gap-1.5 ${activeTab === 'summary' ? 'bg-gray-800 text-orange-400 border-b-2 border-orange-400' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'}`}
                    title="Summary"
                >
                    <Activity size={14} />
                    Summary
                </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {activeTab === 'technical' && (
                    <IndicatorTable indicators={(() => {
                        if (!externalIndicators || !externalIndicators.indicator) return [];
                        const indObj = externalIndicators.indicator;
                        const list = [];
                        Object.keys(indObj).forEach(key => {
                            if (key === 'ticker' || key === 'signal') return;
                            const item = indObj[key];
                            if (item && typeof item === 'object') {
                                list.push({
                                    indicator: key.toUpperCase(),
                                    signal: item.signal,
                                    value: item.value
                                });
                            }
                        });
                        return list;
                    })()} />
                )}
                {activeTab === 'ma' && (
                    <IndicatorTable indicators={(() => {
                        if (!externalIndicators || !externalIndicators.simple) return [];
                        const indObj = externalIndicators.simple;
                        const list = [];
                        Object.keys(indObj).forEach(key => {
                            if (key === 'ticker' || key === 'signal') return;
                            const item = indObj[key];
                            if (item && typeof item === 'object') {
                                list.push({
                                    indicator: key.toUpperCase(),
                                    signal: item.signal,
                                    value: item.value
                                });
                            }
                        });
                        return list;
                    })()} />
                )}
                {activeTab === 'summary' && (
                    <IndicatorTable indicators={(() => {
                        if (!externalIndicators || !externalIndicators.summary) return [];
                        const sumObj = externalIndicators.summary;
                        const list = [];
                        list.push({ indicator: 'Buy Count', value: sumObj.buy, signal: 'Buy' });
                        list.push({ indicator: 'Sell Count', value: sumObj.sell, signal: 'Sell' });
                        list.push({ indicator: 'Neutral Count', value: sumObj.neutral, signal: 'Neutral' });
                        list.push({ indicator: 'Overall Signal', signal: sumObj.signal, value: '' });
                        return list;
                    })()} />
                )}
            </div>
        </div>
    );
};

export default TechnicalPanel;
