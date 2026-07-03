// SIGARAM64 — Central API Client
// Handles all HTTP communication with the backend via REST + JWT

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

// ── Token Management ────────────────────────────────────────────────────────

const TOKEN_KEY = 'sigaram64_token';

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// ── API Error ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  status: number;
  data: any;

  constructor(message: string, status: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

// ── Core Request Function ────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: any,
  options?: { isFormData?: boolean }
): Promise<T> {
  const url = `${API_URL}${path}`;
  const token = getToken();

  const headers: Record<string, string> = {};

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  if (!options?.isFormData && body) {
    headers['Content-Type'] = 'application/json';
  }

  const config: RequestInit = {
    method,
    headers,
    body: options?.isFormData ? body : body ? JSON.stringify(body) : undefined,
  };

  const response = await fetch(url, config);

  // Handle 401 — token expired or invalid
  if (response.status === 401) {
    clearToken();
    const isAuthPath = path.includes('/api/auth/login') || path.includes('/api/auth/admin/login');
    if (!isAuthPath && window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    throw new ApiError('Session expired. Please login again.', 401);
  }

  // Handle non-JSON responses (e.g., PDF downloads)
  const contentType = response.headers.get('content-type');
  if (contentType && !contentType.includes('application/json')) {
    if (!response.ok) {
      throw new ApiError(`Request failed: ${response.statusText}`, response.status);
    }
    return response as unknown as T;
  }

  const json = await response.json();

  if (!response.ok) {
    throw new ApiError(
      json.error || json.message || `Request failed with status ${response.status}`,
      response.status,
      json
    );
  }

  // Backend wraps responses in { success, data, message, meta }
  return json.data !== undefined ? json.data : json;
}

// Returns both data and meta (for paginated endpoints)
async function requestWithMeta<T>(
  path: string
): Promise<{ data: T; meta: any }> {
  const url = `${API_URL}${path}`;
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { method: 'GET', headers });
  if (response.status === 401) {
    clearToken();
    if (window.location.pathname !== '/login') window.location.href = '/login';
    throw new ApiError('Session expired. Please login again.', 401);
  }
  const json = await response.json();
  if (!response.ok) {
    throw new ApiError(json.error || json.message || `Request failed with status ${response.status}`, response.status, json);
  }
  return { data: json.data ?? json, meta: json.meta ?? {} };
}

// ── Public API Methods ───────────────────────────────────────────────────────

export function apiGet<T>(path: string): Promise<T> {
  return request<T>('GET', path);
}

export function apiGetWithMeta<T>(path: string): Promise<{ data: T; meta: any }> {
  return requestWithMeta<T>(path);
}

export function apiPost<T>(path: string, body?: any): Promise<T> {
  return request<T>('POST', path, body);
}

export function apiPut<T>(path: string, body?: any): Promise<T> {
  return request<T>('PUT', path, body);
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>('DELETE', path);
}

export function apiPostFormData<T>(path: string, formData: FormData): Promise<T> {
  return request<T>('POST', path, formData, { isFormData: true });
}
