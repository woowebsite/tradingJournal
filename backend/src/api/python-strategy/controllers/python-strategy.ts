import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';

const execFileAsync = promisify(execFile);

const DEFAULT_GEMINI_MODEL = 'gemini-3.1-flash-lite';
const DEFAULT_GEMMA_MODEL = 'gemma4:e2b';

const normalizeText = (value = '') => value.replace(/\s+/g, ' ').trim();

const normalizeZaiBaseUrl = (input = '') => {
  const trimmed = normalizeText(input).replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.replace(/\/chat\/completions$/i, '');
};

const normalizeAIProvider = (provider = '') => {
  const normalized = normalizeText(provider).toLowerCase();
  if (normalized === 'openai') return 'openai';
  if (normalized === 'gemini') return 'gemini';
  if (normalized === 'gemma' || normalized === 'ollama' || normalized === 'gemma4') return 'gemma';
  return 'z.ai';
};

const normalizeGeminiModel = (value = '') => {
  const normalized = normalizeText(value);
  if (!normalized) return DEFAULT_GEMINI_MODEL;
  const aliases: Record<string, string> = {
    flash: DEFAULT_GEMINI_MODEL,
    'flash-lite': DEFAULT_GEMINI_MODEL,
    'gemini-flash-lite': DEFAULT_GEMINI_MODEL,
    'gemini-3.1-flash-lite': DEFAULT_GEMINI_MODEL,
    'gemini-2.5-flash-lite': 'gemini-2.5-flash-lite',
    'gemini-2.5-flash': 'gemini-2.5-flash',
    'gemini-1.5-flash': 'gemini-1.5-flash',
    'gemini-1.5-pro': 'gemini-1.5-pro',
  };
  return aliases[normalized.toLowerCase()] || normalized;
};

const normalizeGemmaModel = (value = '') => {
  const normalized = normalizeText(value);
  if (!normalized) return DEFAULT_GEMMA_MODEL;
  const aliases: Record<string, string> = {
    gemma4: DEFAULT_GEMMA_MODEL,
    'gemma4:latest': DEFAULT_GEMMA_MODEL,
  };
  return aliases[normalized.toLowerCase()] || normalized;
};

const resolveAIProviderConfig = (provider: string, requestedModel = '') => {
  if (provider === 'openai') {
    return {
      provider: 'openai',
      endpoint: normalizeZaiBaseUrl(String(process.env.OPEN_AI_API || 'https://api.openai.com/v1').trim()),
      apiKey: String(process.env.OPEN_AI_KEY || '').trim(),
      model: requestedModel || String(process.env.OPEN_AI_MODEL || 'gpt-4o-mini').trim(),
      missingApiMessage: 'Missing server env OPEN_AI_API.',
      missingKeyMessage: 'Missing server env OPEN_AI_KEY.',
      requiresKey: true,
    };
  }

  if (provider === 'gemini') {
    const envModel = normalizeGeminiModel(String(process.env.GEMINI_MODEL || ''));
    return {
      provider: 'gemini',
      endpoint: normalizeZaiBaseUrl(String(process.env.GEMINI_API || 'https://generativelanguage.googleapis.com/v1beta').trim()),
      apiKey: String(process.env.GEMINI_API_KEY || '').trim(),
      model: normalizeGeminiModel(requestedModel || envModel),
      missingApiMessage: 'Missing server env GEMINI_API.',
      missingKeyMessage: 'Missing server env GEMINI_API_KEY.',
      requiresKey: true,
    };
  }

  if (provider === 'gemma') {
    const envModel = normalizeGemmaModel(String(process.env.GEMMA_MODEL || ''));
    const endpoint = normalizeZaiBaseUrl(
      String(process.env.GEMMA_API || 'http://localhost:11434/api/generate').trim(),
    ) || 'http://localhost:11434/api/generate';
    return {
      provider: 'gemma',
      endpoint,
      apiKey: '',
      model: normalizeGemmaModel(requestedModel || envModel),
      missingApiMessage: 'Missing server env GEMMA_API.',
      missingKeyMessage: '',
      requiresKey: false,
    };
  }

  return {
    provider: 'z.ai',
    endpoint: normalizeZaiBaseUrl(String(process.env.ZAI_API || process.env.ZAI || process.env.ZAI_BASE_URL || '').trim()),
    apiKey: String(process.env.ZAI_API_KEY || '').trim(),
    model: requestedModel || String(process.env.ZAI_MODEL || 'glm-4.5').trim(),
    missingApiMessage: 'Missing server env ZAI_API.',
    missingKeyMessage: 'Missing server env ZAI_API_KEY.',
    requiresKey: true,
  };
};

