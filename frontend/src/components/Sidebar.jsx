import React, { useState } from 'react';
import {
    LayoutDashboard,
    ReceiptText,
    NotebookPen,
    Settings,
    ChevronDown,
    Wallet,
    LineChart,
    Activity,
    BrainCircuit,
    BarChart2,
    List,
    Tag,
    TrendingUp,
    ChevronRight,
    Webhook,
    CheckSquare,
    Newspaper,
    PanelLeftClose,
    PanelLeftOpen,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useAccount } from '../context/AccountContext';
import { useSidebar } from '../context/SidebarContext';
import clsx from 'clsx';

const Sidebar = () => {
    const location = useLocation();
    const { accounts, selectedAccount, setSelectedAccount, loading } = useAccount();
    const { isCollapsed, toggleSidebar } = useSidebar();

    const menuGroups = [
        {
            label: 'Menu',
            items: [
                {
                    icon: LayoutDashboard, label: 'Dashboard', path: '/',
                    subItems: [
                        { label: 'VietNam', path: '/vietnam' },
                        { label: 'Global', path: '/global' },
                    ]
                },
                {
                    icon: Newspaper, label: 'News', path: '/news',
                    subItems: [
                        { label: 'News AI', path: '/news-ai' },
                        { label: 'News Analysis', path: '/news-analysis' },
                        { label: 'News Summary', path: '/news-summary' },
                    ]
                },
                {
                    icon: BarChart2, label: 'Trade Station', path: '/trade-station',
                    subItems: [
                        { label: 'Today', path: '/today-trades' },
                        { label: 'Porfolio', path: '/portfolio' },
                    ]
                },
                {
                    icon: TrendingUp, label: 'Derivation', path: '/derivation',
                    subItems: [
                        { label: 'Derivation Investor', path: '/derivation-investor' },
                        { label: 'Stock Investor Insight', path: '/investor-insight' },
                    ],
                },
                {
                    icon: NotebookPen,
                    label: 'Journal',
                    path: '/journal',
                    subItems: [
                        { label: 'Calendar', path: '/journal-calendar' },
                        { label: 'Roadmap', path: '/journal-roadmap' },
                        { label: 'Workflow', path: '/journal-workflow' },
                        { label: 'Plan', path: '/journal-plan' },
                        { label: 'Trades', path: '/trades' },
                        { label: 'Journal', path: '/journal-trade' },
                        { label: 'Analysis', path: '/journal-analysis' }
                    ]
                },
                {
                    icon: Activity,
                    label: 'Signals',
                    path: '/signals',
                    subItems: [
                        { label: 'Strategy Signals', path: '/signals' },
                        { label: 'TCBS Signals', path: '/tcbs-strategy-signals' },
                        { label: 'Recommendation', path: '/tcbs-recommendation' },
                        { label: 'Webhook Signals', path: '/webhook-signals' }
                    ]
                },
            ]
        },
        {
            label: 'Management',
            items: [
                {
                    icon: LineChart, label: 'Market', path: '/manage-market',
                    subItems: [
                        { label: 'Market Flow', path: '/market-flow' },
                    ]
                },
                { icon: CheckSquare, label: 'Scored', path: '/manage-scored' },
                {
                    icon: BrainCircuit, label: 'Strategies', path: '/manage-strategies',
                    subItems: [
                        { label: 'Backtest', path: '/backtest' },
                        { label: 'Rules', path: '/manage-rules' },
                    ]
                },
                {
                    icon: Webhook,
                    label: 'Webhooks',
                    path: '/webhooks',
                    subItems: [
                        { label: 'Manage', path: '/manage-webhooks' },
                    ]
                },
                { icon: List, label: 'Watchlists', path: '/manage-watchlists' },
                { icon: Tag, label: 'Symbols', path: '/manage-symbols' },
                { icon: Wallet, label: 'Accounts', path: '/accounts' },
            ]
        },
        {
            label: 'System',
            items: [
                { icon: Settings, label: 'Settings', path: '/settings' },
            ]
        }
    ];

    // Collapse all submenus by default
    const [expandedItems, setExpandedItems] = useState([]);

    const toggleExpand = (path) => {
        setExpandedItems(prev =>
            prev.includes(path)
                ? prev.filter(p => p !== path)
                : [...prev, path]
        );
    };

    return (
        <aside
            className={clsx(
                'h-screen fixed left-0 top-0 bg-gray-800 border-r border-gray-700 flex flex-col z-30 transition-all duration-300 ease-in-out',
                isCollapsed ? 'w-16 p-2' : 'w-64 p-4'
            )}
        >
            {/* Header: Logo & Toggle Button */}
            <div className={clsx(
                'flex items-center mb-4 transition-all duration-300 shrink-0',
                isCollapsed ? 'flex-col gap-2 justify-center pt-1' : 'justify-between px-1'
            )}>
                <Link to="/" className="flex items-center gap-2 group">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-500 to-purple-600 flex items-center justify-center font-bold text-white shadow-lg shadow-blue-500/20 group-hover:scale-105 transition shrink-0">
                        TJ
                    </div>
                    {!isCollapsed && (
                        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent truncate tracking-tight">
                            TradeJournal
                        </h1>
                    )}
                </Link>

                <button
                    type="button"
                    onClick={toggleSidebar}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700 transition"
                    title={isCollapsed ? 'Mở rộng Sidebar' : 'Thu gọn Sidebar'}
                >
                    {isCollapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
                </button>
            </div>

            {/* Active Account Section */}
            {!isCollapsed ? (
                <div className="mb-4 shrink-0 transition-all duration-300">
                    <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1.5 block px-1">
                        Active Account
                    </label>
                    <div className="relative">
                        <select
                            value={selectedAccount?.id || selectedAccount?.documentId || ''}
                            onChange={(e) => {
                                const acc = accounts.find(a => (a.id || a.documentId).toString() === e.target.value);
                                setSelectedAccount(acc);
                            }}
                            className="w-full bg-gray-900 border border-gray-700 text-gray-200 rounded-lg pl-9 pr-8 py-2 text-xs appearance-none focus:ring-1 focus:ring-blue-500 outline-none cursor-pointer truncate"
                            disabled={loading}
                        >
                            {loading && <option>Loading...</option>}
                            {!loading && accounts.length === 0 && <option value="">No Accounts</option>}
                            {accounts.map(acc => (
                                <option key={acc.id || acc.documentId} value={acc.id || acc.documentId}>
                                    {acc.name}
                                </option>
                            ))}
                        </select>
                        <Wallet size={14} className="absolute left-3 top-2.5 text-gray-500 pointer-events-none" />
                        <ChevronDown size={14} className="absolute right-3 top-2.5 text-gray-500 pointer-events-none" />
                    </div>
                </div>
            ) : (
                <div className="mb-3 flex justify-center shrink-0">
                    <div
                        className="p-2 rounded-lg bg-gray-900 border border-gray-700 text-blue-400 shadow-sm cursor-pointer hover:border-blue-500 transition"
                        title={`Account: ${selectedAccount ? selectedAccount.name : 'No Account'}`}
                    >
                        <Wallet size={16} />
                    </div>
                </div>
            )}

            {/* Navigation Menu */}
            <nav className="flex-1 space-y-3 overflow-y-auto custom-scrollbar overflow-x-hidden">
                {menuGroups.map((group, groupIndex) => (
                    <div key={groupIndex}>
                        {group.label && !isCollapsed && (
                            <div className="px-3 mb-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                                {group.label}
                            </div>
                        )}
                        {group.label && isCollapsed && (
                            <div className="h-px bg-gray-700/60 my-2 mx-1" />
                        )}

                        <div className="space-y-1">
                            {group.items.map((item) => {
                                const isExpanded = expandedItems.includes(item.path);
                                const hasSubItems = item.subItems && item.subItems.length > 0;
                                const isActive = location.pathname === item.path
                                    || (hasSubItems && item.subItems.some(subItem => location.pathname === subItem.path));

                                if (isCollapsed) {
                                    return (
                                        <div key={item.path} className="relative group flex justify-center py-0.5">
                                            <Link
                                                to={item.path}
                                                className={clsx(
                                                    'w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-200',
                                                    isActive
                                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                                        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                                )}
                                                title={item.label}
                                            >
                                                <item.icon size={18} />
                                            </Link>

                                            {/* Tooltip flyout for collapsed mode */}
                                            <div className="absolute left-full ml-2 px-2.5 py-1 bg-gray-900 text-white text-xs rounded-md shadow-xl border border-gray-700 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50 whitespace-nowrap">
                                                <p className="font-semibold">{item.label}</p>
                                                {hasSubItems && (
                                                    <div className="mt-1 pt-1 border-t border-gray-800 flex flex-col gap-1">
                                                        {item.subItems.map(sub => (
                                                            <Link
                                                                key={sub.path}
                                                                to={sub.path}
                                                                className={clsx(
                                                                    'text-[11px] hover:text-blue-400 transition',
                                                                    location.pathname === sub.path ? 'text-blue-400 font-bold' : 'text-gray-400'
                                                                )}
                                                            >
                                                                • {sub.label}
                                                            </Link>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                }

                                return (
                                    <div key={item.path}>
                                        <div className="flex items-center group">
                                            <Link
                                                to={item.path}
                                                className={clsx(
                                                    'flex-1 flex items-center gap-2.5 px-3 py-1.5 rounded-lg transition-all duration-200',
                                                    isActive
                                                        ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                                                        : 'text-gray-400 hover:bg-gray-700 hover:text-white'
                                                )}
                                            >
                                                <item.icon size={16} className="shrink-0" />
                                                <span className="font-medium text-xs truncate">{item.label}</span>
                                            </Link>
                                            {hasSubItems && (
                                                <button
                                                    type="button"
                                                    onClick={() => toggleExpand(item.path)}
                                                    className="p-1.5 text-gray-500 hover:text-white transition-colors cursor-pointer"
                                                >
                                                    {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                                </button>
                                            )}
                                        </div>

                                        {hasSubItems && isExpanded && (
                                            <div className="ml-7 mt-1 space-y-0.5 border-l border-gray-700 pl-3">
                                                {item.subItems.map((subItem) => (
                                                    <Link
                                                        key={subItem.path}
                                                        to={subItem.path}
                                                        className={clsx(
                                                            'block py-1 text-xs transition-colors truncate',
                                                            location.pathname === subItem.path
                                                                ? 'text-blue-400 font-semibold'
                                                                : 'text-gray-400 hover:text-gray-200'
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

            {/* Bottom Account info */}
            <div className="mt-auto pt-3 border-t border-gray-700/80 shrink-0">
                {!isCollapsed ? (
                    <div className="flex items-center gap-2.5 px-2 py-1">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-emerald-400 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                            {selectedAccount ? selectedAccount.name.slice(0, 2).toUpperCase() : 'TJ'}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-white truncate">
                                {selectedAccount ? selectedAccount.name : 'Trader'}
                            </p>
                            <p className="text-[10px] text-gray-400 truncate">
                                {selectedAccount ? `$${Number(selectedAccount.initial_balance || 0).toLocaleString()}` : 'Free Plan'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center py-1">
                        <div
                            className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-400 to-blue-500 flex items-center justify-center text-[10px] font-bold text-white shadow-sm cursor-pointer"
                            title={`Account: ${selectedAccount ? selectedAccount.name : 'Trader'}`}
                        >
                            {selectedAccount ? selectedAccount.name.slice(0, 2).toUpperCase() : 'TJ'}
                        </div>
                    </div>
                )}
            </div>
        </aside>
    );
};

export default Sidebar;
