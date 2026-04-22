import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchSymbols } from '../features/symbolSlice';
import { X, Check } from 'lucide-react';
import api from '../services/api'; // Ensure this path is correct
import { useAccount } from '../context/AccountContext';
import { formatNumber } from '../utils/formatNumber';
import { extractTextFromBlocks } from '../utils/textUtils';

const TradeModal = ({ isOpen, onClose, onSubmit, initialData }) => {
  const { selectedAccount } = useAccount();
  const dispatch = useDispatch();
  const { items: symbols, loading: loadingSymbols } = useSelector(state => state.symbols);

  const [formData, setFormData] = useState({
    symbol: '',
    type: 'Long',
    trade_status: 'Open',
    date: new Date().toISOString().slice(0, 16),
    note: '',
    trade_details: [] // List of details
  });

  const [riskSetting, setRiskSetting] = useState(null);

  // Helper to format currency
  const formatPrice = (price) => {
    return price ? formatNumber(price, selectedAccount?.moneyFormat || '#,###.##') : '-';
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        const data = res.data.data;
        if (Array.isArray(data) && data.length > 0) {
          setRiskSetting(data[0]);
        }
      } catch (error) {
        console.error("Failed to fetch settings for risk calc:", error);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        // Edit Mode
        setFormData({
          symbol: initialData.symbol?.documentId || initialData.symbol?.id || initialData.symbol || '',
          type: initialData.type || 'Long',
          trade_status: initialData.trade_status || 'Open',
          date: initialData.date ? new Date(initialData.date).toISOString().slice(0, 16) : new Date().toISOString().slice(0, 16),
          note: extractTextFromBlocks(initialData.note),
          trade_details: initialData.trade_details ? initialData.trade_details.map(d => ({
            id: d.id,
            documentId: d.documentId,
            date: d.date ? new Date(d.date).toISOString().slice(0, 16) : '',
            signal: d.signal || 'Entry',
            type: d.type || 'Buy',
            price: d.price || '',
            volume: d.volume || '',
            note: extractTextFromBlocks(d.note),
            existingScreenshot: d.screenshot // Keep ref to existing if any
          })) : []
        });
      } else {
        // Create Mode
        setFormData({
          symbol: '',
          type: 'Long',
          trade_status: 'Open',
          date: new Date().toISOString().slice(0, 16),
          note: '',
          trade_details: [
            // Default first row
            { date: new Date().toISOString().slice(0, 16), signal: 'Entry', type: 'Buy', price: '', volume: '', note: '' }
          ]
        });
      }

      // Fetch Symbols via Redux
      if (selectedAccount?.market) {
        dispatch(fetchSymbols(selectedAccount.market.documentId || selectedAccount.market.id));
      } else if (!selectedAccount) {
        dispatch(fetchSymbols()); // Fetch all if no account selected (or handle as empty if preferred)
      }
      // If selectedAccount exists but no market, we effectively show whatever is in state or nothing. 
      // Ideally we'd clear state, but for now we follow the pattern of requesting what IS valid.
    }
  }, [isOpen, initialData, selectedAccount, dispatch]);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleDetailChange = (index, field, value) => {
    const newDetails = [...formData.trade_details];
    newDetails[index] = { ...newDetails[index], [field]: value };
    setFormData(prev => ({ ...prev, trade_details: newDetails }));
  };

  const addDetail = () => {
    setFormData(prev => ({
      ...prev,
      trade_details: [...prev.trade_details, {
        date: new Date().toISOString().slice(0, 16),
        signal: 'Entry', // Default
        type: formData.type === 'Long' ? 'Buy' : 'Sell', // Smart default
        price: '',
        volume: '',
        note: ''
      }]
    }));
  };

  const removeDetail = (index) => {
    const newDetails = formData.trade_details.filter((_, i) => i !== index);
    setFormData(prev => ({ ...prev, trade_details: newDetails }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedAccount) {
      alert('Please select an active account from the sidebar first.');
      return;
    }

    const payload = {
      ...formData,
      // Pass details as is, formatted
      trade_details: formData.trade_details.map(d => ({
        ...d,
        price: parseFloat(d.price) || 0,
        volume: parseFloat(d.volume) || 0
      })),
      account: selectedAccount.documentId || Number(selectedAccount.id)
    };

    // Separate file from data - NOT NEEDED for per-detail logic?
    // Actually wait, main Trade screenshot is gone.
    // So we just submit payload.
    // But we need to make sure 'screenshotFile' in details doesn't break JSON.stringify if axios tries it?
    // Trades.jsx will handle it.

    onSubmit(payload);
    onClose();
  };

  // Calc metrics based on Trade Type (Long -> Buy, Short -> Sell)
  const relevantDetails = formData.trade_details.filter(d =>
    formData.type === 'Long' ? d.type === 'Buy' : d.type === 'Sell'
  );

  const totalVolume = relevantDetails.reduce((acc, curr) => acc + (parseFloat(curr.volume) || 0), 0);
  const avgPrice = totalVolume > 0
    ? relevantDetails.reduce((acc, curr) => acc + ((parseFloat(curr.price) || 0) * (parseFloat(curr.volume) || 0)), 0) / totalVolume
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-gray-800 rounded-xl border border-gray-700 w-full max-w-4xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900/50">
          <h3 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            {initialData ? 'Edit Trade' : 'New Trade'}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Top Row: Symbol & Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Symbol</label>
              <select
                name="symbol"
                required
                value={formData.symbol}
                onChange={handleChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none font-mono"
              >
                <option value="">Select Symbol</option>
                {symbols.map(s => (
                  <option key={s.id} value={s.documentId}>{s.Name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Type</label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Long">Long</option>
                <option value="Short">Short</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Overall Status</label>
              <select
                name="trade_status"
                value={formData.trade_status}
                onChange={handleChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                <option value="Open">Open</option>
                <option value="Closed">Closed</option>
                <option value="Pending">Pending</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Date</label>
              <input
                type="datetime-local"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>


          {/* Trade Details List */}
          <div className="bg-gray-900/30 p-4 rounded-xl border border-gray-700/50">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-sm font-bold text-gray-300 uppercase tracking-wider">Execution Log</h4>
              <button type="button" onClick={addDetail} className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition flex items-center gap-1">
                <Check size={12} /> Add Row
              </button>
            </div>

            <div className="space-y-3">
              {formData.trade_details.map((detail, index) => (
                <div key={index} className="bg-gray-800/50 p-3 rounded border border-gray-700/50 space-y-3">
                  <div className="grid grid-cols-12 gap-2 items-center">
                    {/* Date */}
                    <div className="col-span-3">
                      <label className="text-[10px] text-gray-500 uppercase block mb-0.5">Date</label>
                      <input type="datetime-local" value={detail.date} onChange={(e) => handleDetailChange(index, 'date', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs outline-none focus:border-blue-500" />
                    </div>
                    {/* Signal */}
                    <div className="col-span-2">
                      <label className="text-[10px] text-gray-500 uppercase block mb-0.5">Signal</label>
                      <select value={detail.signal} onChange={(e) => handleDetailChange(index, 'signal', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs outline-none">
                        <option value="Entry">Entry</option>
                        <option value="TakeProfit">TP</option>
                        <option value="Stoploss">SL</option>
                        <option value="Exit">Exit</option>
                      </select>
                    </div>
                    {/* Type */}
                    <div className="col-span-2">
                      <label className="text-[10px] text-gray-500 uppercase block mb-0.5">Type</label>
                      <select value={detail.type} onChange={(e) => handleDetailChange(index, 'type', e.target.value)} className={`w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs outline-none font-bold ${detail.type === 'Buy' ? 'text-green-400' : 'text-red-400'}`}>
                        <option value="Buy">Buy</option>
                        <option value="Sell">Sell</option>
                      </select>
                    </div>
                    {/* Price */}
                    <div className="col-span-2">
                      <label className="text-[10px] text-gray-500 uppercase block mb-0.5">Price</label>
                      <input type="number" step="any" placeholder="Price" value={detail.price} onChange={(e) => handleDetailChange(index, 'price', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs outline-none text-right font-mono" />
                    </div>
                    {/* Volume */}
                    <div className="col-span-3 relative">
                      <label className="text-[10px] text-gray-500 uppercase block mb-0.5">Volume</label>
                      <div className="flex items-center gap-1">
                        <input type="number" step="any" placeholder="Vol" value={detail.volume} onChange={(e) => handleDetailChange(index, 'volume', e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-2 py-1 text-xs outline-none text-right font-mono" />
                        {index > 0 && (
                          <button type="button" onClick={() => removeDetail(index)} className="bg-red-500/80 text-white rounded-full p-1 hover:bg-red-600 transition">
                            <X size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Note & Screenshot */}
                  <div className="grid grid-cols-2 gap-4 pt-1 border-t border-gray-700/30">
                    <div>
                      <input
                        type="text"
                        placeholder="Note regarding this execution..."
                        value={detail.note || ''}
                        onChange={(e) => handleDetailChange(index, 'note', e.target.value)}
                        className="w-full bg-gray-700/50 border border-gray-600/50 rounded px-2 py-1 text-xs outline-none focus:border-blue-500 text-gray-300 placeholder-gray-500"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handleDetailChange(index, 'screenshotFile', e.target.files[0]);
                          }
                        }}
                        className="block w-full text-[10px] text-gray-400 file:mr-2 file:py-0.5 file:px-2 file:rounded-full file:border-0 file:text-[10px] file:font-semibold file:bg-gray-600 file:text-white hover:file:bg-gray-500 cursor-pointer"
                      />
                      {detail.existingScreenshot && !detail.screenshotFile && (
                        <span className="text-[10px] text-green-400 whitespace-nowrap">Img Attached</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-4 pt-3 border-t border-gray-700 flex justify-end gap-6 text-sm">
              <div className="text-gray-400">Total Vol: <span className="text-white font-mono">{formatNumber(totalVolume)}</span></div>
              <div className="text-gray-400">Avg Price: <span className="text-white font-mono">{formatPrice(avgPrice)}</span></div>
            </div>
          </div>



          <div>
            <label className="block text-sm text-gray-400 mb-1">Note</label>
            <textarea
              name="note"
              rows="2"
              value={formData.note}
              onChange={handleChange}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="Trade setup note..."
            ></textarea>
          </div>



          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-gray-300 hover:bg-gray-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 transition shadow-lg shadow-blue-600/20"
            >
              Save Trade
            </button>
          </div>
        </form>
      </div >
    </div >
  );
};

export default TradeModal;
