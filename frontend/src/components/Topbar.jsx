import React from 'react';
import { Search, Bell, Settings } from 'lucide-react';
import GlobalWatchlist from './GlobalWatchlist';

const Topbar = () => {
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

            <div className="flex items-center gap-4">
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