const buildTradeAnalysisPrompt = (
  userPrompt: string,
  summary: Record<string, any> = {},
  params: Record<string, any> = {},
  trades: Array<Record<string, any>> = []
) => {
  const summaryLines = [
    `Ticker / Symbol: ${summary.ticker || summary.symbol || 'N/A'}`,
    `Timeframe: ${summary.timeframe || 'D1'}`,
    `Strategy File: ${summary.strategyFile || 'N/A'}`,
    `Total Trades: ${summary.totalTrades ?? trades.length}`,
    `Closed Trades: ${summary.closedTrades ?? trades.filter((t: any) => t.status === 'Closed').length}`,
    `Win Trades: ${summary.winTrades ?? trades.filter((t: any) => (t.pnl_percent || 0) > 0).length}`,
    `Loss Trades: ${summary.lossTrades ?? trades.filter((t: any) => (t.pnl_percent || 0) < 0).length}`,
    `Win Rate: ${summary.winRate !== undefined ? summary.winRate : 'N/A'}%`,
    `Profit Factor: ${summary.profitFactor !== undefined ? summary.profitFactor : 'N/A'}`,
    `Total PnL: ${summary.totalPnlPercent !== undefined ? summary.totalPnlPercent : 'N/A'}%`,
    `Avg PnL per Trade: ${summary.avgPnlPercent !== undefined ? summary.avgPnlPercent : 'N/A'}%`,
    `Gross Profit: ${summary.grossProfit !== undefined ? summary.grossProfit : 'N/A'}%`,
    `Gross Loss: ${summary.grossLoss !== undefined ? summary.grossLoss : 'N/A'}%`,
  ];

  const paramEntries = Object.entries(params || {})
    .filter(([_, v]) => v !== undefined && v !== null && typeof v !== 'object')
    .map(([k, v]) => `  - ${k}: ${v}`);

  const maxTradesInPrompt = 250;
  const tradesToInclude = trades.slice(0, maxTradesInPrompt);
  const tradeRows = tradesToInclude.map((t, idx) => {
    const num = idx + 1;
    const type = t.type || (t.is_long ? 'LONG' : (t.is_short ? 'SHORT' : 'N/A'));
    const entryDate = t.entry_date || t.entry_time || '-';
    const entryPrice = t.entry_price !== undefined ? Number(t.entry_price).toFixed(2) : '-';
    const exitDate = t.exit_date || t.exit_time || '-';
    const exitPrice = t.exit_price !== undefined ? Number(t.exit_price).toFixed(2) : '-';
    const pnl = t.pnl_percent !== undefined ? `${Number(t.pnl_percent).toFixed(2)}%` : '-';
    const reason = t.reason || t.exit_reason || t.status || '-';
    const bars = t.bars_held !== undefined ? `${t.bars_held} bars` : (t.hold_bars !== undefined ? `${t.hold_bars} bars` : '');
    return `${num}. [${type}] Vào: ${entryDate} @ ${entryPrice} | Ra: ${exitDate} @ ${exitPrice} | PnL: ${pnl} | Lý do: ${reason} ${bars ? `| Giữ: ${bars}` : ''}`;
  });

  const tradesText = tradeRows.length > 0
    ? tradeRows.join('\n') + (trades.length > maxTradesInPrompt ? `\n... và ${trades.length - maxTradesInPrompt} lệnh khác` : '')
    : 'Không có dữ liệu lệnh giao dịch.';

  return `${userPrompt}

=== TỔNG QUAN HIỆU SUẤT BACKTEST ===
${summaryLines.join('\n')}

=== THÔNG SỐ CHIẾN LƯỢC (PARAMETERS) ===
${paramEntries.length > 0 ? paramEntries.join('\n') : 'Mặc định'}

=== DANH SÁCH LỊCH SỬ LỆNH GIAO DỊCH (${trades.length} LỆNH) ===
${tradesText}`;
};

