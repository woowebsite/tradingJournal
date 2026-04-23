import { factories } from '@strapi/strapi';
import axios from 'axios';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * Map TradingView tf string to chart-img interval format.
 */
function mapInterval(tf: string): string {
  const map: Record<string, string> = {
    '1': '1m',
    '3': '3m',
    '5': '5m',
    '15': '15m',
    '30': '30m',
    '60': '1h',
    '120': '2h',
    '180': '3h',
    '240': '4h',
    'D': '1D',
    '1D': '1D',
    'W': '1W',
    '1W': '1W',
    'M': '1M',
    '1M': '1M',
  };
  return map[tf] || tf || '1D';
}

/**
 * Parse TradingView screenshot URL to direct S3 image URL.
 * Example: https://www.tradingview.com/x/m5ibckR4/ -> https://s3.tradingview.com/snapshots/m/m5ibckR4.png
 */
function getTradingViewDirectImageUrl(url: string): string | null {
  if (!url) return null;
  // Matches both full TradingView URLs and lone IDs (usually 8-12 alphanumeric characters)
  const match = url.match(/(?:tradingview\.com\/x\/)?([a-zA-Z0-9]{8,12})\/?/);
  if (match && match[1]) {
    const id = match[1];
    const firstChar = id.charAt(0).toLowerCase();
    return `https://s3.tradingview.com/snapshots/${firstChar}/${id}.png`;
  }
  return null;
}

/**
 * Fetch image buffer from a URL.
 */
async function fetchImageBufferFromUrl(url: string): Promise<Buffer | null> {
  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 20000,
    });
    return Buffer.from(response.data);
  } catch (err: any) {
    strapi.log.error(`[webhook-screenshot] Failed to fetch image from ${url}: ${err.message}`);
    return null;
  }
}

/**
 * Fetch chart screenshot from chart-img.com API v1 (Advanced Chart).
 * Returns binary PNG buffer or null if failed.
 */
async function fetchChartImgScreenshot(symbol: string, interval: string): Promise<Buffer | null> {
  const apiKey = process.env.CHART_IMG_API_KEY;
  if (!apiKey || apiKey === 'YOUR_CHART_IMG_API_KEY') {
    strapi.log.warn('[chart-img] CHART_IMG_API_KEY is not configured. Skipping fallback generation.');
    return null;
  }

  try {
    const response = await axios.get('https://api.chart-img.com/v1/tradingview/advanced-chart', {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      params: {
        symbol: symbol,
        interval: mapInterval(interval),
        theme: 'dark',
        width: 800,
        height: 500,
      },
      responseType: 'arraybuffer',
      timeout: 20000,
    });

    strapi.log.info(`[chart-img] Successfully generated fallback screenshot for ${symbol}`);
    return Buffer.from(response.data);
  } catch (err: any) {
    strapi.log.error(`[chart-img] Failed to generate fallback screenshot: ${err.message}`);
    return null;
  }
}

/**
 * Save buffer to a temporary file and upload to Strapi media library.
 * Returns the uploaded file record id or null.
 */
async function uploadChartImageToStrapi(imageBuffer: Buffer, filename: string): Promise<number | null> {
  const tmpDir = os.tmpdir();
  const tmpFilePath = path.join(tmpDir, filename);

  try {
    fs.writeFileSync(tmpFilePath, imageBuffer);

    const uploadedFiles = await strapi.plugin('upload').service('upload').upload({
      data: {
        fileInfo: {
          name: filename,
          alternativeText: filename,
          caption: '',
        },
      },
      files: {
        filepath: tmpFilePath,
        originalFilename: filename,
        mimetype: 'image/png',
        size: imageBuffer.length,
      },
    });

    if (uploadedFiles && uploadedFiles.length > 0) {
      return uploadedFiles[0].id;
    }
    return null;
  } catch (err: any) {
    strapi.log.error(`[webhook-screenshot] Failed to upload image to Strapi: ${err.message}`);
    return null;
  } finally {
    try {
      if (fs.existsSync(tmpFilePath)) {
        fs.unlinkSync(tmpFilePath);
      }
    } catch (_) { }
  }
}

