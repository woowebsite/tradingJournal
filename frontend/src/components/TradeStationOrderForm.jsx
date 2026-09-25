import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Save } from 'lucide-react';
import { saveTrade } from '../features/tradeSlice';
import { formatMoney } from '../utils/formatMoney';
import { executeBinanceOrder } from '../services/binanceExecution';
import { placeTCBSConditionOrder } from '../services/tcbsJournal';
import { calculateSupertrend } from '../indicators/supertrend';

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
  liveCandle,
  timeframe = 'D1',
  histories = [],
  onChange,
  onSaved,
  disabled = false,
  jwtToken,
  setShowOtpModal,
  derivativeSymbol,
  onDerivativeSymbolChange,
  allSymbols = []
}) => {
  const dispatch = useDispatch();
  const riskAmount = getAccountRiskAmount(selectedAccount);
  const [form, setForm] = useState(() => getInitialForm(value, riskAmount));
  const [saving, setSaving] = useState(false);
  const [isLivePriceLinked, setIsLivePriceLinked] = useState(() => !value?.price);
  const [slType, setSlType] = useState('manual');
  const [tpType, setTpType] = useState('manual');
  const [contractSymbol, setContractSymbol] = useState(() => {
    return derivativeSymbol || localStorage.getItem('derivative_contract_symbol') || '41I1GA000';
  });

  const prevValueRef = useRef(value);

  // Chronologically sorted candles for current timeframe
  const sortedCandles = useMemo(() => {
    if (!histories || !Array.isArray(histories) || histories.length === 0) return [];
    return [...histories]
      .filter(c => c && (c.close !== undefined || c.Close !== undefined || c.price !== undefined))
      .sort((a, b) => {
        const tA = new Date(a.date || a.time || a.tradingDate || a.Date || 0).getTime();
        const tB = new Date(b.date || b.time || b.tradingDate || b.Date || 0).getTime();
        return tA - tB;
      });
  }, [histories]);

  // Calculate spread values (P25, P50, P75, P90, P99) from candle histories
  const spreadValues = useMemo(() => {
    if (sortedCandles.length === 0) return null;
    const spreads = sortedCandles
      .map(c => Math.abs(Number(c.high ?? c.High ?? 0) - Number(c.low ?? c.Low ?? 0)))
      .filter(s => s > 0)
      .sort((a, b) => a - b);
    if (spreads.length === 0) return null;
    const getP = (pct) => {
      const idx = Math.floor((pct / 100) * spreads.length);
      return spreads[Math.min(idx, spreads.length - 1)];
    };
    return {
      p25: getP(25),
      p50: getP(50),
      p75: getP(75),
      p90: getP(90),
      p99: getP(99),
    };
  }, [sortedCandles]);

  // Calculate Supertrend level for the current candles
  const supertrendVal = useMemo(() => {
    if (sortedCandles.length < 10) return null;
    try {
      const formatted = sortedCandles.map(c => ({
        open: Number(c.open ?? c.Open ?? c.close ?? c.Close ?? 0),
        high: Number(c.high ?? c.High ?? c.close ?? c.Close ?? 0),
        low: Number(c.low ?? c.Low ?? c.close ?? c.Close ?? 0),
        close: Number(c.close ?? c.Close ?? c.price ?? 0),
        volume: Number(c.volume ?? c.Volume ?? 0)
      }));
      const stData = calculateSupertrend(10, 3.0, formatted);
      const last = stData.at(-1);
      return last?.value ? Number(last.value.toFixed(2)) : null;
    } catch {
      return null;
    }
  }, [sortedCandles]);

  // Sync external derivativeSymbol if updated from parent
  useEffect(() => {
    if (derivativeSymbol && derivativeSymbol !== contractSymbol) {
      setContractSymbol(derivativeSymbol);
    }
  }, [derivativeSymbol]);

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

  const computeSlPrice = useCallback((type, currentPrice, currentSlPrice) => {
    if (!type || type === 'manual') return null;
    const curP = toFiniteNumber(currentPrice, 0) || Number(livePrice || 0);
    if (curP <= 0) return null;

    const existingSl = toFiniteNumber(currentSlPrice, 0);
    const isLong = existingSl > 0 ? curP >= existingSl : true;

    const last = liveCandle || (sortedCandles.length > 0 ? sortedCandles[sortedCandles.length - 1] : null);
    const prev = liveCandle
      ? (sortedCandles.length > 0 ? sortedCandles[sortedCandles.length - 1] : null)
      : (sortedCandles.length > 1 ? sortedCandles[sortedCandles.length - 2] : sortedCandles[0]);

    let slVal = null;
    if (type === 'current_bar' && last) {
      const low = Number(last.low ?? last.Low ?? curP);
      const high = Number(last.high ?? last.High ?? curP);
      slVal = isLong ? low : high;
    } else if (type === 'prev_bar' && prev) {
      const low = Number(prev.low ?? prev.Low ?? curP);
      const high = Number(prev.high ?? prev.High ?? curP);
      slVal = isLong ? low : high;
    } else if (type === 'supertrend' && supertrendVal) {
      slVal = supertrendVal;
    } else if (spreadValues && spreadValues[type.toLowerCase()]) {
      const spread = spreadValues[type.toLowerCase()];
      slVal = isLong ? curP - spread : curP + spread;
    }

    if (slVal !== null && Number.isFinite(slVal) && slVal > 0) {
      return formatCleanDecimal(slVal, 2);
    }
    return null;
  }, [liveCandle, sortedCandles, supertrendVal, spreadValues, livePrice]);

  const computeTpPrice = useCallback((type, currentPrice, currentSlPrice) => {
    if (!type || type === 'manual') return null;
    const curP = toFiniteNumber(currentPrice, 0) || Number(livePrice || 0);
    const slP = toFiniteNumber(currentSlPrice, 0);
    if (curP <= 0) return null;

    const isLong = slP > 0 ? curP >= slP : true;
    let tpVal = null;

    if (type === 'RR1.5') {
      const dist = slP > 0 ? Math.abs(curP - slP) : (spreadValues?.p50 || curP * 0.01);
      tpVal = isLong ? curP + dist * 1.5 : curP - dist * 1.5;
    } else if (type === 'RR2.0') {
      const dist = slP > 0 ? Math.abs(curP - slP) : (spreadValues?.p50 || curP * 0.01);
      tpVal = isLong ? curP + dist * 2.0 : curP - dist * 2.0;
    } else if (type === 'close_today' || type === 'close_next_day') {
      tpVal = curP;
    } else if (spreadValues && spreadValues[type.toLowerCase()]) {
      const spread = spreadValues[type.toLowerCase()];
      tpVal = isLong ? curP + spread : curP - spread;
    }

    if (tpVal !== null && Number.isFinite(tpVal) && tpVal > 0) {
      return formatCleanDecimal(tpVal, 2);
    }
    return null;
  }, [livePrice, spreadValues]);

  const handleChange = (field, nextValue) => {
    if (field === 'price') {
      setIsLivePriceLinked(false);
    }

    setForm(prev => {
      const next = { ...prev, [field]: nextValue };

      // If price was modified, recompute SL and TP if auto-modes are active
      if (field === 'price') {
        const pNum = toFiniteNumber(nextValue, 0);
        if (pNum > 0) {
          if (slType !== 'manual') {
            const autoSl = computeSlPrice(slType, pNum, next.slPrice);
            if (autoSl) next.slPrice = autoSl;
          }
          if (tpType !== 'manual') {
            const autoTp = computeTpPrice(tpType, pNum, next.slPrice);
            if (autoTp) next.tpPrice = autoTp;
          }
        }
      }

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
      if (slType !== 'manual') {
        const autoSl = computeSlPrice(slType, Number(livePrice), next.slPrice);
        if (autoSl) next.slPrice = autoSl;
      }
      if (tpType !== 'manual') {
        const autoTp = computeTpPrice(tpType, Number(livePrice), next.slPrice);
        if (autoTp) next.tpPrice = autoTp;
      }

      const sl = toFiniteNumber(next.slPrice, 0);
      const r = toFiniteNumber(next.riskAmount, 0) || riskAmount;
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

  const rawSymbolName = selectedSymbol?.Name || selectedSymbol?.name || '';
  const symUpper = rawSymbolName.toUpperCase();
  const accountName = (selectedAccount?.name || selectedAccount?.Name || '').toUpperCase();
  const marketName = (selectedAccount?.market?.Name || selectedAccount?.market?.name || '').toUpperCase();

  const isDerivative = (
    marketName.includes('DERIVATIVE') ||
    marketName.includes('PHÁI SINH') ||
    marketName.includes('FUTURES_VN') ||
    accountName.includes('DERIVATIVE') ||
    accountName.includes('PHÁI SINH') ||
    selectedAccount?.marketType === 'Derivative' ||
    ((symUpper === 'VN30F1M' || symUpper.startsWith('41I')) && !marketName.includes('CRYPTO') && !accountName.includes('BINANCE'))
  );

  const derivativeOptions = useMemo(() => {
    const list = [
      { value: '41I1GA000', label: '41I1GA000 (Tháng hiện tại - TCBS)' },
      { value: 'VN30F1M', label: 'VN30F1M (Hợp đồng chuẩn)' },
      { value: '41I1G4000', label: '41I1G4000' },
      { value: '41I1G8000', label: '41I1G8000' },
      { value: '41I1G9000', label: '41I1G9000' },
    ];
    if (Array.isArray(allSymbols)) {
      allSymbols.forEach(sym => {
        const sName = (sym.Name || sym.name || '').trim().toUpperCase();
        if (sName && (sName.startsWith('41I') || sName.includes('VN30')) && !list.some(item => item.value === sName)) {
          list.push({ value: sName, label: sName });
        }
      });
    }
    if (contractSymbol && !list.some(item => item.value === contractSymbol)) {
      list.unshift({ value: contractSymbol, label: `${contractSymbol} (Tùy chọn)` });
    }
    return list;
  }, [contractSymbol, allSymbols]);

  const slOptions = useMemo(() => [
    { value: 'manual', label: 'Tùy chỉnh (Nhập tay)' },
    { value: 'current_bar', label: 'Đáy/Đỉnh nến hiện tại' },
    { value: 'prev_bar', label: 'Đáy/Đỉnh nến hôm trước' },
    { value: 'P25', label: `Spread P25 (Hẹp${spreadValues?.p25 ? ` • ${formatCleanDecimal(spreadValues.p25, 2)}` : ''})` },
    { value: 'P50', label: `Spread P50 (Trung vị${spreadValues?.p50 ? ` • ${formatCleanDecimal(spreadValues.p50, 2)}` : ''})` },
    { value: 'P75', label: `Spread P75 (Rộng${spreadValues?.p75 ? ` • ${formatCleanDecimal(spreadValues.p75, 2)}` : ''}) - Mặc định` },
    { value: 'P90', label: `Spread P90 (Đột biến${spreadValues?.p90 ? ` • ${formatCleanDecimal(spreadValues.p90, 2)}` : ''})` },
    { value: 'P99', label: `Spread P99 (Cực đại${spreadValues?.p99 ? ` • ${formatCleanDecimal(spreadValues.p99, 2)}` : ''})` },
    { value: 'supertrend', label: 'Theo dải Supertrend' },
  ], [spreadValues]);

  const tpOptions = useMemo(() => [
    { value: 'manual', label: 'Tùy chỉnh (Nhập tay)' },
    { value: 'P25', label: `P25 (Spread Hẹp${spreadValues?.p25 ? ` • ${formatCleanDecimal(spreadValues.p25, 2)}` : ''})` },
    { value: 'P50', label: `P50 (Trung vị${spreadValues?.p50 ? ` • ${formatCleanDecimal(spreadValues.p50, 2)}` : ''})` },
    { value: 'P75', label: `P75 (Spread Rộng${spreadValues?.p75 ? ` • ${formatCleanDecimal(spreadValues.p75, 2)}` : ''})` },
    { value: 'P90', label: `P90 (Spread Đột biến${spreadValues?.p90 ? ` • ${formatCleanDecimal(spreadValues.p90, 2)}` : ''}) - Mặc định` },
    { value: 'P99', label: `P99 (Spread Cực đại${spreadValues?.p99 ? ` • ${formatCleanDecimal(spreadValues.p99, 2)}` : ''})` },
    { value: 'RR1.5', label: 'Theo R:R (1 : 1.5)' },
    { value: 'RR2.0', label: 'Theo R:R (1 : 2.0)' },
    { value: 'close_today', label: '🎯 Close ngày hiện tại' },
    { value: 'close_next_day', label: '🎯 Close ngày hôm sau' },
  ], [spreadValues]);

  const handleSlTypeChange = (type) => {
    setSlType(type);
    if (type === 'manual') return;

    const curP = toFiniteNumber(form.price, 0) || Number(livePrice || 0);
    const computedSl = computeSlPrice(type, curP, form.slPrice);
    if (computedSl) {
      handleChange('slPrice', computedSl);

      // If tpType is RR-based, automatically recalculate TP Price
      if (tpType === 'RR1.5' || tpType === 'RR2.0') {
        const computedTp = computeTpPrice(tpType, curP, computedSl);
        if (computedTp) {
          handleChange('tpPrice', computedTp);
        }
      }
    }
  };

  const handleTpTypeChange = (type) => {
    setTpType(type);
    if (type === 'manual') return;

    const curP = toFiniteNumber(form.price, 0) || Number(livePrice || 0);
    const computedTp = computeTpPrice(type, curP, form.slPrice);
    if (computedTp) {
      handleChange('tpPrice', computedTp);
    }
  };

  const handleSave = async () => {
    if (!canSave) return;

    setSaving(true);
    try {
      const now = new Date().toISOString();

      const isLong = slPrice > 0 ? (entryPrice >= slPrice) : (tpPrice > 0 ? entryPrice <= tpPrice : true);
      const tradeType = isLong ? 'Long' : 'Short';
      const orderSide = isLong ? 'Buy' : 'Sell';

      const isBinance = !isDerivative && (
        marketName.includes('CRYPTO') ||
        accountName.includes('BINANCE') ||
        symUpper.endsWith('.P') ||
        symUpper.includes('PERP') ||
        /USDT|\.P/i.test(rawSymbolName)
      );

      const isFutures = symUpper.endsWith('.P') ||
        symUpper.includes('PERP') ||
        accountName.includes('FUTURES') ||
        accountName.includes('DERIVATIVE') ||
        marketName.includes('FUTURES') ||
        marketName.includes('DERIVATIVE') ||
        /USDT|\.P/i.test(rawSymbolName);

      let brokerNote = '';

      // 1. If Derivative account, execute Condition Order on TCBS
      if (isDerivative) {
        const token = jwtToken || sessionStorage.getItem('tcbsJwtToken') || import.meta.env.VITE_TCBS_TOKEN;
        if (!token) {
          setShowOtpModal?.(true);
          throw new Error('Vui lòng xác thực OTP TCBS để gửi lệnh phái sinh.');
        }

        const cusCode = import.meta.env.VITE_TCBS_CUSTODYCODE || '105C078644';
        const targetContract = contractSymbol || '41I1GA000';
        const slDist = slPrice > 0 ? Math.abs(entryPrice - slPrice).toFixed(1) : '3';
        const tpDist = tpPrice > 0 ? Math.abs(tpPrice - entryPrice).toFixed(1) : '3';
        const refId = `H.${(cusCode || '078644').replace(/\D/g, '')}${Date.now()}`;

        const payload = {
          accountId: cusCode,
          subAccountId: cusCode + "A",
          side: isLong ? 'B' : 'S',
          symbol: targetContract,
          refId,
          price: parseFloat(entryPrice),
          volume: parseInt(volume) || 1,
          pin: "H",
          type: "string",
          cmd: "Web.newOrder",
          condition: {
            orderType: "SLP",
            stopLossUnit: slDist || "3",
            takeProfitUnit: tpDist || "3"
          }
        };

        const tcbsResult = await placeTCBSConditionOrder(token, payload);
        brokerNote = `[TCBS Placed] Symbol: ${targetContract}, Order Ref: ${refId}`;
      } else if (isBinance) {
        // 2. If Binance / Crypto account, execute order on Binance
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

      // 3. Only after order is successfully sent to broker, create trade in journal
      const targetDisplaySymbol = isDerivative ? (contractSymbol || rawSymbolName) : rawSymbolName;
      const plannedLines = [
        `Created from Trade Station order form (${isDerivative ? 'TCBS Derivative' : 'Binance'}).`,
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
      alert(`Đã đặt lệnh ${tradeType} ${targetDisplaySymbol} thành công và lưu vào Nhật ký!${brokerNote ? `\n${brokerNote}` : ''}`);
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

      {/* Derivative Symbol Selector for Derivative Account */}
      {isDerivative && (
        <div className="bg-gray-800/70 p-2.5 rounded-lg border border-cyan-500/40 space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-cyan-300 flex items-center gap-1.5">
              <span>Contract</span>
            </label>
            <span className="text-[10px] text-gray-400 font-mono">Gửi lệnh tới TCBS</span>
          </div>
          <select
            value={contractSymbol}
            onChange={(e) => {
              const val = e.target.value.toUpperCase();
              setContractSymbol(val);
              try {
                localStorage.setItem('derivative_contract_symbol', val);
              } catch { }
              onDerivativeSymbolChange?.(val);
            }}
            className="w-full rounded-lg border border-cyan-700/60 bg-gray-900 px-3 py-1.5 text-xs font-mono font-bold text-cyan-200 outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
          >
            {derivativeOptions.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-gray-900 text-white font-mono">
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

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
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-rose-300">SL Price</label>
            <span className="text-[10px] text-gray-500 font-mono">Stop Loss</span>
          </div>
          <select
            value={slType}
            onChange={(e) => handleSlTypeChange(e.target.value)}
            className="w-full rounded-lg border border-rose-900/60 bg-gray-900 px-2 py-1 text-[11px] font-medium text-rose-200 outline-none focus:ring-1 focus:ring-rose-500 cursor-pointer"
          >
            {slOptions.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-gray-900 text-white font-mono">
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="any"
            min="0"
            disabled={disabled || saving}
            value={form.slPrice}
            onChange={(e) => {
              setSlType('manual');
              handleChange('slPrice', e.target.value);
            }}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-right font-mono text-red-300 outline-none focus:ring-2 focus:ring-red-500 disabled:cursor-not-allowed disabled:opacity-50 text-xs"
            placeholder="Stop price"
          />
          <p className="mt-1 text-xs text-red-400">
            Risk/share: <span className="font-mono">{formatCleanDecimal(stopPriceDistance, 4)}</span>
          </p>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-emerald-300">TP Price</label>
            <span className="text-[10px] text-gray-500 font-mono">Take Profit</span>
          </div>
          <select
            value={tpType}
            onChange={(e) => handleTpTypeChange(e.target.value)}
            className="w-full rounded-lg border border-emerald-900/60 bg-gray-900 px-2 py-1 text-[11px] font-medium text-emerald-200 outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
          >
            {tpOptions.map(opt => (
              <option key={opt.value} value={opt.value} className="bg-gray-900 text-white font-mono">
                {opt.label}
              </option>
            ))}
          </select>
          <input
            type="number"
            step="any"
            min="0"
            disabled={disabled || saving}
            value={form.tpPrice}
            onChange={(e) => {
              setTpType('manual');
              handleChange('tpPrice', e.target.value);
            }}
            className="w-full rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-right font-mono text-green-300 outline-none focus:ring-2 focus:ring-green-500 disabled:cursor-not-allowed disabled:opacity-50 text-xs"
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

