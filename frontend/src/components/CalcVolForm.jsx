import { useCallback, useEffect, useState } from 'react';
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

const getAccountRiskAmount = (account) => {
  const balance = toFiniteNumber(account?.initial_balance ?? account?.balance ?? account?.current_balance, 0);
  const riskPercent = toFiniteNumber(account?.setting?.riskPerTrade, 0);
  if (balance <= 0 || riskPercent <= 0) return 0;
  return balance * (riskPercent / 100);
};

const normalizeField = (fieldValue) => (
  fieldValue === undefined || fieldValue === null ? '' : String(fieldValue)
);

const getInitialCalcForm = (value = {}) => ({
  price: normalizeField(value.price),
  volume: normalizeField(value.volume),
  riskAmount: normalizeField(value.riskAmount),
  slPrice: normalizeField(value.slPrice),
  tpPrice: normalizeField(value.tpPrice)
});

const isSameCalcForm = (left, right) => (
  left.price === right.price &&
  left.volume === right.volume &&
  left.riskAmount === right.riskAmount &&
  left.slPrice === right.slPrice &&
  left.tpPrice === right.tpPrice
);

const CalcVolForm = ({ currentPrice, selectedAccount, value, onChange, disabled = false }) => {
  const [calcForm, setCalcForm] = useState({
    price: '',
    volume: '',
    riskAmount: '',
    slPrice: '',
    tpPrice: ''
  });

  const riskAmount = getAccountRiskAmount(selectedAccount);
  const manualRiskAmount = toFiniteNumber(calcForm.riskAmount, 0);
  const effectiveRiskAmount = manualRiskAmount > 0 ? manualRiskAmount : riskAmount;
  const riskPercent = toFiniteNumber(selectedAccount?.setting?.riskPerTrade, 0);
  const entryPrice = toFiniteNumber(calcForm.price, 0);
  const slPrice = toFiniteNumber(calcForm.slPrice, 0);
  const tpPrice = toFiniteNumber(calcForm.tpPrice, 0);

  const updateCalcForm = useCallback((updater, shouldEmit = true) => {
    setCalcForm(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      if (isSameCalcForm(prev, next)) return prev;
      if (shouldEmit) onChange?.(next);
      return next;
    });
  }, [onChange]);

  useEffect(() => {
    if (!value) return;
    const nextForm = getInitialCalcForm(value);
    setCalcForm(prev => (isSameCalcForm(prev, nextForm) ? prev : nextForm));
  }, [value]);

  useEffect(() => {
    if (!currentPrice) return;
    updateCalcForm(prev => (
      prev.price === String(currentPrice) ? prev : { ...prev, price: String(currentPrice) }
    ));
  }, [currentPrice, updateCalcForm]);

  useEffect(() => {
    if (riskAmount <= 0) return;
    updateCalcForm(prev => (
      prev.riskAmount ? prev : { ...prev, riskAmount: String(riskAmount) }
    ));
  }, [riskAmount, updateCalcForm]);

  useEffect(() => {
    if (effectiveRiskAmount <= 0) return;

    const stopPriceDistance = entryPrice > 0 && slPrice > 0 ? Math.abs(entryPrice - slPrice) : 0;
    const nextVolume = stopPriceDistance > 0 ? formatAutoVolume(effectiveRiskAmount / stopPriceDistance) : '';

    if (!nextVolume) return;
    updateCalcForm(prev => (
      prev.volume === nextVolume ? prev : { ...prev, volume: nextVolume }
    ));
  }, [effectiveRiskAmount, entryPrice, slPrice, updateCalcForm]);

  const amountValue = entryPrice * toFiniteNumber(calcForm.volume, 0);
  const stopPriceDistance = entryPrice > 0 && slPrice > 0 ? Math.abs(entryPrice - slPrice) : 0;
  const profitPerShare = entryPrice > 0 && tpPrice > 0 ? Math.abs(tpPrice - entryPrice) : 0;
  const profitAmount = profitPerShare * toFiniteNumber(calcForm.volume, 0);

  const handleCalcChange = (field, value) => {
    updateCalcForm(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-4 rounded-xl border border-gray-700 bg-gray-900/30 p-4">
      <div>
        <h4 className="text-sm font-bold uppercase tracking-wider text-gray-300">Calc Volume</h4>
        <p className="mt-1 text-xs text-gray-500">Calculate position size from entry price and stop price.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-300">Price</label>
          <input
            type="number"
            step="any"
            disabled={disabled}
            value={calcForm.price}
            onChange={(e) => handleCalcChange('price', e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-right font-mono text-gray-200 outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="0.00"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-300">Volume</label>
          <input
            type="number"
            step="any"
            disabled={disabled}
            value={calcForm.volume}
            onChange={(e) => handleCalcChange('volume', e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-right font-mono text-gray-200 outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="0.00"
          />
          <p className="amount mt-1 text-right text-xs text-blue-400">
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
            disabled={disabled}
            value={calcForm.slPrice}
            onChange={(e) => handleCalcChange('slPrice', e.target.value)}
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
            disabled={disabled}
            value={calcForm.tpPrice}
            onChange={(e) => handleCalcChange('tpPrice', e.target.value)}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-right font-mono text-green-300 outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Target price"
          />
          <p className="mt-1 text-xs text-green-400">
            Profit: <span className="font-mono">{profitPerShare > 0 ? `${formatMoney(profitAmount, selectedAccount)}` : '--'}</span>
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
            disabled={disabled}
            value={calcForm.riskAmount}
            onChange={(e) => handleCalcChange('riskAmount', e.target.value)}
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
            {riskPercent || 0}% per trade
          </p>
        </div>
      </div>
    </div>
  );
};

export default CalcVolForm;
