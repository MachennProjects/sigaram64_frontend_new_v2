// SIGARAM64 — Auth API
import { apiGet, apiPost, setToken, getToken, clearToken } from './client';

export interface LoginResponse {
  token: string;
  user: any;
}

export interface SignupResponse {
  user: any;
  email: string;
  generatedPassword?: string; // returned only when password was auto-generated
}

export const authApi = {
  /** Login for students (email/studentId + password/pin) */
  async loginStudent(identifier: string, password: string): Promise<LoginResponse> {
    const res = await apiPost<LoginResponse>('/api/auth/login', { email: identifier, studentId: identifier, password });
    if (res.token) setToken(res.token);
    return res;
  },

  /** Login for admins (super_admin / sub_admin) */
  async loginAdmin(email: string, password: string): Promise<LoginResponse> {
    const res = await apiPost<LoginResponse>('/api/auth/admin/login', { email, password });
    if (res.token) setToken(res.token);
    return res;
  },

  /** Get current authenticated user profile */
  async getMe(): Promise<any> {
    return apiGet<any>('/api/auth/me');
  },

  /** Register a new student — called by admins only.
   *  Does NOT set the auth token (admin session preserved). */
  async signup(data: {
    name: string;
    orgId: string;
    gender?: 'male' | 'female' | 'other';
    studentClass?: string;       // 'I' – 'XII'
    rollNo?: string;
    contact?: string[];
    email?: string;              // optional — server generates if omitted
    password?: string;           // optional — server generates if omitted
    language?: 'en' | 'ta';
    fideRating?: number;
  }): Promise<SignupResponse> {
    return apiPost<SignupResponse>('/api/auth/signup', data);
  },

  /** Check if an email is available (not already in use). */
  async checkEmail(email: string): Promise<{ available: boolean }> {
    return apiGet<{ available: boolean }>(`/api/auth/check-email?email=${encodeURIComponent(email)}`);
  },

  /** Reset a student's PIN (sub_admin or super_admin only) */
  async resetPin(studentId: string, newPin: string): Promise<void> {
    await apiPost('/api/auth/reset-pin', { studentId, newPin });
  },

  /** Create a new Organization + Sub Admin account (super_admin only) */
  async createSubAdmin(data: {
    name: string;
    email: string;
    password: string;
    schoolName: string;
    district: string;
    phone?: string;
    address?: string;
    state?: string;
  }): Promise<any> {
    return apiPost('/api/auth/create-sub-admin', data);
  },

  /** Logout — clear token */
  logout(): void {
    clearToken();
  },
};
