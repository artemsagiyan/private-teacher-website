import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const AUTH_PATHS = [
  '/auth/login',
  '/auth/refresh',
  '/auth/register',
  '/auth/oauth/exchange',
  '/auth/forgot-password',
  '/auth/reset-password',
];

class ApiClient {
  private client: AxiosInstance;
  private refreshInFlight: Promise<void> | null = null;
  private redirecting = false;

  constructor() {
    this.client = axios.create({
      baseURL: `${BASE_URL}/api`,
      headers: { 'Content-Type': 'application/json' },
    });

    this.client.interceptors.request.use((config) => {
      const token = this.getAccessToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
        delete config.headers['Content-Type'];
      }
      return config;
    });

    this.client.interceptors.response.use(
      (res) => res,
      async (error) => {
        const original = error.config as
          | (AxiosRequestConfig & { _retry?: boolean })
          | undefined;
        const url = original?.url ?? '';
        const skipRefresh = AUTH_PATHS.some((path) => url.includes(path));
        if (
          error.response?.status === 401 &&
          original &&
          !original._retry &&
          !skipRefresh
        ) {
          original._retry = true;
          try {
            await this.refreshSession();
            const access = this.getAccessToken();
            original.headers = original.headers ?? {};
            (original.headers as { Authorization?: string }).Authorization =
              `Bearer ${access}`;
            return this.client(original);
          } catch {
            this.forceLogout();
          }
        }
        return Promise.reject(error);
      },
    );
  }

  private async refreshSession() {
    if (!this.refreshInFlight) {
      const run = async () => {
        const refreshToken = this.getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');
        const { data } = await axios.post(`${BASE_URL}/api/auth/refresh`, {
          refreshToken,
        });
        this.setTokens(data.accessToken, data.refreshToken);
      };
      const locked = (async () => {
        const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
        if (locks?.request) {
          await locks.request('tutor-auth-refresh', () => run());
          return;
        }
        await run();
      })();
      this.refreshInFlight = locked.finally(() => {
        this.refreshInFlight = null;
      });
    }
    return this.refreshInFlight;
  }

  private forceLogout() {
    this.clearTokens();
    if (this.redirecting || typeof window === 'undefined') return;
    if (window.location.pathname.startsWith('/auth/')) return;
    this.redirecting = true;
    window.location.href = '/auth/login';
  }

  private getAccessToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  }

  private getRefreshToken() {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('refresh_token');
  }

  setTokens(access: string, refresh: string) {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
  }

  clearTokens() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
  }

  async get<T>(url: string, config?: AxiosRequestConfig) {
    const res = await this.client.get<T>(url, config);
    return res.data;
  }

  async post<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    const res = await this.client.post<T>(url, data, config);
    return res.data;
  }

  async patch<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    const res = await this.client.patch<T>(url, data, config);
    return res.data;
  }

  async put<T>(url: string, data?: unknown, config?: AxiosRequestConfig) {
    const res = await this.client.put<T>(url, data, config);
    return res.data;
  }

  putKeepalive(url: string, data: unknown) {
    if (typeof window === 'undefined') return;
    const token = this.getAccessToken();
    void fetch(`${BASE_URL}/api${url}`, {
      method: 'PUT',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    }).catch(() => undefined);
  }

  async delete<T>(url: string, config?: AxiosRequestConfig) {
    const res = await this.client.delete<T>(url, config);
    return res.data;
  }

  async getBlob(url: string) {
    const res = await this.client.get<Blob>(url, { responseType: 'blob' });
    return res.data;
  }

  async download(url: string, filename: string) {
    const res = await this.client.get<Blob>(url, { responseType: 'blob' });
    const objectUrl = URL.createObjectURL(res.data);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  // Auth
  loginWithGoogle() {
    window.location.href = `${BASE_URL}/api/auth/google`;
  }
}

export const api = new ApiClient();
