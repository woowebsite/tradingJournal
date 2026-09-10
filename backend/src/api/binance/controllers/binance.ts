/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from 'crypto';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

/**
 * Normalizes symbol for Binance (e.g. BINANCE:BTCUSDT.P -> BTCUSDT)
 */
function normalizeSymbol(symbol: string): { ticker: string; isFutures: boolean } {
  const clean = String(symbol || '').trim().toUpperCase();
  const isFutures = clean.endsWith('.P') || clean.includes('PERP') || clean.includes('FUTURES');
  const ticker = clean
    .replace(/^.*:/, '')
    .replace('.P', '')
    .replace('PERP', '')
    .replace('FUTURES', '')
    .trim();
  return { ticker, isFutures };
}

/**
 * Generates HMAC SHA256 signature for Binance API
 */
function generateSignature(queryString: string, secretKey: string): string {
  return crypto.createHmac('sha256', secretKey).update(queryString).digest('hex');
}

/**
 * Gets Binance Base URL based on Market Type (Futures vs Spot) and Testnet flag
 */
function getBinanceBaseUrl(isFutures: boolean, isTestnet: boolean): string {
  if (isFutures) {
    return isTestnet ? 'https://testnet.binancefuture.com' : 'https://fapi.binance.com';
  }
  return isTestnet ? 'https://testnet.binance.vision' : 'https://api.binance.com';
}

/**
 * Helper to extract Binance credentials from headers, body, or backend process.env
 */
function getBinanceCredentials(ctx: any): { apiKey: string; secretKey: string; isTestnet: boolean } {
  const headerKey = ctx.request?.headers?.['x-binance-api-key'] || ctx.headers?.['x-binance-api-key'];
  const headerSecret = ctx.request?.headers?.['x-binance-secret-key'] || ctx.headers?.['x-binance-secret-key'];
  const headerTestnet = ctx.request?.headers?.['x-binance-use-testnet'] || ctx.headers?.['x-binance-use-testnet'];

  const body = ctx.request?.body || {};
  const query = ctx.request?.query || {};

  const bodyKey = body.apiKey || body.binanceApiKey || query.apiKey;
  const bodySecret = body.secretKey || body.binanceSecretKey || body.apiSecret || query.secretKey;
  const bodyTestnet = body.isTestnet !== undefined ? body.isTestnet : query.isTestnet;

  const apiKey = String(
    headerKey || bodyKey || process.env.BINANCE_API_KEY || process.env.VITE_BINANCE_API_KEY || ''
  ).trim();

  const secretKey = String(
    headerSecret || bodySecret || process.env.BINANCE_SECRET_KEY || process.env.BINANCE_API_SECRET || process.env.VITE_BINANCE_API_SECRET || ''
  ).trim();

  let rawTestnet = headerTestnet !== undefined
    ? headerTestnet
    : (bodyTestnet !== undefined ? bodyTestnet : (process.env.BINANCE_TESTNET || process.env.VITE_BINANCE_USE_TESTNET));

  if (typeof rawTestnet === 'string') {
    rawTestnet = rawTestnet.split('#')[0].trim();
  }

  const isTestnet = String(rawTestnet || '').toLowerCase() === 'true' || rawTestnet === true;

  return { apiKey, secretKey, isTestnet };
}

// In-memory cache for Binance exchangeInfo
const exchangeInfoCache: Record<string, { timestamp: number; symbols: Map<string, { stepSize: number; minQty: number; precision: number; minNotional: number }> }> = {};

/**
 * Fetches and caches symbol LOT_SIZE, stepSize, precision and minNotional filters from Binance
 */
