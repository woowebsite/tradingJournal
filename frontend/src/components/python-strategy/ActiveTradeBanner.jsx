import React from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { formatNumber } from '../../utils/formatNumber';
import dayjs from 'dayjs';

const ActiveTradeBanner = ({ activeTrade, ticker }) => {
    if (!activeTrade) return null;

    return (
        <div className="bg-gradient-to-r from-gray-800/90 via-gray-800/70 to-gray-800/90 border border-gray-700 rounded-2xl p-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Lệnh đang giữ:</span>
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        activeTrade.type === 'Long'
                            ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                            : 'bg-red-500/20 text-red-300 border border-red-500/30'
                    }`}>
                        {activeTrade.type.toUpperCase()} (#{activeTrade.trade_no})
                    </span>
                    <span className="text-xs text-gray-400">
                        ({dayjs(activeTrade.entry_date).format('YYYY-MM-DD')})
                    </span>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-gray-300">Entry: <b className="text-white">{formatNumber(activeTrade.entry_price)}</b></span>
                    <span className="text-red-300">SL: <b className="text-red-400">{formatNumber(activeTrade.stop_loss)}</b></span>
                    <span className="text-emerald-300">
                        TP {activeTrade.risk_reward ? `(${activeTrade.risk_reward}R)` : ''}: <b className="text-emerald-400">{formatNumber(activeTrade.take_profit)}</b>
                    </span>
                </div>
            </div>

            <Link
                to={`/trade-station?symbol=${encodeURIComponent(ticker || '')}&price=${activeTrade.entry_price}&slPrice=${activeTrade.stop_loss}&tpPrice=${activeTrade.take_profit}`}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl transition shadow-md shadow-blue-600/20 cursor-pointer self-start md:self-auto"
            >
                <span>Mở trên Trade Station</span>
                <ExternalLink size={14} />
            </Link>
        </div>
    );
};

export default ActiveTradeBanner;
