
import { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchWatchlists } from '../features/watchlistSlice';
import { fetchSymbols } from '../features/symbolSlice';
import api from '../services/api';

const AccountContext = createContext();

export const useAccount = () => useContext(AccountContext);

export const AccountProvider = ({ children }) => {
    const dispatch = useDispatch();
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [loading, setLoading] = useState(true);
    const { items: symbols } = useSelector(state => state.symbols);
    const { items: watchlists } = useSelector(state => state.watchlists);

    useEffect(() => {
        dispatch(fetchWatchlists());
    }, [dispatch]);

    useEffect(() => {
        const fetchAccounts = async () => {
            try {
                const res = await api.get('/accounts?populate=*');
                const data = res.data.data || [];
                const formattedAccounts = data.map(item => ({
                    id: item.id || item.documentId,
                    ...item
                }));

                setAccounts(formattedAccounts);

                // Default to first account if none selected
                if (formattedAccounts.length > 0 && !selectedAccount) {
                    setSelectedAccount(formattedAccounts[0]);
                }
            } catch (error) {
                console.error('Failed to fetch accounts:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchAccounts();
    }, []);

    useEffect(() => {
        if (selectedAccount?.market) {
            const marketId = selectedAccount.market.documentId || selectedAccount.market.id;
            dispatch(fetchSymbols(marketId));
        } else {
            dispatch(fetchSymbols());
        }
    }, [dispatch, selectedAccount]);

    const accountSymbols = useMemo(() => {
        if (!symbols || symbols.length === 0) return [];

        return symbols.filter(s => {
            if (selectedAccount?.market) {
                const accountMarketId = selectedAccount.market.id || selectedAccount.market.documentId;
                if (s.market && (s.market.id === accountMarketId || s.market.documentId === accountMarketId)) return true;
                if (s.markets && Array.isArray(s.markets)) {
                    return s.markets.some(m => m.id === accountMarketId || m.documentId === accountMarketId);
                }
                return false;
            }
            return true;
        });
    }, [symbols, selectedAccount]);

    const defaultWatchlist = useMemo(() => {
        if (!watchlists || watchlists.length === 0 || !selectedAccount) return null;
        return watchlists.find(wl => {
            const accId = wl.account?.documentId || wl.account?.id;
            const currentAccId = selectedAccount.documentId || selectedAccount.id;
            // Match account ID and checks isDefault
            return (accId === currentAccId) && wl.isDefault === true;
        });
    }, [watchlists, selectedAccount]);

    return (
        <AccountContext.Provider value={{ accounts, selectedAccount, setSelectedAccount, loading, accountSymbols, defaultWatchlist }}>
            {children}
        </AccountContext.Provider>
    );
};