async function getSymbolFilters(ticker: string, isFutures: boolean, isTestnet: boolean) {
  const cleanTicker = ticker.toUpperCase();
  const cacheKey = `${isFutures ? 'fapi' : 'spot'}_${isTestnet ? 'test' : 'live'}`;
  const now = Date.now();
  let cached = exchangeInfoCache[cacheKey];

  if (!cached || now - cached.timestamp > 3600000) {
    try {
      const baseUrl = getBinanceBaseUrl(isFutures, isTestnet);
      const url = isFutures ? `${baseUrl}/fapi/v1/exchangeInfo` : `${baseUrl}/api/v3/exchangeInfo`;
      const res = await axios.get(url, { timeout: 10000 });
      const map = new Map<string, { stepSize: number; minQty: number; precision: number; minNotional: number }>();

      const symbols = res.data?.symbols || [];
      for (const s of symbols) {
        let stepSize = 0.001;
        let minQty = 0.001;
        let precision = s.quantityPrecision !== undefined ? Number(s.quantityPrecision) : 3;
        let minNotional = isFutures ? 5.0 : 10.0;

        for (const f of s.filters || []) {
          if (f.filterType === 'LOT_SIZE' || f.filterType === 'MARKET_LOT_SIZE') {
            if (f.stepSize) stepSize = parseFloat(f.stepSize);
            if (f.minQty) minQty = parseFloat(f.minQty);
          }
          if (f.filterType === 'MIN_NOTIONAL' || f.filterType === 'NOTIONAL') {
            if (f.notional) minNotional = parseFloat(f.notional);
            else if (f.minNotional) minNotional = parseFloat(f.minNotional);
          }
        }

        map.set(s.symbol.toUpperCase(), { stepSize, minQty, precision, minNotional });
      }

      cached = { timestamp: now, symbols: map };
      exchangeInfoCache[cacheKey] = cached;
    } catch (e) {
      console.warn('[Binance exchangeInfo cache fetch error]:', e);
    }
  }

  const symData = cached?.symbols?.get(cleanTicker);
  if (symData) return symData;

  // Fallback heuristic based on price / ticker
  return { stepSize: 0.001, minQty: 0.001, precision: 3, minNotional: 5.0 };
}

/**
 * Formats order quantity to match exact Binance LOT_SIZE and MIN_NOTIONAL requirements
 */
function formatQuantityWithFilters(rawQty: number, price: number, filters: { stepSize: number; minQty: number; precision: number; minNotional: number }): number {
  let qty = Number(rawQty);
  if (isNaN(qty) || qty <= 0) qty = filters.minQty || 0.001;

  const step = filters.stepSize || 0.001;
  const precision = filters.precision !== undefined ? filters.precision : 3;

  // Floor to nearest stepSize
  let formatted = Math.floor(qty / step) * step;
  formatted = Number(formatted.toFixed(precision));

  if (formatted < filters.minQty) {
    formatted = filters.minQty;
  }

  // Ensure minimum notional value
  const notional = formatted * (price || 1);
  if (price > 0 && notional < filters.minNotional) {
    const needed = (filters.minNotional * 1.05) / price;
    formatted = Math.ceil(needed / step) * step;
    formatted = Number(formatted.toFixed(precision));
  }

  return formatted;
}

/**
 * Parses Binance API error code and returns user-friendly Vietnamese diagnosis
 */
function parseBinanceError(errData: any): string {
  if (!errData) return 'Lỗi không xác định từ Binance API.';
  const code = errData.code;
  const msg = errData.msg || errData.message || (typeof errData === 'string' ? errData : JSON.stringify(errData));

  switch (code) {
    case -2015:
      return `[Mã -2015]: API Key không hợp lệ, bị giới hạn IP hoặc tài khoản CHƯA BẬT QUYỀN 'Enable Futures' trên trang quản lý API Binance.`;
    case -2019:
    case -2010:
      return `[Mã -2019 / -2010]: Số dư khả dụng (USDT) trong ví Futures không đủ để mở vị thế. Vui lòng chuyển USDT vào ví Futures.`;
    case -1021:
      return `[Mã -1021]: Lệch thời gian đồng hồ máy tính so với máy chủ Binance (Timestamp out of sync).`;
    case -1013:
    case -1111:
      return `[Mã -1013 / -1111]: Khối lượng đặt lệnh vi phạm bộ lọc LOT_SIZE hoặc MIN_NOTIONAL (${msg}).`;
    case -4061:
      return `[Mã -4061]: Chế độ Position Mode (Hedge Mode vs One-way Mode) không khớp với thiết lập tài khoản Binance Futures.`;
    case -4164:
      return `[Mã -4164]: Giá trị lệnh tối thiểu (Notional) phải lớn hơn 5 USDT.`;
    default:
      return `[Lỗi Binance ${code ? `Mã ${code}` : ''}]: ${msg}`;
  }
}

/**
 * Helper to safely convert an object with numbers/booleans/strings to URL query string
 */
function toQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null) {
      searchParams.append(key, String(val));
    }
  }
  return searchParams.toString();
}

/**
 * Sends order request to Binance with automatic Hedge / One-way mode detection and recvWindow=60000
 */
