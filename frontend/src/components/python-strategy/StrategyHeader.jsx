import React from 'react';
import { Link } from 'react-router-dom';
import { BrainCircuit, BarChart3, Activity } from 'lucide-react';

const StrategyHeader = ({ selectedAccount, selectedSymbol }) => {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800 pb-4">
            <div>
                <div className="flex items-center gap-2">
                    <div className="p-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 shadow-lg shadow-purple-500/10">
                        <BrainCircuit size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                            Python Strategy
                            <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 font-medium border border-purple-500/30">
                                1 Entry 1 Lúc
                            </span>
                        </h1>
                        <p className="text-sm text-gray-400 mt-0.5">
                            Quét tín hiệu và mô phỏng chu kỳ lệnh (Entry ➔ TP/SL ➔ Tìm Entry mới) trực tiếp từ Python
                        </p>
                    </div>
                </div>
            </div>

            {/* Account badge, Strategy Insight link & Trade Station link */}
            <div className="flex items-center gap-2.5 self-start md:self-auto flex-wrap">
                {selectedAccount && (
                    <div className="flex items-center gap-2 bg-gray-800/80 border border-gray-700/60 rounded-xl px-3.5 py-2 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span className="text-xs text-gray-400">Tài khoản:</span>
                        <span className="text-xs font-semibold text-gray-200">{selectedAccount.Name || selectedAccount.name}</span>
                    </div>
                )}
                <Link
                    to={selectedSymbol ? `/strategy-insight?symbol=${encodeURIComponent(selectedSymbol)}` : "/strategy-insight"}
                    className="px-3.5 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/30 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                    title={selectedSymbol ? `Chuyển tới Strategy Insight với mã ${selectedSymbol}` : "Chuyển tới Strategy Insight"}
                >
                    <Activity size={14} />
                    <span>Strategy Insight</span>
                </Link>
                <Link
                    to={selectedSymbol ? `/trade-station?symbol=${encodeURIComponent(selectedSymbol)}` : "/trade-station"}
                    className="px-3.5 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center gap-1.5 transition shadow-sm"
                    title={selectedSymbol ? `Chuyển tới Trade Station với mã ${selectedSymbol}` : "Chuyển tới Trade Station"}
                >
                    <BarChart3 size={14} />
                    <span>Trade Station</span>
                </Link>
            </div>
        </div>
    );
};

export default StrategyHeader;
