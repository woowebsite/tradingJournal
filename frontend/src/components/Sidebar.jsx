import { useState } from 'react';
import { LayoutDashboard, ReceiptText, NotebookPen, Settings, ChevronDown, Wallet, LineChart, Activity, BrainCircuit, BarChart2, List, Tag, TrendingUp, ChevronRight, Webhook } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAccount } from '../context/AccountContext';
import clsx from 'clsx';

const Sidebar = () => {
    const location = useLocation();
    const { accounts, selectedAccount, setSelectedAccount, loading } = useAccount();

    const menuGroups = [
        {
            label: 'Menu',
            items: [
                { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
                {
                    icon: BarChart2, label: 'Trade Station', path: '/trade-station',
                    subItems: [
                        { label: 'Today', path: '/today-trades' }
                    ]
                },
                { icon: TrendingUp, label: 'Derivation', path: '/derivation' },
                {
                    icon: NotebookPen,
                    label: 'Journal',
                    path: '/journal',
                    subItems: [
                        { label: 'Trades', path: '/trades' },
                        { label: 'Journal', path: '/journal-trade' }
                    ]
                },
                { icon: Activity, label: 'Signals', path: '/signals' },
                { icon: List, label: 'Watchlists', path: '/manage-watchlists' },
                { icon: Tag, label: 'Symbols', path: '/manage-symbols' },
                { icon: Wallet, label: 'Accounts', path: '/accounts' },
            ]
        },
        {
            label: 'Management',
            items: [
                { icon: LineChart, label: 'Market', path: '/manage-market' },
                { icon: BrainCircuit, label: 'Strategies', path: '/manage-strategies' },
                { icon: Activity, label: 'Rules', path: '/manage-rules' },
                {
                    icon: Webhook,
                    label: 'Webhooks',
                    path: '/webhooks',
                    subItems: [
                        { label: 'Manage', path: '/manage-webhooks' },
                        { label: 'Signals', path: '/webhook-signals' }
                    ]
                },
            ]
        },
        {
            label: 'System',
            items: [
                { icon: Settings, label: 'Settings', path: '/settings' },
            ]
        }
    ];

    const [expandedItems, setExpandedItems] = useState(['/journal', '/webhooks', '/trade-station']);

    const toggleExpand = (path) => {
        setExpandedItems(prev =>
            prev.includes(path)
                ? prev.filter(p => p !== path)
                : [...prev, path]
        );
    };

    return (
        <div className="w-64 h-screen fixed left-0 top-0 bg-gray-800 border-r border-gray-700 p-4 flex flex-col overflow-y-auto">
            <div className="mb-4 flex items-center justify-center">
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                    TradeJournal
                </h1>
            </div>

            <div className="mb-4">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 block">
                    Active Account
                </label>
                <div className="relative">
                    <select
                        value={selectedAccount?.id || ''}
                        onChange={(e) => {
                            const acc = accounts.find(a => (a.id || a.documentId).toString() === e.target.value);
                            setSelectedAccount(acc);
                        }}
                        className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-lg pl-10 pr-8 py-2.5 appearance-none focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none cursor-pointer"
                        disabled={loading}
                    >
                        {loading && <option>Loading...</option>}
                        {!loading && accounts.length === 0 && <option value="">No Accounts</option>}
                        {accounts.map(acc => (
                            <option key={acc.id} value={acc.id || acc.documentId}>
                                {acc.name}
                            </option>
                        ))}
                    </select>
                    <Wallet size={16} className="absolute left-3 top-3 text-gray-500 pointer-events-none" />
                    <ChevronDown size={16} className="absolute right-3 top-3 text-gray-500 pointer-events-none" />
                </div>
            </div>

            <nav className="flex-1 space-y-3">
                {menuGroups.map((group, groupIndex) => (
                    <div key={groupIndex}>
                        {group.label && (
                            <div className="px-4 mb-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                {group.label}
                            </div>
                        )}
                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const isExpanded = expandedItems.includes(item.path);
                                const hasSubItems = item.subItems && item.subItems.length > 0;

                                return (
                                    <div key={item.path}>
                                        <div className="flex items-center group">
                                            <Link
                                                to={item.path}
                                                className={clsx(
                                                    'flex-1 flex items-center gap-3 px-4 py-2 rounded-lg transition-all duration-200',
                                                    location.pathname === item.path
                                                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                                                        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                                )}
                                            >
                                                <item.icon size={18} />
                                                <span className="font-medium text-sm">{item.label}</span>
                                            </Link>
                                            {hasSubItems && (
                                                <button
                                                    onClick={() => toggleExpand(item.path)}
                                                    className="p-2 text-gray-500 hover:text-white transition-colors"
                                                >
                                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                </button>
                                            )}
                                        </div>

                                        {hasSubItems && isExpanded && (
                                            <div className="ml-9 mt-1 space-y-1 border-l border-gray-700 pl-4">
                                                {item.subItems.map((subItem) => (
                                                    <Link
                                                        key={subItem.path}
                                                        to={subItem.path}
                                                        className={clsx(
                                                            'block py-1.5 text-sm transition-colors',
                                                            location.pathname === subItem.path
                                                                ? 'text-blue-400 font-medium'
                                                                : 'text-gray-500 hover:text-gray-300'
                                                        )}
                                                    >
                                                        {subItem.label}
                                                    </Link>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>



            <div className="mt-auto pt-4 border-t border-gray-700">
                <div className="flex items-center gap-3 px-4 py-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-green-400 to-blue-500"></div>
                    <div>
                        <p className="text-sm font-medium">{selectedAccount ? selectedAccount.currency : 'Trader'}</p>
                        <p className="text-xs text-gray-500">{selectedAccount ? `$${Number(selectedAccount.initial_balance).toLocaleString()}` : 'Free Plan'}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Sidebar;
