import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import api from '../services/api';
import SettingsModal from '../components/SettingsModal';

const Settings = () => {
    const [settings, setSettings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSetting, setSelectedSetting] = useState(null);

    const fetchSettings = async () => {
        try {
            setLoading(true);
            const res = await api.get('/settings');
            const data = res.data.data || [];
            setSettings(data.map(item => ({
                id: item.id || item.documentId,
                ...item
            })));
        } catch (error) {
            console.error('Error fetching settings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSettings();
    }, []);

    const handleSaveSetting = async (data) => {
        try {
            if (selectedSetting) {
                // Update
                const id = selectedSetting.id || selectedSetting.documentId;
                await api.put(`/settings/${id}`, { data });
            } else {
                // Create
                await api.post('/settings', { data });
            }
            fetchSettings();
            setIsModalOpen(false);
            setSelectedSetting(null);
        } catch (error) {
            console.error('Error saving setting:', error);
            alert('Failed to save setting');
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Are you sure you want to delete this setting?')) return;
        try {
            await api.delete(`/settings/${id}`);
            fetchSettings();
        } catch (error) {
            console.error('Error deleting setting:', error);
            alert('Failed to delete setting');
        }
    };

    const openCreateModal = () => {
        setSelectedSetting(null);
        setIsModalOpen(true);
    };

    const openEditModal = (setting) => {
        setSelectedSetting(setting);
        setIsModalOpen(true);
    };

    return (
        <div>
            <SettingsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSubmit={handleSaveSetting}
                setting={selectedSetting}
            />

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold">Settings</h2>
                <button
                    onClick={openCreateModal}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition font-medium text-white shadow-lg shadow-blue-500/20"
                >
                    <Plus size={18} />
                    New Setting
                </button>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full text-left">
                    <thead className="bg-gray-700/50 text-gray-400">
                        <tr>
                            <th className="p-4">Name</th>
                            <th className="p-4">Risk % / Trade</th>
                            <th className="p-4">Max Drawdown %</th>
                            <th className="p-4">Capital Risk %</th>
                            <th className="p-4 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                        {loading ? (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-500">Loading settings...</td></tr>
                        ) : settings.length === 0 ? (
                            <tr><td colSpan="5" className="p-8 text-center text-gray-500">No settings found.</td></tr>
                        ) : settings.map((item) => (
                            <tr key={item.id} className="hover:bg-gray-700/30 transition group">
                                <td className="p-4 font-mono font-medium text-blue-400">{item.Name}</td>
                                <td className="p-4 font-mono text-gray-200">{item.riskPerTrade}%</td>
                                <td className="p-4 font-mono text-gray-200">{item.maxDrawDown}%</td>
                                <td className="p-4 font-mono text-gray-200">{item.capitalRisk}%</td>
                                <td className="p-4 text-right flex justify-end gap-2">
                                    <button
                                        onClick={() => openEditModal(item)}
                                        className="p-2 text-gray-400 hover:text-blue-400 transition cursor-pointer"
                                    >
                                        <Edit2 size={16} />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(item.id)}
                                        className="p-2 text-gray-400 hover:text-red-400 transition cursor-pointer"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default Settings;
