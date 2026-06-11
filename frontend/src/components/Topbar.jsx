import React from 'react';
import clsx from 'clsx';
import { Link, useLocation } from 'react-router-dom';
import { Search, Bell, Settings, Clock3, NotebookPen, Plus } from 'lucide-react';
import GlobalWatchlist from './GlobalWatchlist';

const Topbar = ({ onNewTrade }) => {
    const location = useLocation();

    const topNavItems = [
        { label: 'Today', path: '/today-trades', icon: Clock3 },
        { label: 'Plans', path: '/journal-plan', icon: NotebookPen }
    ];

    return (
        <div className="h-16 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6 fixed top-0 right-0 left-64 z-20">
            <div className="flex bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 items-center w-64">
                <Search size={16} className="text-gray-500 mr-2" />
                <input
                    type="text"
                    placeholder="Search anything..."
                    className="bg-transparent border-none outline-none text-sm text-gray-200 w-full"
                />
            </div>

            <nav className="hidden lg:flex items-center gap-2">
                {topNavItems.map(item => {
                    const active = location.pathname === item.path;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={clsx(
                                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition border-gray-700 bg-gray-900 text-gray-300 hover:border-gray-600 hover:bg-gray-800 hover:text-white'
                            )}
                        >
                            <Icon size={14} />
                            {item.label}
                        </Link>
                    );
                })}
                <button
                    type="button"
                    onClick={onNewTrade}
                    className="inline-flex items-center gap-1.5 rounded-full border border-gray-700 bg-gray-900 px-3 py-1.5 text-sm font-medium text-gray-300 transition hover:border-gray-600 hover:bg-gray-800 hover:text-white cursor-pointer"
                >
                    <Plus size={14} className="text-blue-400" />
                    New Trade
                </button>
            </nav>

            <div className="flex items-center gap-3">
                

                <GlobalWatchlist />

                <div className="h-6 w-[1px] bg-gray-700 mx-1"></div>

                <button className="text-gray-400 hover:text-white transition relative">
                    <Bell size={18} />
                    <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 border-2 border-gray-800 rounded-full"></span>
                </button>
                <button className="text-gray-400 hover:text-white transition">
                    <Settings size={18} />
                </button>
                <div className="h-6 w-[1px] bg-gray-700 mx-1"></div>
                <button className="flex items-center gap-2 hover:bg-gray-700 p-1 pr-3 rounded-full transition">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-md">
                        JD
                    </div>
                </button>
            </div>
        </div>
    );
};

export default Topbar;
