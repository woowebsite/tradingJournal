import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import TradeModal from '../components/TradeModal';
import { useAccount } from '../context/AccountContext';
import { useSidebar } from '../context/SidebarContext';
import { fetchTrades, saveTrade } from '../features/tradeSlice';
import clsx from 'clsx';

const MainLayout = () => {
    const dispatch = useDispatch();
    const { selectedAccount } = useAccount();
    const { isCollapsed } = useSidebar();
    const [isTradeModalOpen, setIsTradeModalOpen] = useState(false);

    const handleOpenNewTrade = () => {
        setIsTradeModalOpen(true);
    };

    const handleCloseTradeModal = () => {
        setIsTradeModalOpen(false);
    };

    const handleSaveTrade = async (tradeData) => {
        try {
            await dispatch(saveTrade({ tradeData, tradeToEdit: null })).unwrap();

            if (selectedAccount) {
                const accountId = selectedAccount.documentId || selectedAccount.id;
                dispatch(fetchTrades({ accountId }));
            }

            setIsTradeModalOpen(false);
        } catch (error) {
            console.error('Error saving trade from topbar:', error);
            alert(`Failed to save trade: ${error.message || error}`);
        }
    };

    return (
        <div className="flex bg-gray-900 min-h-screen text-gray-100">
            <Sidebar />
            <Topbar onNewTrade={handleOpenNewTrade} />
            <div className={clsx(
                'flex-1 mt-16 p-6 sm:p-8 overflow-y-auto h-[calc(100vh-4rem)] transition-all duration-300 ease-in-out',
                isCollapsed ? 'ml-16' : 'ml-64'
            )}>
                <Outlet />
            </div>
            <TradeModal
                isOpen={isTradeModalOpen}
                onClose={handleCloseTradeModal}
                onSubmit={handleSaveTrade}
            />
        </div>
    );
};

export default MainLayout;
