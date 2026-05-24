import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { acquireRateLimitToken, type RateLimitBucket } from './rate-limiter.js';

export function createRateLimitedClient(
  baseURL: string,
  bucket: RateLimitBucket,
): AxiosInstance {
  const client = axios.create({ baseURL, timeout: 30_000 });

  client.interceptors.request.use(async (config) => {
    await acquireRateLimitToken(bucket);
    return config;
  });

  return client;
}

export async function httpGet<T>(
  client: AxiosInstance,
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await client.get<T>(url, config);
  return res.data;
}
