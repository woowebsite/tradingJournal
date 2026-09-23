import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Save } from 'lucide-react';
import { saveTrade } from '../features/tradeSlice';
import { formatMoney } from '../utils/formatMoney';
import { executeBinanceOrder } from '../services/binanceExecution';

/* eslint-disable react-hooks/set-state-in-effect */

const formatCleanDecimal = (num, maxDecimals = 4) => {
  if (!num || !Number.isFinite(num) || num <= 0) return '--';
  return Number(num.toFixed(maxDecimals)).toString();
};

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatAutoVolume = (value, price = 0) => {
  const num = Number.parseFloat(value);
  if (!Number.isFinite(num) || num <= 0) return '';
  if (price >= 1000) {
    return Number(num.toFixed(4)).toString();
  } else if (price >= 100) {
    return Number(num.toFixed(3)).toString();
  } else if (price >= 1) {
    return Number(num.toFixed(2)).toString();
  }
  return Number(num.toFixed(4)).toString();
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

const getInitialForm = (value = {}, defaultRisk = 0) => {
  const source = value || {};
  return {
    price: normalizeField(source.price),
    volume: normalizeField(source.volume),
    riskAmount: normalizeField(source.riskAmount) || (defaultRisk > 0 ? String(Number(defaultRisk.toFixed(2))) : ''),
    slPrice: normalizeField(source.slPrice),
    tpPrice: normalizeField(source.tpPrice)
  };
};

const isSameForm = (left, right) => (
  left?.price === right?.price &&
  left?.volume === right?.volume &&
  left?.riskAmount === right?.riskAmount &&
  left?.slPrice === right?.slPrice &&
  left?.tpPrice === right?.tpPrice
);

const TradeStationOrderForm = ({
  selectedAccount,
  selectedSymbol,
  activeStrategy,
  value,
  livePrice,
  onChange,
  onSaved,
  disabled = false
}) => {
  const dispatch = useDispatch();
  const riskAmount = getAccountRiskAmount(selectedAccount);
  const [form, setForm] = useState(() => getInitialForm(value, riskAmount));
  const [saving, setSaving] = useState(false);
  const [isLivePriceLinked, setIsLivePriceLinked] = useState(() => !value?.price);

  const prevValueRef = useRef(value);

  // Sync with value prop only when external value prop changes from template / auto-trade / params
  useEffect(() => {
    if (!isSameForm(prevValueRef.current, value)) {
      prevValueRef.current = value;
      setForm(prev => {
        const next = {
          price: value?.price !== undefined && value?.price !== '' ? String(value.price) : prev.price,
          slPrice: value?.slPrice !== undefined && value?.slPrice !== '' ? String(value.slPrice) : prev.slPrice,
          tpPrice: value?.tpPrice !== undefined && value?.tpPrice !== '' ? String(value.tpPrice) : prev.tpPrice,
          volume: value?.volume !== undefined && value?.volume !== '' ? String(value.volume) : prev.volume,
          riskAmount: value?.riskAmount !== undefined && value?.riskAmount !== '' ? String(value.riskAmount) : prev.riskAmount,
        };
        const p = toFiniteNumber(next.price, 0);
        const sl = toFiniteNumber(next.slPrice, 0);
        const r = toFiniteNumber(next.riskAmount, 0) || riskAmount;
        if (p > 0 && sl > 0 && r > 0) {
          const dist = Math.abs(p - sl);
          if (dist > 0) {
            next.volume = formatAutoVolume(r / dist, p);
          }
        }
        return next;
      });
      if (value?.price) {
        setIsLivePriceLinked(false);
      }
    }
  }, [value, riskAmount]);

  // If livePrice arrives and price is empty or linked to live price, sync it smoothly
  useEffect(() => {
    if (!livePrice || Number(livePrice) <= 0) return;
    const strPrice = String(Number(livePrice));

    setForm(prev => {
      if (!prev.price || isLivePriceLinked) {
        if (prev.price === strPrice) return prev;
        const next = { ...prev, price: strPrice };
        const sl = toFiniteNumber(prev.slPrice, 0);
        const r = toFiniteNumber(prev.riskAmount, 0) || riskAmount;
        if (sl > 0 && r > 0) {
          const dist = Math.abs(Number(livePrice) - sl);
          if (dist > 0) {
            next.volume = formatAutoVolume(r / dist, Number(livePrice));
          }
        }
        return next;
      }
      return prev;
    });
  }, [livePrice, isLivePriceLinked, riskAmount]);

  // Set default riskAmount from account if empty
  useEffect(() => {
    if (riskAmount <= 0) return;
    setForm(prev => {
      if (prev.riskAmount) return prev;
      return { ...prev, riskAmount: String(Number(riskAmount.toFixed(2))) };
    });
  }, [riskAmount]);

  const manualRiskAmount = toFiniteNumber(form.riskAmount, 0);
  const effectiveRiskAmount = manualRiskAmount > 0 ? manualRiskAmount : riskAmount;
  const riskPercent = toFiniteNumber(selectedAccount?.setting?.riskPerTrade, 0);
  const entryPrice = toFiniteNumber(form.price, 0);
  const slPrice = toFiniteNumber(form.slPrice, 0);
  const tpPrice = toFiniteNumber(form.tpPrice, 0);
  const volume = toFiniteNumber(form.volume, 0);

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
    if (field === 'price') {
      setIsLivePriceLinked(false);
    }

    setForm(prev => {
      const next = { ...prev, [field]: nextValue };

      // Calculate volume automatically whenever Price, SL Price, or Risk Amount is modified
      const curPrice = field === 'price' ? toFiniteNumber(nextValue, 0) : toFiniteNumber(next.price, 0);
      const curSl = field === 'slPrice' ? toFiniteNumber(nextValue, 0) : toFiniteNumber(next.slPrice, 0);
      const curRisk = field === 'riskAmount' ? toFiniteNumber(nextValue, 0) : (toFiniteNumber(next.riskAmount, 0) || riskAmount);

      if (field !== 'volume' && curPrice > 0 && curSl > 0 && curRisk > 0) {
        const dist = Math.abs(curPrice - curSl);
        if (dist > 0) {
          next.volume = formatAutoVolume(curRisk / dist, curPrice);
        }
      }

      onChange?.(next);
      return next;
    });
  };

  const handleUseLivePrice = () => {
    if (!livePrice || Number(livePrice) <= 0) return;
    setIsLivePriceLinked(true);
    const strP = String(Number(livePrice));
    setForm(prev => {
      const next = { ...prev, price: strP };
      const sl = toFiniteNumber(prev.slPrice, 0);
      const r = toFiniteNumber(prev.riskAmount, 0) || riskAmount;
      if (sl > 0 && r > 0) {
        const dist = Math.abs(Number(livePrice) - sl);
        if (dist > 0) {
          next.volume = formatAutoVolume(r / dist, Number(livePrice));
        }
      }
      onChange?.(next);
      return next;
    });
  };

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();
      const rawSymbolName = selectedSymbol?.Name || selectedSymbol?.name || '';
      const symUpper = rawSymbolName.toUpperCase();
      const accountName = (selectedAccount?.name || selectedAccount?.Name || '').toUpperCase();
      const marketName = (selectedAccount?.market?.Name || selectedAccount?.market?.name || '').toUpperCase();

      const isLong = slPrice > 0 ? (entryPrice >= slPrice) : (tpPrice > 0 ? entryPrice <= tpPrice : true);
      const tradeType = isLong ? 'Long' : 'Short';
      const orderSide = isLong ? 'Buy' : 'Sell';

      const isBinance = marketName.includes('CRYPTO') ||
        accountName.includes('BINANCE') ||
        symUpper.endsWith('.P') ||
        symUpper.includes('PERP') ||
        /USDT|\.P/i.test(rawSymbolName);

      const isFutures = symUpper.endsWith('.P') ||
        symUpper.includes('PERP') ||
        accountName.includes('FUTURES') ||
        accountName.includes('DERIVATIVE') ||
        marketName.includes('FUTURES') ||
        marketName.includes('DERIVATIVE') ||
        /USDT|\.P/i.test(rawSymbolName);

      let brokerNote = '';

      // 1. If Binance / Crypto account, execute order on Binance first
      if (isBinance) {
        const binanceResult = await executeBinanceOrder({
          symbol: rawSymbolName,
          side: isLong ? 'BUY' : 'SELL',
          type: 'MARKET',
          quantity: volume,
          price: entryPrice,
          isFutures,
          positionSide: isLong ? 'LONG' : 'SHORT',
          isClose: false
        });

        if (binanceResult && (binanceResult.orderId !== undefined || binanceResult.id !== undefined)) {
          const orderId = binanceResult.orderId ?? binanceResult.id;
          brokerNote = `[Binance Placed] Order ID: ${orderId}`;
        }
      }

      // 2. Only after order is successfully sent to broker, create trade in journal
      const plannedLines = [
        'Created from Trade Station order form.',
        brokerNote || null,
        slPrice > 0 ? `Planned SL: ${slPrice}` : null,
        tpPrice > 0 ? `Planned TP: ${tpPrice}` : null,
        rewardRisk > 0 ? `Risk/Reward: 1:${rewardRisk.toFixed(2)}` : null,
      ].filter(Boolean);

      const tradeData = {
        symbol: getEntityId(selectedSymbol),
        account: getEntityId(selectedAccount),
        strategy: getEntityId(activeStrategy) || undefined,
        type: tradeType,
        trade_status: 'Open',
        mode: 'Real',
        date: now,
        note: plannedLines.join('\n'),
        trade_details: [
          {
            date: now,
            signal: 'Entry',
            type: orderSide,
            price: entryPrice,
            volume,
            note: [brokerNote, plannedLines.slice(2).join('\n')].filter(Boolean).join('\n')
          }
        ]
      };

      await dispatch(saveTrade({ tradeData, tradeToEdit: null })).unwrap();
      await onSaved?.();
      alert(`Đã đặt lệnh ${tradeType} ${rawSymbolName} thành công và lưu vào Nhật ký!${brokerNote ? `\n${brokerNote}` : ''}`);
    } catch (error) {
      console.error('Failed to execute order or create trade:', error);
      alert(`Gửi lệnh lên sàn thất bại:\n${error?.message || error?.error?.message || error}\n\nLệnh CHƯA được tạo vào Nhật ký.`);
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
          title="Đặt lệnh lên sàn và lưu vào Nhật ký"
        >
          <Save size={16} />
          {saving ? 'Đang gửi lệnh...' : 'Order'}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-gray-300">Price</label>
            {livePrice && (
              <button
                type="button"
                onClick={handleUseLivePrice}
                className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition cursor-pointer flex items-center gap-1 ${isLivePriceLinked
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'bg-gray-800 text-gray-400 hover:text-emerald-300 border border-gray-700'
                  }`}
                title="Bấm để khóa và cập nhật theo giá Realtime"
              >
                <span className={`w-1.5 h-1.5 rounded-full ${isLivePriceLinked ? 'bg-emerald-400 animate-pulse' : 'bg-gray-500'}`} />
                {isLivePriceLinked && <span className="text-[9px] text-emerald-400 font-bold ml-0.5">(Live)</span>}
              </button>
            )}
          </div>
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
            Risk/share: <span className="font-mono">{formatCleanDecimal(stopPriceDistance, 4)}</span>
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

