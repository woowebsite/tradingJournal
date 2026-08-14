import React, { useState, useRef, useEffect } from 'react';
import { List as ListIcon } from 'lucide-react';
import { useAccount } from '../context/AccountContext';
import { useDispatch } from 'react-redux';
import { fetchSymbols } from '../features/symbolSlice';
import { useNavigate } from 'react-router-dom';
import WatchlistSelector from './WatchlistSelector';

const GlobalWatchlist = () => {
    const dispatch = useDispatch();
    const { selectedAccount } = useAccount();
    const [searchTerm, setSearchTerm] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const navigate = useNavigate();
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        const marketId = selectedAccount?.market?.documentId || selectedAccount?.market?.id;
        dispatch(fetchSymbols(marketId));
    }, [dispatch, isOpen, selectedAccount?.market?.documentId, selectedAccount?.market?.id]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="relative" ref={dropdownRef}>
            <div
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition border border-gray-700 bg-gray-900 ${isOpen ? 'ring-1 ring-blue-500 text-white' : 'text-gray-400 hover:text-white cursor-pointer'}`}
                onClick={() => setIsOpen(true)}
            >
                <input
                    type="text"
                    placeholder="Watchlist..."
                    value={searchTerm}
                    onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setIsOpen(true);
                    }}
                    onFocus={() => setIsOpen(true)}
                    className="bg-transparent border-none outline-none text-sm text-gray-200 w-32 cursor-text transition-all"
                />
                <ListIcon size={16} className={isOpen ? 'text-blue-400' : 'text-gray-500'} />
            </div>

            {isOpen && (
                <div className="absolute right-0 top-full mt-4 w-80 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl flex flex-col z-50 max-h-[70vh] overflow-hidden p-3 bg-gray-800/95 backdrop-blur-sm">
                    <WatchlistSelector
                        className="justify-between"
                        showSymbols={true}
                        searchTerm={searchTerm}
                        onSymbolClick={(symbol) => {
                            navigate(`/trade-station?symbol=${symbol.Name}`);
                            setIsOpen(false);
                        }}
                    />
                </div>
            )}
        </div>
    );
};

export default GlobalWatchlist;
