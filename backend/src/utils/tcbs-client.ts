/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';
import { fetch as fingerprintFetch } from 'wreq-js';

const TCBS_ORIGIN = 'https://apiextaws.tcbs.com.vn';

let cachedToken = '';

/**
 * Lấy token TCBS hợp lệ nhất từ tham số, runtime env, bộ nhớ đệm hoặc file tcbs-cookie.json
 */
export function getEffectiveTcbsToken(explicitToken?: string): string {
  if (
    explicitToken &&
    typeof explicitToken === 'string' &&
    explicitToken.trim() &&
    explicitToken !== 'undefined' &&
    explicitToken !== 'null'
  ) {
    return explicitToken.trim();
  }

  if (process.env.TCBS_TOKEN && process.env.TCBS_TOKEN.trim()) {
    return process.env.TCBS_TOKEN.trim();
  }

  if (process.env.VITE_TCBS_TOKEN && process.env.VITE_TCBS_TOKEN.trim()) {
    return process.env.VITE_TCBS_TOKEN.trim();
  }

  if (cachedToken) {
    return cachedToken;
  }

  // Đọc từ tcbs-cookie.json nếu có
  const candidateCookiePaths = [
    path.join(process.cwd(), 'tcbs-cookie.json'),
    path.resolve(process.cwd(), '../frontend/tcbs-cookie.json'),
    path.resolve(process.cwd(), 'frontend/tcbs-cookie.json'),
  ];

  for (const cPath of candidateCookiePaths) {
    try {
      if (fs.existsSync(cPath)) {
        const raw = fs.readFileSync(cPath, 'utf8');
        const parsed = JSON.parse(raw);
        const tok = parsed.authToken || parsed.token || parsed.accessToken || parsed.jwt;
        if (tok && typeof tok === 'string' && tok.trim()) {
          cachedToken = tok.trim();
          process.env.TCBS_TOKEN = cachedToken;
          return cachedToken;
        }
      }
    } catch {
      // Bỏ qua lỗi parse
    }
  }

  return '';
}

/**
 * Cập nhật token vào bộ nhớ đệm runtime
 */
export function setCachedTcbsToken(token: string): void {
  if (token && typeof token === 'string') {
    cachedToken = token.trim();
    process.env.TCBS_TOKEN = cachedToken;
    process.env.VITE_TCBS_TOKEN = cachedToken;
  }
}

export async function fetchTcbs(pathname: string, params: Record<string, string>, token?: string): Promise<any> {
  const query = new URLSearchParams(params).toString();
  const url = `${TCBS_ORIGIN}${pathname}${query ? `?${query}` : ''}`;
  let effectiveToken = getEffectiveTcbsToken(token);

  let response = await fingerprintFetch(url, {
    browser: 'chrome_142',
    os: process.platform === 'darwin' ? 'macos' : 'windows',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'vi',
      ...(effectiveToken ? { Authorization: `Bearer ${effectiveToken}` } : {}),
    },
  });

  // Nếu bị 401/403 do token cũ, thử load lại từ disk/env mới nhất và retry 1 lần
  if (response.status === 401 || response.status === 403) {
    cachedToken = '';
    const freshToken = getEffectiveTcbsToken();
    if (freshToken && freshToken !== effectiveToken) {
      effectiveToken = freshToken;
      response = await fingerprintFetch(url, {
        browser: 'chrome_142',
        os: process.platform === 'darwin' ? 'macos' : 'windows',
        headers: {
          Accept: 'application/json',
          'Accept-Language': 'vi',
          Authorization: `Bearer ${effectiveToken}`,
        },
      });
    }
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`TCBS API error: ${response.status} ${body.slice(0, 200)}`);
  }

  return response.json();
}
