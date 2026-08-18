/**
 * apiClient — Tầng gọi HTTP dùng chung cho toàn bộ frontend, giao tiếp với FastAPI backend.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

type AccessTokenProvider = () => string | null | undefined;

// Không có token cho tới khi Supabase Auth được tích hợp; các request khi đó vẫn hoạt động bình thường (không có header Authorization).
let getAccessToken: AccessTokenProvider = () => null;

/** Cho phép lớp Auth (tác vụ sau) cung cấp access token hiện tại của Supabase. */
export function setAccessTokenProvider(provider: AccessTokenProvider): void {
  getAccessToken = provider;
}

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers, signal } = options;

  const requestHeaders: Record<string, string> = { Accept: 'application/json', ...headers };
  if (body !== undefined) {
    requestHeaders['Content-Type'] = 'application/json';
  }

  const token = getAccessToken();
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    signal,
  });

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');
  const data = isJson ? await response.json().catch(() => null) : await response.text();

  if (!response.ok) {
    const message =
      isJson && data && typeof data === 'object' && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : response.statusText;
    throw new ApiError(response.status, message, data);
  }

  return data as T;
}

export const apiClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
