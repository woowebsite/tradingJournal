import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Save } from 'lucide-react';
import { saveTrade } from '../features/tradeSlice';
import { formatMoney } from '../utils/formatMoney';

/* eslint-disable react-hooks/set-state-in-effect */

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatAutoVolume = (value) => {
  if (!Number.isFinite(value) || value <= 0) return '';
  return Number(value.toFixed(8)).toString();
};

const getEntityId = (entity) => entity?.documentId || entity?.id || entity || '';

const getAccountRiskAmount = (account) => {
  const balance = toFiniteNumber(account?.initial_balance ?? account?.balance ?? account?.current_balance, 0);
  const riskPercent = toFiniteNumber(account?.setting?.riskPerTrade, 0);
  if (balance <= 0 || riskPercent <= 0) return 0;
  return balance * (riskPercent / 100);
};

const normalizeField = (fieldValue) => (
  fieldValue === undefined || fieldValue === null ? '' : String(fieldValue)
);

const getInitialForm = (value = {}) => {
  const source = value || {};
  return {
    price: normalizeField(source.price),
    volume: normalizeField(source.volume),
    riskAmount: normalizeField(source.riskAmount),
    slPrice: normalizeField(source.slPrice),
    tpPrice: normalizeField(source.tpPrice)
  };
};

const isSameForm = (left, right) => (
  left.price === right.price &&
  left.volume === right.volume &&
  left.riskAmount === right.riskAmount &&
  left.slPrice === right.slPrice &&
  left.tpPrice === right.tpPrice
);

