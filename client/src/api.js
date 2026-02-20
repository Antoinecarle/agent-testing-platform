const TOKEN_KEY = 'atp-token';
const REFRESH_TOKEN_KEY = 'atp-refresh-token';
const USER_KEY = 'atp-user';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setRefreshToken(token) {
  localStorage.setItem(REFRESH_TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getUser() {
  try {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

export function setUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

// Prevent multiple concurrent redirects to /login
let isRedirecting = false;
function redirectToLogin() {
  if (isRedirecting) return;
  isRedirecting = true;
  clearToken();
  window.location.href = '/login';
}

// Refresh the access token using the refresh token
let refreshPromise = null;
export async function refreshAccessToken() {
  // Deduplicate concurrent refresh calls
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      throw new Error('No refresh token');
    }

    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!res.ok) {
      throw new Error('Refresh failed');
    }

    const data = await res.json();
    setToken(data.token);
    if (data.refreshToken) {
      setRefreshToken(data.refreshToken);
    }
    return data.token;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

/**
 * SSE streaming fetch — calls a POST endpoint that returns Server-Sent Events.
 * @param {string} path - API path
 * @param {object} body - JSON body to send
 * @param {object} callbacks - { onChunk(text), onStatus(msg), onDone(data), onError(msg) }
 */
export async function apiStream(path, body, callbacks = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    try {
      const newToken = await refreshAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      const retryRes = await fetch(path, { method: 'POST', headers, body: JSON.stringify(body) });
      return processSSEStream(retryRes, callbacks);
    } catch {
      redirectToLogin();
      throw new Error('Session expired');
    }
  }

  if (!res.ok && !res.headers.get('content-type')?.includes('text/event-stream')) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorBody.error || 'Request failed');
  }

  return processSSEStream(res, callbacks);
}

async function processSSEStream(res, callbacks) {
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith('data: ')) continue;

      try {
        const data = JSON.parse(trimmed.slice(6));
        if (data.type === 'chunk' && callbacks.onChunk) callbacks.onChunk(data.content);
        else if (data.type === 'status' && callbacks.onStatus) callbacks.onStatus(data.message, data);
        else if (data.type === 'done' && callbacks.onDone) callbacks.onDone(data);
        else if (data.type === 'error' && callbacks.onError) callbacks.onError(data.message);
      } catch {
        // Skip malformed SSE
      }
    }
  }
}

export async function api(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  let res = await fetch(path, { ...options, headers });

  // If token expired, try to refresh and retry
  if (res.status === 401) {
    const body = await res.json().catch(() => ({}));
    if (body.code === 'TOKEN_EXPIRED') {
      try {
        const newToken = await refreshAccessToken();
        headers['Authorization'] = `Bearer ${newToken}`;
        res = await fetch(path, { ...options, headers });
      } catch {
        redirectToLogin();
        throw new Error('Session expired');
      }
    } else {
      redirectToLogin();
      throw new Error('Unauthorized');
    }
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(errorBody.error || 'Request failed');
  }

  return res.json();
}