const SYSTEM_INSTRUCTION = 'Bạn là một chuyên gia phân tích định lượng (Quantitative Trading & Risk Management) hàng đầu. Hãy phân tích chuyên sâu lịch sử lệnh giao dịch của chiến lược, chỉ ra điểm mạnh, điểm yếu, các chuỗi thua lỗ, phân tích Win/Loss và đưa ra các giải pháp cụ thể để tối ưu hóa chiến lược bằng Tiếng Việt.';

const buildOpenAICompatiblePayload = (model: string, fullPrompt: string) => ({
  model,
  messages: [
    {
      role: 'system',
      content: SYSTEM_INSTRUCTION,
    },
    {
      role: 'user',
      content: fullPrompt,
    },
  ],
  temperature: 0.2,
});

const buildGeminiPayload = (fullPrompt: string) => ({
  contents: [
    {
      role: 'user',
      parts: [
        {
          text: [
            SYSTEM_INSTRUCTION,
            fullPrompt,
          ].join('\n\n'),
        },
      ],
    },
  ],
  generationConfig: {
    temperature: 0.2,
  },
});

const buildGemmaPayload = (model: string, fullPrompt: string) => ({
  model,
  prompt: fullPrompt,
  system: SYSTEM_INSTRUCTION,
  stream: false,
  options: {
    temperature: 0.2,
  },
});

const toBool = (val: any, defaultVal: boolean): boolean => {
  if (val === undefined || val === null) return defaultVal;
  if (val === false || val === 'false' || val === 0 || val === '0') return false;
  if (val === true || val === 'true' || val === 1 || val === '1') return true;
  return defaultVal;
};

