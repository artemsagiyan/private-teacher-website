import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

class ApiClient {
  private client: AxiosInstance;

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
        const original = error.config;
        if (error.response?.status === 401 && !original._retry) {
          original._retry = true;
          try {
            const refreshToken = this.getRefreshToken();
            if (!refreshToken) throw new Error('No refresh token');
            const { data } = await this.client.post('/auth/refresh', { refreshToken });
            this.setTokens(data.accessToken, data.refreshToken);
            original.headers.Authorization = `Bearer ${data.accessToken}`;
            return this.client(original);
          } catch {
            this.clearTokens();
            window.location.href = '/auth/login';
          }
        }
        return Promise.reject(error);
      },
    );
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
