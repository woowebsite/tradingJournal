import { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchWatchlists } from '../features/watchlistSlice';
import { fetchSymbols } from '../features/symbolSlice';
import api from '../services/api';

const AccountContext = createContext();
const DEFAULT_ACCOUNT_STORAGE_KEY = 'trading_journal_default_account_id';

export const useAccount = () => useContext(AccountContext);

export const AccountProvider = ({ children }) => {
    const dispatch = useDispatch();
    const [accounts, setAccounts] = useState([]);
    const [selectedAccount, setSelectedAccount] = useState(null);
    const [defaultAccountId, setDefaultAccountIdState] = useState(() =>
        localStorage.getItem(DEFAULT_ACCOUNT_STORAGE_KEY) || ''
    );
    const [selectedWatchlist, setSelectedWatchlist] = useState(null);
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
                    ...item,
                    id: item.documentId || item.id,
                    rawId: item.id,
                    documentId: item.documentId || item.id,
                }));

                setAccounts(formattedAccounts);

                const savedDefaultId = localStorage.getItem(DEFAULT_ACCOUNT_STORAGE_KEY);
                const defaultAccount = formattedAccounts.find(account =>
                    savedDefaultId && (
                        String(account.documentId) === String(savedDefaultId) ||
                        String(account.id) === String(savedDefaultId) ||
                        (account.rawId !== undefined && String(account.rawId) === String(savedDefaultId))
                    )
                );

                if (defaultAccount) {
                    const canonicalId = String(defaultAccount.documentId || defaultAccount.id);
                    setDefaultAccountIdState(canonicalId);
                    setSelectedAccount(defaultAccount);
                } else if (formattedAccounts.length > 0) {
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

    const setDefaultAccountId = (accountId) => {
        const normalizedId = accountId ? String(accountId) : '';
        setDefaultAccountIdState(normalizedId);

        if (normalizedId) {
            localStorage.setItem(DEFAULT_ACCOUNT_STORAGE_KEY, normalizedId);
        } else {
            localStorage.removeItem(DEFAULT_ACCOUNT_STORAGE_KEY);
        }
    };

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
                const accountMarketId = String(selectedAccount.market.documentId || selectedAccount.market.id || '');
                if (!accountMarketId) return true;

                const symMarketId = String(s.market?.documentId || s.market?.id || (typeof s.market === 'string' || typeof s.market === 'number' ? s.market : '') || '');
                if (symMarketId && symMarketId === accountMarketId) return true;

                if (s.markets && Array.isArray(s.markets)) {
                    return s.markets.some(m => {
                        const mId = String(m?.documentId || m?.id || (typeof m === 'string' || typeof m === 'number' ? m : '') || '');
                        return mId && mId === accountMarketId;
                    });
                }
                return false;
            }
            return true;
        });
    }, [symbols, selectedAccount]);

    const defaultWatchlist = useMemo(() => {
        if (!watchlists || watchlists.length === 0 || !selectedAccount) return null;
        return watchlists.find(wl => {
            const accId = String(wl.account?.documentId || wl.account?.id || '');
            const currentAccId = String(selectedAccount.documentId || selectedAccount.id || '');
            return (accId === currentAccId) && wl.isDefault === true;
        });
    }, [watchlists, selectedAccount]);

    const accountWatchlists = useMemo(() => {
        if (!watchlists || !selectedAccount) return [];
        const currentAccountId = String(selectedAccount.documentId || selectedAccount.id || '');
        return watchlists.filter(watchlist => {
            const accId = String(watchlist.account?.documentId || watchlist.account?.id || '');
            return accId === currentAccountId;
        });
    }, [watchlists, selectedAccount]);

    useEffect(() => {
        const selectedId = selectedWatchlist?.documentId || selectedWatchlist?.id;
        const stillAvailable = accountWatchlists.find(watchlist =>
            (watchlist.documentId || watchlist.id) === selectedId
        );
        if (stillAvailable) {
            if (stillAvailable !== selectedWatchlist) setSelectedWatchlist(stillAvailable);
            return;
        }
        setSelectedWatchlist(accountWatchlists.find(watchlist => watchlist.isDefault) || accountWatchlists[0] || null);
    }, [accountWatchlists, selectedWatchlist]);

    return (
        <AccountContext.Provider value={{
            accounts,
            selectedAccount,
            setSelectedAccount,
            defaultAccountId,
            setDefaultAccountId,
            loading,
            accountSymbols,
            defaultWatchlist,
            accountWatchlists,
            selectedWatchlist,
            setSelectedWatchlist,
        }}>
            {children}
        </AccountContext.Provider>
    );
};
