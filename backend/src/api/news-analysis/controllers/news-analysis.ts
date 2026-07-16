/**
 * news-analysis controller
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
import axios from 'axios';
import { factories } from '@strapi/strapi';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const MAX_ITEMS_PER_SOURCE = 25;
const NEWS_ANALYSIS_UID = 'api::news-analysis.news-analysis' as any;

const decodeHtml = (value = '') => {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_match, code) => String.fromCharCode(parseInt(code, 16)));
};

const normalizeText = (value = '') => decodeHtml(value).replace(/\s+/g, ' ').trim();

const stripTags = (html = '') => normalizeText(html.replace(/<[^>]*>/g, ' '));

const escapeRegExp = (value = '') => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getMetaContent = (html: string, key: string) => {
  const escapedKey = escapeRegExp(key);
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escapedKey}["'][^>]*content=["']([^"']+)["'][^>]*>`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${escapedKey}["'][^>]*>`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return normalizeText(match[1]);
  }
  return '';
};

const getFirstTagText = (html: string, tagName: string) => {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'));
  return match?.[1] ? stripTags(match[1]) : '';
};

const getAttr = (tag: string, attrName: string) => {
  const match = tag.match(new RegExp(`${attrName}\\s*=\\s*["']([^"']+)["']`, 'i'));
  return match?.[1] ? decodeHtml(match[1]) : '';
};

const uniqueStrings = (items: string[]) => Array.from(new Set(items));

const normalizeHost = (value = '') => value.toLowerCase().replace(/^www\./, '');

const getOriginKey = (inputUrl: string) => {
  try {
    const parsed = new URL(inputUrl);
    return `${parsed.protocol}//${normalizeHost(parsed.hostname)}`;
  } catch {
    return '';
  }
};

const sameOrigin = (leftUrl: string, rightUrl: string) => {
  const left = getOriginKey(leftUrl);
  const right = getOriginKey(rightUrl);
  return Boolean(left && right && left === right);
};

const normalizeSourcePatternInput = (input = '') => {
  const trimmed = normalizeText(input);
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
};

const tokenToRegex = (token = '') => {
  const lower = token.trim().toLowerCase();
  switch (lower) {
    case 'year':
      return '\\d{4}';
    case 'month':
    case 'day':
    case 'hour':
    case 'minute':
    case 'second':
      return '\\d{2}';
    case 'id':
      return '\\d+';
    case 'slug':
    case 'path':
    case 'section':
    case 'category':
    case 'article':
    case 'title':
    case 'name':
      return '[^/?#]+';
    default:
      if (/^\\d\{\d+\}$/.test(lower)) return lower;
      return '[^/?#]+';
  }
};

const segmentToRegex = (segment = '') => {
  let output = '';
  for (let index = 0; index < segment.length;) {
    const char = segment[index];
    if (char === '*') {
      if (segment[index + 1] === '*') {
        output += '.*';
        index += 2;
      } else {
        output += '[^/?#]+';
        index += 1;
      }
      continue;
    }

    if (char === '{') {
      const closingIndex = segment.indexOf('}', index + 1);
      if (closingIndex > index + 1) {
        const token = segment.slice(index + 1, closingIndex);
        output += tokenToRegex(token);
        index = closingIndex + 1;
        continue;
      }
    }

    output += escapeRegExp(char);
    index += 1;
  }

  return output;
};

const hasDynamicPattern = (pathname: string) => /[*{]/.test(pathname);

const hasExplicitFileExtension = (pathname: string) => {
  const lastSegment = pathname.split('/').filter(Boolean).pop() || '';
  return /\.[a-z0-9]+$/i.test(lastSegment);
};

const buildPatternRule = (inputPattern: string) => {
  const normalizedPattern = normalizeSourcePatternInput(inputPattern);
  if (!normalizedPattern) return null;

  const match = normalizedPattern.match(/^(https?:\/\/[^\/?#]+)(\/[^?#]*)?(?:[?#].*)?$/i);
  if (!match) {
    return null;
  }

  const originUrl = new URL(match[1]);
  const protocol = originUrl.protocol.toLowerCase();
  const hostname = normalizeHost(originUrl.hostname);
  const pathname = match[2] || '/';
  const segments = pathname.split('/').slice(1);
  const dynamic = hasDynamicPattern(pathname);

  let regexPath = '';
  let staticPrefix = '';
  let encounteredDynamic = false;
  for (const segment of segments) {
    if (!segment) continue;
    const segmentIsDynamic = /[*{]/.test(segment);
    if (segmentIsDynamic) {
      encounteredDynamic = true;
    }

    if (!encounteredDynamic && !segmentIsDynamic) {
      staticPrefix += `/${segment}`;
    }
    regexPath += `/${segmentToRegex(segment)}`;
  }

  if (!regexPath) {
    regexPath = '/';
  }

  const allowSuffix = dynamic && !hasExplicitFileExtension(pathname);
  const regex = new RegExp(
    `^${escapeRegExp(`${protocol}//${hostname}`)}${regexPath}${allowSuffix ? '(?:/.*)?' : ''}$`,
    'i',
  );

  const seedPath = dynamic
    ? staticPrefix
      ? `${staticPrefix}/`
      : '/'
    : pathname || '/';

  return {
    raw: normalizedPattern,
    origin: `${protocol}//${hostname}`,
    seedUrl: `${protocol}//${hostname}${seedPath}`.replace(/\/{2,}$/, '/'),
    dynamic,
    matchesUrl: (candidateUrl: string) => {
      try {
        const parsedCandidate = new URL(candidateUrl);
        const normalizedCandidate = `${parsedCandidate.protocol}//${normalizeHost(parsedCandidate.hostname)}${parsedCandidate.pathname}`;
        return regex.test(normalizedCandidate);
      } catch {
        return regex.test(candidateUrl.split('#')[0].split('?')[0]);
      }
    },
  };
};

const discoverCandidateUrlsFromPage = (html: string, pageUrl: string, rule: ReturnType<typeof buildPatternRule>, ignoreList: string[]) => {
  const cleanedHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');

  const discovered: string[] = [];
  const hrefRegex = /href\s*=\s*["']([^"']+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(cleanedHtml)) !== null) {
    const href = match[1] || '';
    if (!href) continue;

    let absoluteUrl = '';
    try {
      absoluteUrl = new URL(href, pageUrl).toString();
    } catch {
      continue;
    }

    if (!sameOrigin(absoluteUrl, pageUrl)) continue;
    if (matchesIgnoreList(absoluteUrl, ignoreList)) continue;
    if (!rule?.matchesUrl(absoluteUrl)) continue;

    discovered.push(absoluteUrl);
  }

  if (rule?.matchesUrl(pageUrl) && !matchesIgnoreList(pageUrl, ignoreList)) {
    discovered.push(pageUrl);
  }

  return uniqueStrings(discovered);
};

const uniqueByTitle = (items: Array<Record<string, any>>) => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.sourceUrl || ''}::${item.title || ''}::${item.dayKey || ''}`.toLowerCase();
    if (!item.title || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeUrl = (input: string) => {
  const trimmed = input.trim();
  if (!trimmed) return '';
  try {
    return new URL(trimmed).toString();
  } catch {
    try {
      return new URL(`https://${trimmed}`).toString();
    } catch {
      return '';
    }
  }
};

const normalizeIgnoreToken = (input: string) => {
  const token = normalizeText(input).toLowerCase();
  if (!token) return '';

  try {
    const parsed = token.includes('://') ? new URL(token) : new URL(`https://${token}`);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    return `${parsed.protocol}//${hostname}${pathname}`;
  } catch {
    return token.replace(/^\/+/, '').replace(/\/+$/, '');
  }
};

const parseIgnoreList = (value: unknown) => {
  const rawItems = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\r\n,]+/g)
      : [];

  return rawItems.map((item) => normalizeIgnoreToken(String(item))).filter(Boolean);
};

const getUrlMatchTarget = (inputUrl: string) => {
  try {
    const parsed = new URL(inputUrl);
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const pathname = parsed.pathname.toLowerCase().replace(/\/+$/, '') || '/';
    return {
      hostname,
      pathname,
      full: `${parsed.protocol}//${hostname}${pathname}`,
    };
  } catch {
    return {
      hostname: '',
      pathname: '',
      full: inputUrl.toLowerCase(),
    };
  }
};

const matchesIgnoreList = (inputUrl: string, ignoreList: string[]) => {
  if (!ignoreList.length) return false;
  const target = getUrlMatchTarget(inputUrl);

  return ignoreList.some((token) => {
    if (!token) return false;
    return (
      target.full === token ||
      inputUrl.toLowerCase() === token ||
      `${target.hostname}${target.pathname}` === token ||
      target.pathname === token
    );
  });
};

const isIgnoredNewsItem = (item: Record<string, any>, ignoreList: string[]) => {
  const candidates = [item?.sourceUrl, item?.articleUrl].filter(Boolean) as string[];
  return candidates.some((candidate) => matchesIgnoreList(candidate, ignoreList));
};

const deleteSavedNewsForUrl = async (strapi: any, url: string) => {
  const rows = await strapi.db.query(NEWS_ANALYSIS_UID).findMany({
    where: {
      $or: [
        { sourceUrl: url },
        { articleUrl: url },
      ],
    },
  });

  let deleted = 0;
  for (const row of rows) {
    if (!row?.documentId) continue;
    await (strapi as any).documents(NEWS_ANALYSIS_UID).delete({
      documentId: row.documentId,
    });
    deleted += 1;
  }

  return deleted;
};

const sameUtcDay = (left?: string | Date, right?: string | Date) => {
  if (!left || !right) return false;
  const leftKey = new Date(left).toISOString().slice(0, 10);
  const rightKey = new Date(right).toISOString().slice(0, 10);
  return leftKey === rightKey;
};

const normalizeZaiBaseUrl = (value = '') => value.replace(/\/+$/, '');

const normalizeAIProvider = (value = '') => {
  const normalized = value.toLowerCase().replace(/[\s_-]+/g, '');
  if (normalized === 'gemini' || normalized === 'googleai' || normalized === 'google') return 'gemini';
  if (normalized === 'openai') return 'openai';
  return 'z.ai';
};

const resolveAIProviderConfig = (provider: string, requestedModel = '') => {
  if (provider === 'openai') {
    return {
      provider: 'openai',
      baseUrl: normalizeZaiBaseUrl(String(process.env.OPEN_AI_API || '').trim()),
      apiKey: String(process.env.OPEN_AI_KEY || '').trim(),
      model: requestedModel || String(process.env.OPEN_AI_MODEL || 'gpt-4o-mini').trim(),
      missingApiMessage: 'Missing server env OPEN_AI_API.',
      missingKeyMessage: 'Missing server env OPEN_AI_KEY.',
    };
  }

  if (provider === 'gemini') {
    return {
      provider: 'gemini',
      baseUrl: normalizeZaiBaseUrl(String(process.env.GEMINI_API || 'https://generativelanguage.googleapis.com/v1beta').trim()),
      apiKey: String(process.env.GEMINI_API_KEY || '').trim(),
      model: requestedModel || String(process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite').trim(),
      missingApiMessage: 'Missing server env GEMINI_API.',
      missingKeyMessage: 'Missing server env GEMINI_API_KEY.',
    };
  }

  return {
    provider: 'z.ai',
    baseUrl: normalizeZaiBaseUrl(String(process.env.ZAI_API || process.env.ZAI || process.env.ZAI_BASE_URL || '').trim()),
    apiKey: String(process.env.ZAI_API_KEY || '').trim(),
    model: requestedModel || String(process.env.ZAI_MODEL || 'glm-4.5').trim(),
    missingApiMessage: 'Missing server env ZAI_API.',
    missingKeyMessage: 'Missing server env ZAI_API_KEY.',
  };
};

const buildNewsAnalysisPrompt = (prompt: string, newsItems: Array<Record<string, any>>) => {
  const newsText = newsItems
    .map((item, index) => {
      const lines = [
        `${index + 1}. ${item.title}`,
        item.excerpt ? `Excerpt: ${item.excerpt}` : '',
        item.sourceName || item.sourceUrl ? `Source: ${item.sourceName || item.sourceUrl}` : '',
        item.dayKey ? `Day: ${item.dayKey}` : '',
      ].filter(Boolean);

      return lines.join('\n');
    })
    .join('\n\n');

  return `${prompt}\n\nNews items:\n${newsText}`;
};

const buildOpenAICompatiblePayload = (model: string, prompt: string, newsItems: Array<Record<string, any>>) => ({
  model,
  messages: [
    {
      role: 'system',
      content: 'You are a financial news analyst. Return concise, actionable analysis for traders.',
    },
    {
      role: 'user',
      content: buildNewsAnalysisPrompt(prompt, newsItems),
    },
  ],
  temperature: 0.2,
});

const buildGeminiPayload = (prompt: string, newsItems: Array<Record<string, any>>) => ({
  contents: [
    {
      role: 'user',
      parts: [
        {
          text: [
            'You are a financial news analyst. Return concise, actionable analysis for traders.',
            buildNewsAnalysisPrompt(prompt, newsItems),
          ].join('\n\n'),
        },
      ],
    },
  ],
  generationConfig: {
    temperature: 0.2,
  },
});

const parseRssFeed = (html: string, sourceUrl: string, fetchedAt: Date) => {
  const items: Array<Record<string, any>> = [];
  const dayKey = fetchedAt.toISOString().slice(0, 10);
  const itemRegex = /<item\b[\s\S]*?<\/item>/gi;
  const atomRegex = /<entry\b[\s\S]*?<\/entry>/gi;
  const blocks = [...html.matchAll(itemRegex), ...html.matchAll(atomRegex)];

  for (const block of blocks) {
    const raw = block[0];
    const title = getFirstTagText(raw, 'title') || stripTags(getMetaContent(raw, 'og:title')) || stripTags(getMetaContent(raw, 'twitter:title'));
    const link =
      getFirstTagText(raw, 'link') ||
      raw.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ||
      '';
    const excerpt =
      getFirstTagText(raw, 'description') ||
      getFirstTagText(raw, 'summary') ||
      '';
    const publishedAtRaw =
      getFirstTagText(raw, 'pubDate') ||
      getFirstTagText(raw, 'published') ||
      getFirstTagText(raw, 'updated') ||
      '';
    const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : null;

    if (publishedAt && Number.isNaN(publishedAt.getTime())) {
      continue;
    }

    if (publishedAt && !sameUtcDay(publishedAt, fetchedAt)) {
      continue;
    }

    if (!title) continue;

    items.push({
      sourceUrl,
      articleUrl: link ? normalizeUrl(link) || link : sourceUrl,
      sourceName: new URL(sourceUrl).hostname.replace(/^www\./, ''),
      title: normalizeText(title),
      excerpt: normalizeText(excerpt),
      publishedAt: publishedAt?.toISOString() || null,
      fetchedAt: fetchedAt.toISOString(),
      dayKey,
    });
  }

  return uniqueByTitle(items).slice(0, MAX_ITEMS_PER_SOURCE);
};

const parseArticlePage = (html: string, sourceUrl: string, fetchedAt: Date) => {
  const dayKey = fetchedAt.toISOString().slice(0, 10);
  const sourceName = new URL(sourceUrl).hostname.replace(/^www\./, '');
  const cleanedHtml = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ');

  const titleMeta = getMetaContent(cleanedHtml, 'og:title') || getMetaContent(cleanedHtml, 'twitter:title');
  const headlineMeta = getMetaContent(cleanedHtml, 'headline');
  const pageTitle = getFirstTagText(cleanedHtml, 'title');
  const h1 = getFirstTagText(cleanedHtml, 'h1');
  const publishedAtRaw =
    getMetaContent(cleanedHtml, 'article:published_time') ||
    getMetaContent(cleanedHtml, 'pubdate') ||
    getMetaContent(cleanedHtml, 'publish-date') ||
    getMetaContent(cleanedHtml, 'date');

  const articleUrl =
    getMetaContent(cleanedHtml, 'og:url') ||
    cleanedHtml.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i)?.[1] ||
    sourceUrl;

  const resolvedTitle = normalizeText(titleMeta || headlineMeta || h1 || pageTitle);
  const resolvedPublishedAt = publishedAtRaw ? new Date(publishedAtRaw) : null;
  const hasArticleSignals =
    Boolean(resolvedTitle) &&
    (cleanedHtml.toLowerCase().includes('property="og:type" content="article"') ||
      cleanedHtml.toLowerCase().includes('name="twitter:card" content="summary_large_image"') ||
      Boolean(publishedAtRaw) ||
      Boolean(h1));

  if (!hasArticleSignals) {
    return [];
  }

  if (resolvedPublishedAt && Number.isNaN(resolvedPublishedAt.getTime())) {
    return [];
  }

  return [
    {
      sourceUrl,
      articleUrl: normalizeUrl(articleUrl) || sourceUrl,
      sourceName,
      title: resolvedTitle,
      excerpt:
        normalizeText(
          getMetaContent(cleanedHtml, 'og:description') ||
          getMetaContent(cleanedHtml, 'twitter:description') ||
          getFirstTagText(cleanedHtml, 'p'),
        ) || '',
      publishedAt: resolvedPublishedAt?.toISOString() || null,
      fetchedAt: fetchedAt.toISOString(),
      dayKey,
    },
  ];
};

const extractNewsItems = (html: string, sourceUrl: string, fetchedAt: Date) => {
  const lower = html.toLowerCase();
  if (lower.includes('<rss') || lower.includes('<feed') || lower.includes('<item>') || lower.includes('<entry>')) {
    const feedItems = parseRssFeed(html, sourceUrl, fetchedAt);
    if (feedItems.length > 0) return feedItems;
  }

  return parseArticlePage(html, sourceUrl, fetchedAt);
};

const processArticleUrl = async (
  strapi: any,
  articleUrl: string,
  fetchedAt: Date,
  ignoreList: string[],
  results: Array<Record<string, any>>,
) => {
  if (matchesIgnoreList(articleUrl, ignoreList)) {
    const removed = await deleteSavedNewsForUrl(strapi, articleUrl);
    results.push({
      sourceUrl: articleUrl,
      status: 'skipped',
      reason: 'matched_ignore_list',
      removed,
    });
    return;
  }

  const response = await axios.get(articleUrl, {
    responseType: 'text',
    timeout: 20000,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    validateStatus: () => true,
  });

  if (response.status < 200 || response.status >= 300) {
    results.push({
      sourceUrl: articleUrl,
      status: 'error',
      error: `HTTP ${response.status}`,
    });
    return;
  }

  const html = typeof response.data === 'string' ? response.data : String(response.data || '');
  const items = extractNewsItems(html, articleUrl, fetchedAt);
  const filteredItems = items.filter((item) => !isIgnoredNewsItem(item, ignoreList));
  let created = 0;
  let skipped = 0;
  let ignoredRecords = 0;
  const savedItems: Array<Record<string, any>> = [];

  for (const item of items) {
    if (isIgnoredNewsItem(item, ignoreList)) {
      ignoredRecords += 1;
      continue;
    }

    const existing = await (strapi as any).documents(NEWS_ANALYSIS_UID).findFirst({
      filters: {
        sourceUrl: item.sourceUrl,
        title: item.title,
        dayKey: item.dayKey,
      },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    const saved = await (strapi as any).documents(NEWS_ANALYSIS_UID).create({
      data: item,
      status: 'published',
    });
    created += 1;
    savedItems.push(saved);
  }

  results.push({
    sourceUrl: articleUrl,
    status: 'ok',
    extracted: filteredItems.length,
    created,
    skipped,
    ignoredRecords,
    items: savedItems,
  });
};

export default factories.createCoreController(NEWS_ANALYSIS_UID, ({ strapi }) => ({
  async refresh(ctx) {
    const body = ctx.request.body || {};
    const rawUrls = Array.isArray(body.urls)
      ? body.urls
      : typeof body.urlText === 'string'
        ? body.urlText.split(/[\r\n,]+/g)
        : [];
    const ignoreList = parseIgnoreList(body.ignoreList ?? body.ignoreText);

    const urls = rawUrls.map((value: string) => normalizeSourcePatternInput(String(value))).filter(Boolean);

    if (!urls.length) {
      ctx.throw(400, 'Please provide at least one news URL');
    }

    const fetchedAt = new Date();
    const results: Array<Record<string, any>> = [];

    for (const inputPattern of urls) {
      try {
        const rule = buildPatternRule(inputPattern);

        if (!rule) {
          results.push({
            sourceUrl: inputPattern,
            status: 'error',
            error: 'Invalid source pattern',
          });
          continue;
        }

        const response = await axios.get(rule.seedUrl, {
          responseType: 'text',
          timeout: 20000,
          headers: {
            'User-Agent': USER_AGENT,
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          validateStatus: () => true,
        });

        if (response.status < 200 || response.status >= 300) {
          results.push({
            sourceUrl: inputPattern,
            status: 'error',
            error: `HTTP ${response.status}`,
          });
          continue;
        }

        const html = typeof response.data === 'string' ? response.data : String(response.data || '');
        const discoveredUrls = discoverCandidateUrlsFromPage(html, rule.seedUrl, rule, ignoreList);
        const shouldProcessSeedUrl = !rule.dynamic && new URL(rule.seedUrl).pathname !== '/' && rule.matchesUrl(rule.seedUrl);
        const urlsToProcess = discoveredUrls.length ? discoveredUrls : shouldProcessSeedUrl ? [rule.seedUrl] : [];

        results.push({
          sourceUrl: inputPattern,
          status: 'ok',
          discovered: urlsToProcess.length,
          items: [],
        });

        for (const articleUrl of urlsToProcess) {
          await processArticleUrl(strapi, articleUrl, fetchedAt, ignoreList, results);
        }
      } catch (error: any) {
        strapi.log.error(`News refresh failed for ${inputPattern}: ${error?.message || error}`);
        results.push({
          sourceUrl: inputPattern,
          status: 'error',
          error: error?.message || 'Unknown error',
        });
      }
    }

    const summary = {
      totalUrls: urls.length,
      succeeded: results.filter((item) => item.status === 'ok').length,
      skippedUrls: results.filter((item) => item.status === 'skipped').length,
      failed: results.filter((item) => item.status === 'error').length,
      ignoredByList: results.filter((item) => item.reason === 'matched_ignore_list').length,
      removedByIgnore: results.reduce((sum, item) => sum + (item.removed || 0), 0),
      created: results.reduce((sum, item) => sum + (item.created || 0), 0),
      skippedRecords: results.reduce((sum, item) => sum + (item.skipped || 0), 0),
      ignoredRecords: results.reduce((sum, item) => sum + (item.ignoredRecords || 0), 0),
      extracted: results.reduce((sum, item) => sum + (item.extracted || 0), 0),
    };

    ctx.body = {
      data: {
        summary,
        results,
      },
    };
  },

  async listLast30(ctx) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const items = await strapi.db.query(NEWS_ANALYSIS_UID).findMany({
      where: { fetchedAt: { $gte: thirtyDaysAgo } },
      orderBy: { fetchedAt: 'desc' },
    });

    ctx.body = { data: items };
  },

  async analyze(ctx) {
    const body = ctx.request.body || {};
    const rawNewsIds = Array.isArray(body.newsIds) ? body.newsIds : [];
    const newsIds = rawNewsIds.map((id: unknown) => String(id)).filter(Boolean);
    const prompt = normalizeText(String(body.prompt || 'Analyze these news items for market impact.'));
    const provider = normalizeAIProvider(String(body.provider || 'z.ai'));
    const providerConfig = resolveAIProviderConfig(provider, normalizeText(String(body.model || '')));
    const { baseUrl, apiKey, model } = providerConfig;

    if (!newsIds.length) {
      ctx.throw(400, 'Please select at least one news item to analyze.');
    }

    if (!apiKey) {
      ctx.throw(500, providerConfig.missingKeyMessage);
    }

    if (!baseUrl) {
      ctx.throw(500, providerConfig.missingApiMessage);
    }

    const newsItems = await strapi.db.query(NEWS_ANALYSIS_UID).findMany({
      where: {
        $or: [
          { documentId: { $in: newsIds } },
          { id: { $in: newsIds.filter((id) => /^\d+$/.test(id)).map((id) => Number(id)) } },
        ],
      },
      orderBy: { fetchedAt: 'desc' },
    });

    if (!newsItems.length) {
      ctx.throw(404, 'No selected news rows were found.');
    }

    const isGemini = providerConfig.provider === 'gemini';
    const response = await axios.post(
      isGemini
        ? `${baseUrl}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`
        : `${baseUrl}/chat/completions`,
      isGemini
        ? buildGeminiPayload(prompt, newsItems)
        : buildOpenAICompatiblePayload(model, prompt, newsItems),
      {
        timeout: 60000,
        headers: isGemini
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
      strapi.log.error(`${providerConfig.provider} analysis failed: HTTP ${response.status}`);
      ctx.throw(response.status, response.data?.error?.message || response.data?.message || `${providerConfig.provider} analysis failed.`);
    }

    ctx.body = {
      data: {
        provider: providerConfig.provider,
        model,
        baseUrl,
        selectedCount: newsItems.length,
        analysis: response.data,
      },
    };
  },
}));