export default factories.createCoreController('api::webhook.webhook', ({ strapi }) => ({
  async receive(ctx) {
    const { token } = ctx.params;

    const match = await strapi.db.query('api::webhook.webhook').findOne({
      where: {
        WebhookUrl: { $contains: token },
        webhookStatus: 'Enable'
      }
    });

    if (!match) {
      return ctx.notFound('Webhook not found or disabled');
    }

    const payload = ctx.request.body || {};
    const signalValue = payload.signal || payload.action || 'UNKNOWN';

    // 1. Extract ticker from "Market:Ticker" (e.g., BINANCE:BTCUSDT)
    const rawSymbol = payload.symbol || '';
    const symbolParts = rawSymbol.split(':');
    const ticker = symbolParts.length > 1 ? symbolParts[1] : symbolParts[0];
    const marketName = symbolParts.length > 1 ? symbolParts[0] : null;

    let linkedSymbolId = null;
    let symbolMatch = null;
    if (ticker) {
      // Find symbol by Name
      symbolMatch = await strapi.db.query('api::symbol.symbol').findOne({
        where: { Name: ticker }
      });

      if (!symbolMatch) {
        strapi.log.info(`[webhook] Symbol ${ticker} not found. Creating new symbol...`);

        let marketId = null;
        if (marketName) {
          const marketMatch = await strapi.db.query('api::market.market').findOne({
            where: { Name: marketName }
          });
          if (marketMatch) {
            marketId = marketMatch.id || marketMatch.documentId;
          }
        }

        // Create new symbol
        const newSymbol = await strapi.documents('api::symbol.symbol').create({
          data: {
            Name: ticker,
            market: marketId
          } as any,
          status: 'published'
        });
        symbolMatch = newSymbol;
      }
      linkedSymbolId = symbolMatch.documentId || symbolMatch.id;
    }

    // Create a new WebHookSignal record
    const newSignal = await strapi.documents('api::webhook-signal.webhook-signal').create({
      data: {
        symbol: payload.symbol,
        signal: signalValue,
        tf: payload.tf,
        signalStatus: 'Unread',
        createdDate: new Date().toISOString(),
        webhook: match.documentId,
        linked_symbol: linkedSymbolId
      },
      status: 'published'
    });

    // Async Screenshot Pipeline
    (async () => {
      try {
        let imageBuffer: Buffer | null = null;
        let sourceLabel = '';

        // 1. Try to get TradingView screenshot link
        // Priority: Symbol table chart_url > payload fields
        const screenshotUrl = symbolMatch?.chart_url || payload.screenshot || payload.chart_url || payload.imageUrl || payload.image;
        const tvDirectUrl = getTradingViewDirectImageUrl(screenshotUrl);

        if (tvDirectUrl) {
          strapi.log.info(`[webhook-screenshot] Attempting to fetch TV screenshot from ${tvDirectUrl}`);
          imageBuffer = await fetchImageBufferFromUrl(tvDirectUrl);
          if (imageBuffer) sourceLabel = 'TradingView';
        }

        // 2. Fallback to chart-img if no image and symbol exists
        if (!imageBuffer && payload.symbol) {
          strapi.log.info(`[webhook-screenshot] Falling back to chart-img generation for ${payload.symbol}`);
          imageBuffer = await fetchChartImgScreenshot(payload.symbol, payload.tf || '1D');
          if (imageBuffer) sourceLabel = 'chart-img';
        }

        if (imageBuffer) {
          const safeSymbol = String(payload.symbol || 'signal').replace(/[^a-zA-Z0-9]/g, '_');
          const filename = `chart_${safeSymbol}_${Date.now()}.png`;
          const fileId = await uploadChartImageToStrapi(imageBuffer, filename);

          if (fileId) {
            const updatedSignal = await strapi.documents('api::webhook-signal.webhook-signal').update({
              documentId: newSignal.documentId,
              data: { image: fileId } as any,
              status: 'published',
            });
            strapi.log.info(`[webhook-screenshot] ${sourceLabel} screenshot attached to signal ${newSignal.documentId}`);

            // Emit again so the frontend knows the image is ready
            if ((strapi as any).io) {
              (strapi as any).io.emit('tradingview_signal', {
                webhookId: match.id,
                title: match.Title,
                app: match.App,
                payload: payload,
                signalRecord: updatedSignal,
                timestamp: new Date().toISOString(),
                isUpdate: true
              });
            }
          }
        }
      } catch (err: any) {
        strapi.log.error(`[webhook-screenshot] Screenshot pipeline error: ${err.message}`);
      }
    })();

    if ((strapi as any).io) {
      (strapi as any).io.emit('tradingview_signal', {
        webhookId: match.id,
        title: match.Title,
        app: match.App,
        payload: payload,
        signalRecord: newSignal,
        timestamp: new Date().toISOString()
      });
    }

    ctx.send({ status: 'success', message: 'Signal received' });
  }
}));
