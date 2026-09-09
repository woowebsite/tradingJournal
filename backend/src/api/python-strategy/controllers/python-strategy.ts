import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

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
        countback = 500,
        rr = 1.5,
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
        tpSupertrend,
        tp_supertrend,
        tpRR,
        tp_rr,
        allowLong,
        allow_long,
        allowShort,
        allow_short,
      } = ctx.request.body || {};
      
      const cleanEntryType = entry_type || entryType || 'candle_close';
      const cleanStPeriod = st_period || stPeriod || supertrend_period || supertrendPeriod || 10;
      const cleanStMultiplier = st_multiplier || stMultiplier || supertrend_multiplier || supertrendMultiplier || 3.0;
      const cleanMaPeriod = ma_period || maPeriod || 288;
      const isTpSupertrend = tpSupertrend !== undefined ? tpSupertrend : (tp_supertrend !== undefined ? tp_supertrend : true);
      const isTpRR = tpRR !== undefined ? tpRR : (tp_rr !== undefined ? tp_rr : true);
      const isAllowLong = allowLong !== undefined ? allowLong : (allow_long !== undefined ? allow_long : true);
      const isAllowShort = allowShort !== undefined ? allowShort : (allow_short !== undefined ? allow_short : true);

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
      const cleanTicker = String(ticker || 'VNINDEX').trim().toUpperCase();
      const args = [
        fullScriptPath,
        '--ticker', cleanTicker,
        '--json',
        '--countback', String(countback),
        '--rr', String(rr),
        '--entry-type', String(cleanEntryType),
        '--st-period', String(cleanStPeriod),
        '--st-multiplier', String(cleanStMultiplier),
        '--ma-period', String(cleanMaPeriod)
      ];

      // Thêm flags loại lệnh (Long / Short)
      if (isAllowLong === false || isAllowLong === 'false' || isAllowLong === 0) {
        args.push('--no-long');
      } else {
        args.push('--allow-long');
      }

      if (isAllowShort === false || isAllowShort === 'false' || isAllowShort === 0) {
        args.push('--no-short');
      } else {
        args.push('--allow-short');
      }

      // Thêm flags chốt lời theo lựa chọn từ Frontend
      if (isTpSupertrend === false || isTpSupertrend === 'false' || isTpSupertrend === 0) {
        args.push('--no-tp-supertrend');
      } else {
        args.push('--tp-supertrend');
      }

      if (isTpRR === false || isTpRR === 'false' || isTpRR === 0) {
        args.push('--no-tp-rr');
      } else {
        args.push('--tp-rr');
      }

      const { stdout, stderr } = await execFileAsync(pythonExe, args, {
        maxBuffer: 1024 * 1024 * 15,
        timeout: 30000,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
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
      return ctx.internalServerError(`Scan failed: ${error?.message || error}`);
    }
  },

  async optimize(ctx) {
    try {
      const {
        strategyFile = 'strategy_supertrend_ma288.py',
        ticker = 'VNINDEX',
        countback = 500,
        allowLong,
        allow_long,
        allowShort,
        allow_short,
      } = ctx.request.body || {};

      const isAllowLong = allowLong !== undefined ? allowLong : (allow_long !== undefined ? allow_long : true);
      const isAllowShort = allowShort !== undefined ? allowShort : (allow_short !== undefined ? allow_short : true);

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
      const cleanTicker = String(ticker || 'VNINDEX').trim().toUpperCase();
      const args = [
        fullScriptPath,
        '--ticker', cleanTicker,
        '--json',
        '--optimize',
        '--countback', String(countback),
      ];

      // Thêm flags loại lệnh (Long / Short)
      if (isAllowLong === false || isAllowLong === 'false' || isAllowLong === 0) {
        args.push('--no-long');
      } else {
        args.push('--allow-long');
      }

      if (isAllowShort === false || isAllowShort === 'false' || isAllowShort === 0) {
        args.push('--no-short');
      } else {
        args.push('--allow-short');
      }

      const { stdout, stderr } = await execFileAsync(pythonExe, args, {
        maxBuffer: 1024 * 1024 * 20,
        timeout: 60000,
        env: {
          ...process.env,
          PYTHONIOENCODING: 'utf-8',
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
      return ctx.internalServerError(`Optimization failed: ${error?.message || error}`);
    }
  },
};