const TradeStationOrderForm = ({
  selectedAccount,
  selectedSymbol,
  activeStrategy,
  value,
  onChange,
  onSaved,
  disabled = false
}) => {
  const dispatch = useDispatch();
  const [form, setForm] = useState(getInitialForm(value));
  const [saving, setSaving] = useState(false);

  const riskAmount = getAccountRiskAmount(selectedAccount);
  const manualRiskAmount = toFiniteNumber(form.riskAmount, 0);
  const effectiveRiskAmount = manualRiskAmount > 0 ? manualRiskAmount : riskAmount;
  const riskPercent = toFiniteNumber(selectedAccount?.setting?.riskPerTrade, 0);
  const entryPrice = toFiniteNumber(form.price, 0);
  const slPrice = toFiniteNumber(form.slPrice, 0);
  const tpPrice = toFiniteNumber(form.tpPrice, 0);
  const volume = toFiniteNumber(form.volume, 0);

  const updateForm = useCallback((updater, shouldEmit = true) => {
    setForm(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (isSameForm(prev, next)) return prev;
      if (shouldEmit) onChange?.(next);
      return next;
    });
  }, [onChange]);

  useEffect(() => {
    const nextForm = getInitialForm(value);
    setForm(prev => (isSameForm(prev, nextForm) ? prev : nextForm));
  }, [value]);

  useEffect(() => {
    if (riskAmount <= 0) return;
    updateForm(prev => (
      prev.riskAmount ? prev : { ...prev, riskAmount: String(riskAmount) }
    ), false);
  }, [riskAmount, updateForm]);

  useEffect(() => {
    if (effectiveRiskAmount <= 0) return;

    const stopPriceDistance = entryPrice > 0 && slPrice > 0 ? Math.abs(entryPrice - slPrice) : 0;
    const nextVolume = stopPriceDistance > 0 ? formatAutoVolume(effectiveRiskAmount / stopPriceDistance) : '';

    if (!nextVolume) return;
    updateForm(prev => (
      prev.volume === nextVolume ? prev : { ...prev, volume: nextVolume }
    ), false);
  }, [effectiveRiskAmount, entryPrice, slPrice, updateForm]);

  const amountValue = entryPrice * volume;
  const stopPriceDistance = entryPrice > 0 && slPrice > 0 ? Math.abs(entryPrice - slPrice) : 0;
  const profitPerShare = entryPrice > 0 && tpPrice > 0 ? Math.abs(tpPrice - entryPrice) : 0;
  const profitAmount = profitPerShare * volume;
  const rewardRisk = stopPriceDistance > 0 && profitPerShare > 0 ? profitPerShare / stopPriceDistance : 0;

  const canSave = useMemo(() => (
    !disabled &&
    !saving &&
    getEntityId(selectedAccount) &&
    getEntityId(selectedSymbol) &&
    entryPrice > 0 &&
    volume > 0
  ), [disabled, entryPrice, saving, selectedAccount, selectedSymbol, volume]);

  const handleChange = (field, nextValue) => {
    updateForm(prev => ({ ...prev, [field]: nextValue }));
  };

  const handleSave = async () => {
    if (!canSave) return;

    const now = new Date().toISOString();
    const plannedLines = [
      'Created from Trade Station order form.',
      slPrice > 0 ? `Planned SL: ${slPrice}` : null,
      tpPrice > 0 ? `Planned TP: ${tpPrice}` : null,
      rewardRisk > 0 ? `Risk/Reward: 1:${rewardRisk.toFixed(2)}` : null,
    ].filter(Boolean);

    const tradeData = {
      symbol: getEntityId(selectedSymbol),
      account: getEntityId(selectedAccount),
      strategy: getEntityId(activeStrategy) || undefined,
      type: 'Long',
      trade_status: 'Open',
      mode: 'Real',
      date: now,
      note: plannedLines.join('\n'),
      trade_details: [
        {
          date: now,
          signal: 'Entry',
          type: 'Buy',
          price: entryPrice,
          volume,
          note: plannedLines.slice(1).join('\n')
        }
      ]
    };

    setSaving(true);
    try {
      await dispatch(saveTrade({ tradeData, tradeToEdit: null })).unwrap();
      await onSaved?.();
      alert('Trade created successfully.');
    } catch (error) {
      console.error('Failed to create trade from order form:', error);
      alert(`Failed to create trade: ${error?.error?.message || error?.message || error}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-gray-700 bg-gray-900/30 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-bold uppercase tracking-wider text-gray-300">Trade Setup</h4>
          <p className="mt-1 text-xs text-gray-500">Size the position and save it as a new open trade.</p>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="inline-flex h-9 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          title="Save trade"
        >
          <Save size={16} />
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-300">Price</label>
          <input
            type="number"
            step="any"
            disabled={disabled || saving}
            value={form.price}
            onChange={(e) => handleChange('price', e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-right font-mono text-gray-200 outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-300">Volume</label>
          <input
            type="number"
            step="any"
            disabled={disabled || saving}
            value={form.volume}
            onChange={(e) => handleChange('volume', e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-right font-mono text-gray-200 outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="0.00"
          />
          <p className="mt-1 text-right text-xs text-blue-400">
            {formatMoney(Number.isFinite(amountValue) ? amountValue : 0, selectedAccount)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-300">SL Price</label>
          <input
            type="number"
            step="any"
            min="0"
            disabled={disabled || saving}
            value={form.slPrice}
            onChange={(e) => handleChange('slPrice', e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-right font-mono text-red-300 outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Stop price"
          />
          <p className="mt-1 text-xs text-red-400">
            Risk/share: <span className="font-mono">{stopPriceDistance > 0 ? stopPriceDistance : '--'}</span>
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-300">TP Price</label>
          <input
            type="number"
            step="any"
            min="0"
            disabled={disabled || saving}
            value={form.tpPrice}
            onChange={(e) => handleChange('tpPrice', e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-right font-mono text-green-300 outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Target price"
          />
          <p className="mt-1 text-xs text-green-400">
            Profit: <span className="font-mono">{profitPerShare > 0 ? formatMoney(profitAmount, selectedAccount) : '--'}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-gray-800 pt-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-red-300">Risk Amount</label>
          <input
            type="number"
            step="any"
            min="0"
            disabled={disabled || saving}
            value={form.riskAmount}
            onChange={(e) => handleChange('riskAmount', e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-right font-mono text-red-300 outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder={riskAmount > 0 ? riskAmount.toFixed(2) : '0.00'}
          />
          <p className="mt-1 text-right text-xs text-red-400">
            {manualRiskAmount > 0 ? formatMoney(manualRiskAmount, selectedAccount) : 'Manual override'}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-300">Account Risk</label>
          <div className="rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-right font-mono text-gray-400">
            {riskAmount > 0 ? formatMoney(riskAmount, selectedAccount) : 'N/A'}
          </div>
          <p className="mt-1 text-right text-xs text-gray-500">
            {rewardRisk > 0 ? `RR 1:${rewardRisk.toFixed(2)}` : `${riskPercent || 0}% per trade`}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TradeStationOrderForm;
