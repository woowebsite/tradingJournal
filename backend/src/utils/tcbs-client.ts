/* eslint-disable @typescript-eslint/no-explicit-any */
import { fetch as fingerprintFetch } from 'wreq-js';

const TCBS_ORIGIN = 'https://apiextaws.tcbs.com.vn';

export async function fetchTcbs(pathname: string, params: Record<string, string>, token?: string): Promise<any> {
  const query = new URLSearchParams(params).toString();
  const url = `${TCBS_ORIGIN}${pathname}${query ? `?${query}` : ''}`;
  const response = await fingerprintFetch(url, {
    browser: 'chrome_142',
    os: process.platform === 'darwin' ? 'macos' : 'windows',
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'vi',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`TCBS API token: ${token}`);
    throw new Error(`TCBS API error: ${response.status} ${body.slice(0, 200)}`);
  }

  return response.json();
}
