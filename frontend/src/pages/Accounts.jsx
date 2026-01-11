import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit2, Trash2, Wallet } from 'lucide-react';
import api from '../services/api';
import AccountModal from '../components/AccountModal';
import { useAccount } from '../context/AccountContext';

const Accounts = () => {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAccountToEdit, setSelectedAccountToEdit] = useState(null);
    const { setSelectedAccount } = useAccount();
    const navigate = useNavigate();

    const fetchAccounts = async () => {
        try {
            setLoading(true);
            const res = await api.get('/accounts?populate=*');
            const data = res.data.data || [];
            setAccounts(data.map(item => ({
                id: item.id || item.documentId,
                ...item
            })));
        } catch (error) {
            console.error('Error fetching accounts:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAccounts();
    }, []);

    const handleSaveAccount = async (data) => {
        try {
            if (selectedAccountToEdit) {
                const id = selectedAccountToEdit.documentId || selectedAccountToEdit.id;
                await api.put(`/accounts/${id}`, { data });
            } else {
                await api.post('/accounts', { data });
            }
            fetchAccounts();
            setIsModalOpen(false);
            setSelectedAccountToEdit(null);
        } catch (error) {
            console.error('Error saving account:', error);
            alert('Failed to save account');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this account? Trades associated with it might become inaccessible.')) return;
        try {
            await api.delete(`/accounts/${id}`);
            fetchAccounts();
        } catch (error) {
            console.error('Error deleting account:', error);
            alert('Failed to delete account');
        }
    };

    const openCreateModal = () => {
        setSelectedAccountToEdit(null);
        setIsModalOpen(true);
    };

    const openEditModal = (account) => {
        setSelectedAccountToEdit(account);
        setIsModalOpen(true);
    };

    return (
        <div>
            <AccountModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSaveAccount}
                account={selectedAccountToEdit}
            />

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Accounts</h2>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition font-medium text-white shadow-lg shadow-blue-500/20"
                >
                    <Plus size={18} />
                    New Account
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <p className="text-gray-500 col-span-3 text-center py-12">Loading accounts...</p>
                ) : accounts.length === 0 ? (
                    <p className="text-gray-500 col-span-3 text-center py-12">No accounts found. Create your first one!</p>
                ) : accounts.map((account) => (
                    <div
                        key={account.id}
                        onClick={() => {
                            setSelectedAccount(account);
                            navigate(`/accounts/${account.documentId || account.id}`);
                        }}
                        className="bg-gray-800 rounded-xl border border-gray-700 p-6 shadow-sm hover:border-blue-500 transition group relative cursor-pointer"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white">
                                <Wallet size={20} />
                            </div>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={(e) => { e.stopPropagation(); openEditModal(account); }}
                                    className="p-2 text-gray-400 hover:text-blue-400 transition bg-gray-700/50 rounded-lg"
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(account.documentId || account.id); }}
                                    className="p-2 text-gray-400 hover:text-red-400 transition bg-gray-700/50 rounded-lg"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-1">{account.name}</h3>
                        <p className="text-sm text-gray-400 mb-4">{account.market?.Name || account.market?.name || 'Unknown Market'} • {account.currency}</p>

                        <div className="pt-4 border-t border-gray-700">
                            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Initial Balance</p>
                            <p className="text-2xl font-bold text-green-400">
                                ${account.initial_balance?.toLocaleString()}
                            </p>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default Accounts;
