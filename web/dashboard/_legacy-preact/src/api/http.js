export class ApiError extends Error {
  constructor(status, body) {
    const message = body?.message || body?.error || `HTTP ${status}`;
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

/**
 * Central fetch wrapper — always uses credentials: 'include' and JSON.
 * @param {string} path  API path e.g. '/api/live'
 * @param {{ method?: string, body?: unknown, signal?: AbortSignal, headers?: Record<string,string> }} [options]
 * @returns {Promise<unknown>}  Parsed JSON body
 */
export async function apiFetch(path, { method = 'GET', body, signal, headers = {} } = {}) {
  const init = {
    method,
    credentials: 'include',
    signal,
    headers: { ...headers },
  };

  if (body !== undefined) {
    init.headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(path, init);

  let parsed = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    parsed = await response.json().catch(() => ({}));
  }

  if (!response.ok) {
    if (response.status === 401) {
      throw new ApiError(401, parsed ?? {});
    }
    throw new ApiError(response.status, parsed ?? {});
  }

  return parsed;
}