async function postBinanceOrder({
  baseUrl,
  endpoint,
  apiKey,
  secretKey,
  params,
}: {
  baseUrl: string;
  endpoint: string;
  apiKey: string;
  secretKey: string;
  params: Record<string, any>;
}) {
  const timestamp = Date.now();
  const fullParams: Record<string, any> = {
    ...params,
    timestamp,
    recvWindow: 60000,
  };

  const queryString = toQueryString(fullParams);
  const signature = generateSignature(queryString, secretKey);
  const payload = `${queryString}&signature=${signature}`;

  try {
    return await axios.post(`${baseUrl}${endpoint}`, payload, {
      headers: {
        'X-MBX-APIKEY': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 15000,
    });
  } catch (err: any) {
    // If error is -4061 (Hedge mode mismatch on Futures), retry with positionSide
    const errData = err.response?.data;
    if (errData && errData.code === -4061) {
      const isLong = String(params.side || '').toUpperCase() === 'BUY';
      const hedgeParams: Record<string, any> = {
        ...fullParams,
        positionSide: isLong ? 'LONG' : 'SHORT',
        timestamp: Date.now(),
      };
      const hedgeQuery = toQueryString(hedgeParams);
      const hedgeSig = generateSignature(hedgeQuery, secretKey);
      const hedgePayload = `${hedgeQuery}&signature=${hedgeSig}`;

      return await axios.post(`${baseUrl}${endpoint}`, hedgePayload, {
        headers: {
          'X-MBX-APIKEY': apiKey,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15000,
      });
    }
    throw err;
  }
}

export default {
  /**
   * Check Binance account balance and API connection
   */
  async account(ctx: any) {
    try {
      const { apiKey, secretKey, isTestnet } = getBinanceCredentials(ctx);
      const isFutures = String(ctx.request?.query?.market || '').toLowerCase().includes('future');

      if (!apiKey || !secretKey) {
        return ctx.send({
          success: true,
          mode: 'paper',
          message: 'Binance API Keys not configured. System is running in Paper Trading / Simulation mode.',
          balances: [
            { asset: 'USDT', free: '10000.00', locked: '0.00' },
            { asset: 'BTC', free: '0.50', locked: '0.00' },
          ],
        });
      }

      const timestamp = Date.now();
      const queryString = `timestamp=${timestamp}&recvWindow=60000`;
      const signature = generateSignature(queryString, secretKey);

      const baseUrl = getBinanceBaseUrl(isFutures, isTestnet);
      const endpoint = isFutures ? '/fapi/v2/account' : '/api/v3/account';
      const accountUrl = `${baseUrl}${endpoint}?${queryString}&signature=${signature}`;

      const response = await axios.get(accountUrl, {
        headers: { 'X-MBX-APIKEY': apiKey },
        timeout: 10000,
      });

      return ctx.send({
        success: true,
        mode: isTestnet ? 'testnet' : 'live',
        market: isFutures ? 'futures' : 'spot',
        data: response.data,
      });
    } catch (error: any) {
      const errData = error.response?.data || error.message;
      const friendlyMsg = parseBinanceError(errData);
      console.error('[Binance Account Error]:', friendlyMsg, errData);
      return ctx.send({
        success: false,
        error: errData,
        message: friendlyMsg,
      });
    }
  },

  /**
   * Place an order directly to Binance
   */
  async order(ctx: any) {
    try {
      const {
        symbol,
        side, // 'BUY' | 'SELL'
        type = 'MARKET', // 'MARKET' | 'LIMIT'
        quantity,
        price,
        timeInForce = 'GTC',
        isFutures: overrideFutures,
      } = ctx.request.body || {};

      if (!symbol || !side || !quantity) {
        return ctx.badRequest('Missing required fields: symbol, side, quantity.');
      }

      const { ticker, isFutures: detectedFutures } = normalizeSymbol(symbol);
      const isFutures = overrideFutures !== undefined ? Boolean(overrideFutures) : detectedFutures;
      const { apiKey, secretKey, isTestnet } = getBinanceCredentials(ctx);

      const numPrice = price ? Number(price) : 0;
      const filters = await getSymbolFilters(ticker, isFutures, isTestnet);
      const orderQty = formatQuantityWithFilters(Number(quantity), numPrice, filters);

      console.log('[Binance Order Request]', {
        symbol: ticker,
        isFutures,
        side: side.toUpperCase(),
        quantity: orderQty,
        isTestnet,
        hasApiKey: Boolean(apiKey),
      });

      // If no API keys, simulate order placement
      if (!apiKey || !secretKey) {
        const simulatedOrderId = `SIM-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
        return ctx.send({
          success: true,
          mode: 'paper',
          message: 'Order simulated successfully (Paper trading mode - No API keys found).',
          order: {
            orderId: simulatedOrderId,
            symbol: ticker,
            side: side.toUpperCase(),
            type: type.toUpperCase(),
            origQty: String(orderQty),
            executedQty: String(orderQty),
            price: price ? String(price) : '0',
            status: 'FILLED',
            isFutures,
            mode: 'simulated',
            transactTime: Date.now(),
          },
        });
      }

      const params: Record<string, any> = {
        symbol: ticker,
        side: side.toUpperCase(),
        type: type.toUpperCase(),
        quantity: orderQty,
      };

      if (type.toUpperCase() === 'LIMIT' && price) {
        params.price = Number(price);
        params.timeInForce = timeInForce;
      }

      const baseUrl = getBinanceBaseUrl(isFutures, isTestnet);
      const endpoint = isFutures ? '/fapi/v1/order' : '/api/v3/order';

      const response = await postBinanceOrder({
        baseUrl,
        endpoint,
        apiKey,
        secretKey,
        params,
      });

      return ctx.send({
        success: true,
        mode: isTestnet ? 'testnet' : 'live',
        order: response.data,
      });
    } catch (error: any) {
      const errData = error.response?.data || error.message;
      const friendlyMsg = parseBinanceError(errData);
      console.error('[Binance Order Error]:', friendlyMsg, errData);
      return ctx.badRequest({
        success: false,
        message: friendlyMsg,
        error: errData,
      });
    }
  },

  /**
   * Execute full strategy trade: sends order to Binance and creates Open Trade in Strapi
   */
  async executeStrategyTrade(ctx: any) {
    try {
      const {
        symbol, // symbol documentId or ticker string
        accountId,
        strategyId,
        signal, // { type: 'Long' | 'Short', entry, stop_loss, take_profit, date }
        volume,
        riskAmount,
        note,
      } = ctx.request.body || {};

      if (!signal || !signal.type || !signal.entry) {
        return ctx.badRequest('Invalid signal data for trade execution.');
      }

      const isLong = signal.type.toLowerCase() === 'long';
      const side = isLong ? 'BUY' : 'SELL';
      const entryPrice = Number(signal.entry);
      const slPrice = signal.stop_loss ? Number(signal.stop_loss) : null;
      const tpPrice = signal.take_profit ? Number(signal.take_profit) : null;

      // 1. Identify symbol ticker
      let symTicker = 'BTCUSDT';
      let symEntityId: any = null;

      if (typeof symbol === 'string' && (symbol.length === 24 || symbol.length === 16 || !symbol.includes('USDT'))) {
        try {
          const foundSym = await (strapi as any).documents('api::symbol.symbol').findOne({
            documentId: symbol,
          });
          if (foundSym) {
            symTicker = foundSym.Name || foundSym.name || symTicker;
            symEntityId = foundSym.documentId || foundSym.id;
          } else {
            symTicker = symbol;
            symEntityId = symbol;
          }
        } catch {
          symTicker = symbol;
          symEntityId = symbol;
        }
      } else if (typeof symbol === 'object' && symbol) {
        symTicker = symbol.Name || symbol.name || 'BTCUSDT';
        symEntityId = symbol.documentId || symbol.id;
      } else if (symbol) {
        symTicker = String(symbol);
        symEntityId = symbol;
      }

      const { ticker, isFutures } = normalizeSymbol(symTicker);
      const { apiKey, secretKey, isTestnet } = getBinanceCredentials(ctx);

      // 2. Fetch symbol exchange filters & calculate exact volume
      const filters = await getSymbolFilters(ticker, isFutures, isTestnet);

      let rawOrderQty = volume ? Number(volume) : 0;
      if (rawOrderQty <= 0 && riskAmount && slPrice) {
        const stopDistance = Math.abs(entryPrice - slPrice);
        if (stopDistance > 0) {
          rawOrderQty = Number(riskAmount) / stopDistance;
        }
      }
      const orderQty = formatQuantityWithFilters(rawOrderQty, entryPrice, filters);

      console.log('[Binance Execute Strategy Trade]', {
        symbol: ticker,
        isFutures,
        side,
        entryPrice,
        orderQty,
        isTestnet,
        hasApiKey: Boolean(apiKey),
      });

      // 3. Send Order to Binance or Simulate
      let binanceOrderResult: any = null;
      let executionMode = 'paper';

      if (apiKey && secretKey) {
        try {
          const params: Record<string, any> = {
            symbol: ticker,
            side,
            type: 'MARKET',
            quantity: orderQty,
          };

          const baseUrl = getBinanceBaseUrl(isFutures, isTestnet);
          const endpoint = isFutures ? '/fapi/v1/order' : '/api/v3/order';

          const res = await postBinanceOrder({
            baseUrl,
            endpoint,
            apiKey,
            secretKey,
            params,
          });

          binanceOrderResult = res.data;
          executionMode = isTestnet ? 'testnet' : 'live';
          console.log('[Binance Order Live Success]:', binanceOrderResult);
        } catch (binanceErr: any) {
          const errData = binanceErr.response?.data || binanceErr.message;
          const friendlyMsg = parseBinanceError(errData);
          console.error('[Binance Execution Error]:', friendlyMsg, errData);
          return ctx.badRequest({
            success: false,
            message: friendlyMsg,
            error: errData,
          });
        }
      } else {
        // Simulated order when no API key is present
        binanceOrderResult = {
          orderId: `SIM-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          symbol: ticker,
          side,
          type: 'MARKET',
          origQty: String(orderQty),
          executedQty: String(orderQty),
          price: String(entryPrice),
          status: 'FILLED',
          isFutures,
          mode: 'simulated',
          transactTime: Date.now(),
        };
        executionMode = 'paper';
      }

      // 4. Record Trade into Strapi Database
      const nowIso = signal.date || new Date().toISOString();
      const orderIdStr = binanceOrderResult.orderId || binanceOrderResult.clientOrderId || 'N/A';

      const plannedLines = [
        `Auto Trade executed on Candle Close via Python Strategy.`,
        `Binance Order ID: ${orderIdStr} (${isFutures ? 'Futures' : 'Spot'} - ${executionMode.toUpperCase()})`,
        slPrice ? `Planned SL: ${slPrice}` : null,
        tpPrice ? `Planned TP: ${tpPrice}` : null,
        note || null,
      ].filter(Boolean);

      const tradePayload: any = {
        type: isLong ? 'Long' : 'Short',
        trade_status: 'Open',
        mode: executionMode === 'live' ? 'Real' : 'Paper',
        date: nowIso,
        note: plannedLines.join('\n'),
      };

      if (symEntityId) {
        tradePayload.symbol = symEntityId;
      }
      if (accountId) {
        tradePayload.account = accountId;
      }
      if (strategyId) {
        tradePayload.strategy = strategyId;
      }

      let createdTrade: any = null;
      try {
        createdTrade = await (strapi as any).documents('api::trade.trade').create({
          data: tradePayload,
        });

        if (createdTrade) {
          try {
            await (strapi as any).documents('api::trade-detail.trade-detail').create({
              data: {
                trade: createdTrade.documentId || createdTrade.id,
                date: nowIso,
                signal: 'Entry',
                type: isLong ? 'Buy' : 'Sell',
                price: entryPrice,
                volume: orderQty,
                note: `Entry filled @ ${entryPrice}. SL: ${slPrice || '--'}, TP: ${tpPrice || '--'}. Order ID: ${orderIdStr}`,
              },
            });
          } catch (detailErr) {
            console.warn('Could not create trade detail entity (optional):', detailErr);
          }
        }
      } catch (dbErr: any) {
        console.error('Failed to create trade in Strapi DB:', dbErr?.message || dbErr);
      }

      return ctx.send({
        success: true,
        mode: executionMode,
        message: `Auto Trade executed successfully: ${side} ${ticker} @ ${entryPrice} [${executionMode.toUpperCase()}]`,
        binanceOrder: binanceOrderResult,
        trade: createdTrade,
      });
    } catch (error: any) {
      console.error('[Execute Strategy Trade Error]:', error);
      return ctx.internalServerError(`Failed to execute strategy trade: ${error?.message || error}`);
    }
  },

  /**
   * Scans python strategy and automatically trades if signal is present on latest candle
   */
  async scanAndTrade(ctx: any) {
    try {
      const {
        strategyFile = 'strategy_supertrend_ma288.py',
        ticker = 'BTCUSDT',
        timeframe = 'D1',
        countback = 500,
        accountId,
        strategyId,
        symbolId,
        riskAmount,
        volume,
        ...strategyConfig
      } = ctx.request.body || {};

      const cleanTicker = String(ticker).trim().toUpperCase();
      const cleanTimeframe = String(timeframe || 'D1').trim().toUpperCase();

      const rootDir = path.resolve(process.cwd(), '..');
      let strategyDir = path.join(rootDir, 'python-strategy');
      if (!fs.existsSync(strategyDir)) {
        strategyDir = path.resolve(process.cwd(), 'python-strategy');
      }

      const safeFileName = path.basename(strategyFile);
      const fullScriptPath = path.join(strategyDir, safeFileName);
      if (!fs.existsSync(fullScriptPath)) {
        return ctx.badRequest(`Strategy file ${strategyFile} not found.`);
      }

      const pythonExe = process.env.PYTHON_PATH || 'python';
      const isVWAP = safeFileName.toLowerCase().includes('vwap');

      const args = [
        fullScriptPath,
        '--ticker', cleanTicker,
        '--timeframe', cleanTimeframe,
        '--json',
        '--countback', String(countback),
      ];

      if (isVWAP) {
        if (strategyConfig.maPeriod) args.push('--ma-period', String(strategyConfig.maPeriod));
        if (strategyConfig.vwapAnchor) args.push('--vwap-anchor', String(strategyConfig.vwapAnchor));
        if (strategyConfig.tpTarget) args.push('--tp-target', String(strategyConfig.tpTarget));
      } else {
        if (strategyConfig.rr) args.push('--rr', String(strategyConfig.rr));
        if (strategyConfig.stPeriod) args.push('--st-period', String(strategyConfig.stPeriod));
        if (strategyConfig.stMultiplier) args.push('--st-multiplier', String(strategyConfig.stMultiplier));
        if (strategyConfig.maPeriod) args.push('--ma-period', String(strategyConfig.maPeriod));
      }

      const { stdout } = await execFileAsync(pythonExe, args, {
        maxBuffer: 1024 * 1024 * 20,
        timeout: 45000,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
          STRAPI_BASE_URL: process.env.STRAPI_BASE_URL || 'http://127.0.0.1:1337',
          STRAPI_API_TOKEN: process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || '',
        },
      });

      const jsonStart = stdout.indexOf('{');
      const jsonEnd = stdout.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        return ctx.badRequest('Invalid strategy scan result output.');
      }

      const scanResult = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
      const activeTrade = scanResult.summary?.activeTrade;
      const latestTrade = scanResult.summary?.latestTrade;

      let actionableSignal: any = null;
      if (activeTrade && activeTrade.entry_price && activeTrade.stop_loss) {
        actionableSignal = {
          type: activeTrade.type || 'Long',
          entry: activeTrade.entry_price,
          stop_loss: activeTrade.stop_loss,
          take_profit: activeTrade.take_profit,
          date: activeTrade.entry_date,
        };
      } else if (latestTrade && latestTrade.entry_price && latestTrade.stop_loss) {
        actionableSignal = {
          type: latestTrade.type || 'Long',
          entry: latestTrade.entry_price,
          stop_loss: latestTrade.stop_loss,
          take_profit: latestTrade.take_profit,
          date: latestTrade.entry_date,
        };
      }

      if (!actionableSignal) {
        return ctx.send({
          success: true,
          action: 'no_signal',
          message: 'No actionable signal found on current candle close.',
          scanSummary: scanResult.summary,
        });
      }

      // Check if open trade already exists for this symbol & account in Strapi
      if (symbolId && accountId) {
        try {
          const existingTrades = await (strapi as any).documents('api::trade.trade').findMany({
            filters: {
              symbol: { documentId: symbolId },
              account: { documentId: accountId },
              trade_status: 'Open',
            },
          });
          if (existingTrades && existingTrades.length > 0) {
            return ctx.send({
              success: true,
              action: 'already_open',
              message: `Symbol ${cleanTicker} already has an Open Trade. Skipped duplicate entry.`,
              existingTradeId: existingTrades[0].documentId || existingTrades[0].id,
              signal: actionableSignal,
            });
          }
        } catch (chkErr) {
          console.warn('Could not check existing open trades:', chkErr);
        }
      }

      // Forward to executeStrategyTrade logic with existing body parameters
      ctx.request.body = {
        ...ctx.request.body,
        symbol: symbolId || cleanTicker,
        accountId,
        strategyId,
        signal: actionableSignal,
        volume,
        riskAmount,
        note: `Auto-scanned and executed on candle close (${cleanTimeframe})`,
      };

      return this.executeStrategyTrade(ctx);
    } catch (error: any) {
      console.error('[Scan and Trade Error]:', error);
      return ctx.internalServerError(`Scan and trade failed: ${error?.message || error}`);
    }
  },
};