export default {
  async list(ctx) {
    try {
      const rootDir = path.resolve(process.cwd(), '..');
      let strategyDir = path.join(rootDir, 'python-strategy');
      if (!fs.existsSync(strategyDir)) {
        strategyDir = path.resolve(process.cwd(), 'python-strategy');
      }

      if (!fs.existsSync(strategyDir)) {
        return ctx.send({ data: [] });
      }

      const files = fs.readdirSync(strategyDir);
      const pythonFiles = files
        .filter((file) => file.endsWith('.py'))
        .map((file) => {
          const name = file
            .replace(/^strategy_/, '')
            .replace(/\.py$/, '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, (c) => c.toUpperCase());
          return {
            fileName: file,
            name: `${name} Strategy`,
            path: path.join(strategyDir, file),
          };
        });

      return ctx.send({ data: pythonFiles });
    } catch (error: any) {
      return ctx.internalServerError(`Failed to list python strategies: ${error?.message || error}`);
    }
  },

  async scan(ctx) {
    try {
      const {
        strategyFile = 'strategy_supertrend_ma288.py',
        ticker = 'VNINDEX',
        countback = 1000,
        rr,
        riskReward,
        risk_reward,
        rewardRisk,
        entryType = 'candle_close',
        entry_type,
        stPeriod,
        st_period,
        supertrendPeriod,
        supertrend_period,
        stMultiplier,
        st_multiplier,
        supertrendMultiplier,
        supertrend_multiplier,
        maPeriod,
        ma_period,
        vwapMaPeriod,
        vwap_ma_period,
        tpSupertrend,
        tp_supertrend,
        tpRR,
        tp_rr,
        allowLong,
        allow_long,
        allowShort,
        allow_short,
        vwapAnchor,
        vwap_anchor,
        mult1,
        mult2,
        mult3,
        tpTarget,
        tp_target,
        vwapTpTarget,
        vwap_tp_target,
        paEngulfing,
        pa_engulfing,
        paBd3bu2,
        pa_bd3bu2,
        paIncludeOpposite,
        pa_include_opposite,
        paPointUp,
        pa_point_up,
        paSwingUp,
        pa_swing_up,
        tpType,
        tp_type,
        slType,
        sl_type,
        customTpVal,
        custom_tp_val,
        customSlVal,
        custom_sl_val,
        timeframe = 'D1',
      } = ctx.request.body || {};
      
      const cleanTimeframe = String(timeframe || 'D1').trim().toUpperCase();
      const cleanRR = rr !== undefined ? rr : (riskReward !== undefined ? riskReward : (risk_reward !== undefined ? risk_reward : (rewardRisk !== undefined ? rewardRisk : 1.5)));
      const cleanEntryType = entry_type || entryType || 'candle_close';
      const cleanStPeriod = st_period || stPeriod || supertrend_period || supertrendPeriod || 10;
      const cleanStMultiplier = st_multiplier || stMultiplier || supertrend_multiplier || supertrendMultiplier || 3.0;
      const cleanMaPeriod = ma_period || maPeriod || 288;
      const cleanVwapMa = vwapMaPeriod || vwap_ma_period || ma_period || maPeriod || 9;
      const cleanVwapAnchor = vwap_anchor || vwapAnchor || 'year';
      const cleanMult1 = mult1 !== undefined ? mult1 : 1.0;
      const cleanMult2 = mult2 !== undefined ? mult2 : 2.0;
      const cleanMult3 = mult3 !== undefined ? mult3 : 3.0;
      const cleanTpTarget = vwapTpTarget || vwap_tp_target || tp_target || tpTarget || 'tp1_vwap';
      const isTpSupertrend = toBool(tpSupertrend ?? tp_supertrend, true);
      const isTpRR = toBool(tpRR ?? tp_rr, true);
      const isAllowLong = toBool(allowLong ?? allow_long, true);
      const isAllowShort = toBool(allowShort ?? allow_short, true);

      // Price Action flags
      const isPaEngulfing = toBool(paEngulfing ?? pa_engulfing, true);
      const isPaBd3bu2 = toBool(paBd3bu2 ?? pa_bd3bu2, true);
      const isPaIncludeOpposite = toBool(paIncludeOpposite ?? pa_include_opposite, true);
      const isPaPointUp = toBool(paPointUp ?? pa_point_up, false);
      const isPaSwingUp = toBool(paSwingUp ?? pa_swing_up, false);
      const cleanTpType = tpType || tp_type || 'P50';
      const cleanSlType = slType || sl_type || 'P75';
      const cleanCustomTp = customTpVal !== undefined ? customTpVal : (custom_tp_val !== undefined ? custom_tp_val : 0.0);
      const cleanCustomSl = customSlVal !== undefined ? customSlVal : (custom_sl_val !== undefined ? custom_sl_val : 0.0);

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

      const pythonExe = process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3');
      const cleanTicker = String(ticker || 'VNINDEX').trim().toUpperCase();
      const isBreakout = safeFileName.toLowerCase().includes('breakout');
      const isVWAP = !isBreakout && safeFileName.toLowerCase().includes('vwap');
      const isPriceAction = !isBreakout && (safeFileName.toLowerCase().includes('priceaction') || safeFileName.toLowerCase().includes('price_action'));

      const args = [
        fullScriptPath,
        '--ticker', cleanTicker,
        '--timeframe', cleanTimeframe,
        '--json',
        '--countback', String(countback),
      ];

      if (isBreakout) {
        args.push(
          '--st-period', String(cleanStPeriod),
          '--st-multiplier', String(cleanStMultiplier),
          '--vwap-anchor', String(cleanVwapAnchor),
          '--indicator-filter', String(ctx.request.body?.indicatorFilter || ctx.request.body?.indicator_filter || 'st_or_vwap'),
          '--tp-type', String(cleanTpType),
          '--sl-type', String(cleanSlType),
          '--custom-tp-val', String(cleanCustomTp),
          '--custom-sl-val', String(cleanCustomSl),
          '--rr', String(cleanRR)
        );

        const isAllowBreakoutHigh = toBool(ctx.request.body?.allowBreakoutHigh ?? ctx.request.body?.allow_breakout_high, true);
        const isAllowSweepLow = toBool(ctx.request.body?.allowSweepLow ?? ctx.request.body?.allow_sweep_low, true);
        if (isAllowBreakoutHigh) args.push('--allow-breakout-high'); else args.push('--no-breakout-high');
        if (isAllowSweepLow) args.push('--allow-sweep-low'); else args.push('--no-sweep-low');

        if (isTpSupertrend) {
          args.push('--tp-supertrend');
        } else {
          args.push('--no-tp-supertrend');
        }
      } else if (isVWAP) {
        args.push(
          '--ma-period', String(cleanVwapMa),
          '--vwap-anchor', String(cleanVwapAnchor),
          '--mult1', String(cleanMult1),
          '--mult2', String(cleanMult2),
          '--mult3', String(cleanMult3),
          '--tp-target', String(cleanTpTarget)
        );
      } else if (isPriceAction) {
        args.push(
          '--st-period', String(cleanStPeriod),
          '--st-multiplier', String(cleanStMultiplier),
          '--tp-type', String(cleanTpType),
          '--sl-type', String(cleanSlType),
          '--custom-tp-val', String(cleanCustomTp),
          '--custom-sl-val', String(cleanCustomSl)
        );

        if (isPaEngulfing) args.push('--pa-engulfing'); else args.push('--no-pa-engulfing');
        if (isPaBd3bu2) args.push('--pa-bd3bu2'); else args.push('--no-pa-bd3bu2');
        if (isPaIncludeOpposite) args.push('--pa-include-opposite'); else args.push('--no-pa-include-opposite');
        if (isPaPointUp) args.push('--pa-point-up'); else args.push('--no-pa-point-up');
        if (isPaSwingUp) args.push('--pa-swing-up'); else args.push('--no-pa-swing-up');

        if (isTpSupertrend) {
          args.push('--tp-supertrend');
        } else {
          args.push('--no-tp-supertrend');
        }
      } else {
        args.push(
          '--rr', String(cleanRR),
          '--entry-type', String(cleanEntryType),
          '--st-period', String(cleanStPeriod),
          '--st-multiplier', String(cleanStMultiplier),
          '--ma-period', String(cleanMaPeriod)
        );

        // Thêm flags chốt lời theo lựa chọn từ Frontend
        if (isTpSupertrend) {
          args.push('--tp-supertrend');
        } else {
          args.push('--no-tp-supertrend');
        }

        if (isTpRR) {
          args.push('--tp-rr');
        } else {
          args.push('--no-tp-rr');
        }
      }

      // Thêm flags loại lệnh (Long / Short)
      if (isAllowLong) {
        args.push('--allow-long');
      } else {
        args.push('--no-long');
      }

      if (isAllowShort) {
        args.push('--allow-short');
      } else {
        args.push('--no-short');
      }

      const { stdout, stderr } = await execFileAsync(pythonExe, args, {
        maxBuffer: 1024 * 1024 * 20,
        timeout: 45000,
        env: {
          ...process.env,
          PYTHONWARNINGS: 'ignore',
          PYTHONIOENCODING: 'utf-8',
          STRAPI_BASE_URL: process.env.STRAPI_BASE_URL || `http://127.0.0.1:${process.env.PORT || 1337}`,
          STRAPI_API_TOKEN: process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || '',
        },
      });

      if (!stdout || stdout.trim().length === 0) {
        if (stderr) {
          return ctx.badRequest(`Python execution error: ${stderr}`);
        }
        return ctx.badRequest('Empty output from Python strategy.');
      }

      const jsonStart = stdout.indexOf('{');
      const jsonEnd = stdout.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        return ctx.badRequest(`Invalid JSON output from strategy: ${stdout.slice(0, 300)}`);
      }

      const parsed = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
      return ctx.send({ data: parsed });
    } catch (error: any) {
      const errDetail = error?.stderr || error?.stdout || error?.message || String(error);
      console.error('Python Strategy Scan Error:', errDetail);
      return ctx.badRequest(`Scan failed: ${errDetail}`);
    }
  },

  async optimize(ctx) {
    try {
      const {
        strategyFile = 'strategy_supertrend_ma288.py',
        ticker = 'VNINDEX',
        countback = 50000,
        allowLong,
        allow_long,
        allowShort,
        allow_short,
        timeframe = 'D1',
        vwapAnchor,
        vwap_anchor,
        riskReward,
        rr,
        entryType,
        entry_type,
        stPeriod,
        st_period,
        stMultiplier,
        st_multiplier,
        maPeriod,
        ma_period,
        tpSupertrend,
        tp_supertrend,
        tpRR,
        tp_rr,
        vwapMaPeriod,
        vwap_ma_period,
        vwapTpTarget,
        vwap_tp_target,
        mult1,
        mult2,
        mult3,
        paEngulfing,
        pa_engulfing,
        paBd3bu2,
        pa_bd3bu2,
        paIncludeOpposite,
        pa_include_opposite,
        paPointUp,
        pa_point_up,
        paSwingUp,
        pa_swing_up,
        tpType,
        tp_type,
        slType,
        sl_type,
        optConfig,
        opt_config,
      } = ctx.request.body || {};

      const cleanTimeframe = String(timeframe || 'D1').trim().toUpperCase();
      const isAllowLong = toBool(allowLong ?? allow_long, true);
      const isAllowShort = toBool(allowShort ?? allow_short, true);

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

      const pythonExe = process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3');
      const cleanTicker = String(ticker || 'VNINDEX').trim().toUpperCase();
      const isVWAP = safeFileName.toLowerCase().includes('vwap');

      const args = [
        fullScriptPath,
        '--ticker', cleanTicker,
        '--timeframe', cleanTimeframe,
        '--json',
        '--optimize',
        '--countback', String(countback),
      ];

      const safeOptConfig = optConfig || opt_config;
      if (safeOptConfig && typeof safeOptConfig === 'object') {
        args.push('--opt-config', JSON.stringify(safeOptConfig));
      }

      if (stPeriod || st_period) {
        args.push('--st-period', String(stPeriod || st_period));
      }
      if (stMultiplier || st_multiplier) {
        args.push('--st-multiplier', String(stMultiplier || st_multiplier));
      }
      if (maPeriod || ma_period || vwapMaPeriod || vwap_ma_period) {
        args.push('--ma-period', String(maPeriod || ma_period || vwapMaPeriod || vwap_ma_period));
      }
      if (riskReward || rr) {
        args.push('--rr', String(riskReward || rr));
      }
      if (entryType || entry_type) {
        args.push('--entry-type', String(entryType || entry_type));
      }

      if (tpSupertrend !== undefined || tp_supertrend !== undefined) {
        const isTpST = toBool(tpSupertrend ?? tp_supertrend, true);
        args.push(isTpST ? '--tp-supertrend' : '--no-tp-supertrend');
      }

      if (tpRR !== undefined || tp_rr !== undefined) {
        const isTpRiskReward = toBool(tpRR ?? tp_rr, true);
        args.push(isTpRiskReward ? '--tp-rr' : '--no-tp-rr');
      }

      if (mult1 !== undefined) args.push('--mult1', String(mult1));
      if (mult2 !== undefined) args.push('--mult2', String(mult2));
      if (mult3 !== undefined) args.push('--mult3', String(mult3));
      if (vwapTpTarget || vwap_tp_target) {
        args.push('--tp-target', String(vwapTpTarget || vwap_tp_target));
      }

      if (paEngulfing !== undefined || pa_engulfing !== undefined) {
        const isEngulf = toBool(paEngulfing ?? pa_engulfing, true);
        args.push(isEngulf ? '--pa-engulfing' : '--no-pa-engulfing');
      }
      if (paBd3bu2 !== undefined || pa_bd3bu2 !== undefined) {
        const isBd = toBool(paBd3bu2 ?? pa_bd3bu2, true);
        args.push(isBd ? '--pa-bd3bu2' : '--no-pa-bd3bu2');
      }
      if (paIncludeOpposite !== undefined || pa_include_opposite !== undefined) {
        const isInc = toBool(paIncludeOpposite ?? pa_include_opposite, true);
        args.push(isInc ? '--pa-include-opposite' : '--no-pa-include-opposite');
      }
      if (paPointUp !== undefined || pa_point_up !== undefined) {
        const isPt = toBool(paPointUp ?? pa_point_up, false);
        args.push(isPt ? '--pa-point-up' : '--no-pa-point-up');
      }
      if (paSwingUp !== undefined || pa_swing_up !== undefined) {
        const isSw = toBool(paSwingUp ?? pa_swing_up, false);
        args.push(isSw ? '--pa-swing-up' : '--no-pa-swing-up');
      }

      if (tpType || tp_type) {
        args.push('--tp-type', String(tpType || tp_type));
      }
      if (slType || sl_type) {
        args.push('--sl-type', String(slType || sl_type));
      }

      if (vwap_anchor || vwapAnchor) {
        const cleanVwapAnchor = vwap_anchor || vwapAnchor || 'year';
        args.push('--vwap-anchor', String(cleanVwapAnchor));
      }

      if (ctx.request.body?.indicatorFilter || ctx.request.body?.indicator_filter) {
        args.push('--indicator-filter', String(ctx.request.body?.indicatorFilter || ctx.request.body?.indicator_filter));
      }

      if (ctx.request.body?.allowBreakoutHigh !== undefined || ctx.request.body?.allow_breakout_high !== undefined) {
        const isAllowBreakoutHigh = toBool(ctx.request.body?.allowBreakoutHigh ?? ctx.request.body?.allow_breakout_high, true);
        args.push(isAllowBreakoutHigh ? '--allow-breakout-high' : '--no-breakout-high');
      }

      if (ctx.request.body?.allowSweepLow !== undefined || ctx.request.body?.allow_sweep_low !== undefined) {
        const isAllowSweepLow = toBool(ctx.request.body?.allowSweepLow ?? ctx.request.body?.allow_sweep_low, true);
        args.push(isAllowSweepLow ? '--allow-sweep-low' : '--no-sweep-low');
      }

      // Thêm flags loại lệnh (Long / Short)
      if (isAllowLong) {
        args.push('--allow-long');
      } else {
        args.push('--no-long');
      }

      if (isAllowShort) {
        args.push('--allow-short');
      } else {
        args.push('--no-short');
      }

      const { stdout, stderr } = await execFileAsync(pythonExe, args, {
        maxBuffer: 1024 * 1024 * 50,
        timeout: 180000,
        env: {
          ...process.env,
          PYTHONWARNINGS: 'ignore',
          PYTHONIOENCODING: 'utf-8',
          STRAPI_BASE_URL: process.env.STRAPI_BASE_URL || `http://127.0.0.1:${process.env.PORT || 1337}`,
          STRAPI_API_TOKEN: process.env.STRAPI_API_TOKEN || process.env.STRAPI_TOKEN || '',
        },
      });

      if (!stdout || stdout.trim().length === 0) {
        if (stderr) {
          return ctx.badRequest(`Python optimizer execution error: ${stderr}`);
        }
        return ctx.badRequest('Empty output from Python strategy optimizer.');
      }

      const jsonStart = stdout.indexOf('{');
      const jsonEnd = stdout.lastIndexOf('}');
      if (jsonStart === -1 || jsonEnd === -1) {
        return ctx.badRequest(`Invalid JSON output from strategy optimizer: ${stdout.slice(0, 300)}`);
      }

      const parsed = JSON.parse(stdout.slice(jsonStart, jsonEnd + 1));
      return ctx.send({ data: parsed });
    } catch (error: any) {
      const errDetail = error?.stderr || error?.stdout || error?.message || String(error);
      console.error('Python Strategy Optimize Error:', errDetail);
      return ctx.badRequest(`Optimization failed: ${errDetail}`);
    }
  },

  async aiAnalyze(ctx) {
    try {
      const body = ctx.request.body || {};
      const prompt = normalizeText(String(body.prompt || 'Hãy phân tích lịch sử lệnh giao dịch và hiệu suất của chiến lược trên.'));
      const trades = Array.isArray(body.trades) ? body.trades : [];
      const summary = body.summary && typeof body.summary === 'object' ? body.summary : {};
      const params = body.params && typeof body.params === 'object' ? body.params : {};
      const rawProvider = normalizeAIProvider(String(body.provider || 'z.ai'));
      const providerConfig = resolveAIProviderConfig(rawProvider, normalizeText(String(body.model || '')));
      const { endpoint, apiKey, model, provider } = providerConfig;

      if (!trades.length) {
        return ctx.badRequest('Không tìm thấy danh sách lệnh giao dịch để phân tích. Vui lòng quét chiến lược (Scan) trước.');
      }

      if (providerConfig.requiresKey && !apiKey) {
        return ctx.internalServerError(providerConfig.missingKeyMessage);
      }

      if (!endpoint) {
        return ctx.internalServerError(providerConfig.missingApiMessage);
      }

      const fullPrompt = buildTradeAnalysisPrompt(prompt, summary, params, trades);
      const isGemini = provider === 'gemini';
      const isGemma = provider === 'gemma';

      const response = await axios.post(
        isGemini
          ? `${endpoint}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
          : isGemma
            ? endpoint
            : `${endpoint}/chat/completions`,
        isGemini
          ? buildGeminiPayload(fullPrompt)
          : isGemma
            ? buildGemmaPayload(model, fullPrompt)
            : buildOpenAICompatiblePayload(model, fullPrompt),
        {
          timeout: 90000,
          headers: isGemini
            ? {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            }
            : isGemma
              ? {
                Accept: 'application/json',
                'Content-Type': 'application/json',
              }
              : {
                Authorization: `Bearer ${apiKey}`,
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
          validateStatus: () => true,
        },
      );

      if (response.status < 200 || response.status >= 300) {
        strapi.log.error(`${provider} strategy AI analysis failed: HTTP ${response.status}`, response.data);
        return ctx.badRequest(
          response.data?.error?.message ||
          response.data?.error ||
          response.data?.message ||
          `${provider} analysis failed with HTTP ${response.status}.`,
        );
      }

      return ctx.send({
        data: {
          provider,
          model,
          tradeCount: trades.length,
          analysis: response.data,
        },
      });
    } catch (error: any) {
      console.error('Python Strategy AI Analysis Error:', error);
      return ctx.internalServerError(`AI analysis failed: ${error?.response?.data?.error?.message || error?.message || error}`);
    }
  },
};


