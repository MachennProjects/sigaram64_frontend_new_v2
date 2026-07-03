// SIGARAM64 — Student API
import { apiGet, apiPut, apiDelete, apiPost, apiGetWithMeta } from './client';

export const studentApi = {
  /** List students with optional filters */
  async listStudents(filters?: {
    district?: string;
    school?: string;
    orgId?: string;
    active?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<any[]> {
    const params = new URLSearchParams();
    if (filters?.district) params.set('district', filters.district);
    if (filters?.school) params.set('school', filters.school);
    if (filters?.orgId) params.set('orgId', filters.orgId);
    if (filters?.active !== undefined) params.set('active', String(filters.active));
    if (filters?.limit) params.set('limit', String(filters.limit));
    if (filters?.offset) params.set('offset', String(filters.offset));
    const qs = params.toString();
    return apiGet(`/api/students${qs ? '?' + qs : ''}`);
  },

  /** Get a specific student by ID or studentId */
  async getStudent(id: string): Promise<any> {
    return apiGet(`/api/students/${id}`);
  },

  /** Update student fields */
  async updateStudent(id: string, data: Record<string, any>): Promise<void> {
    await apiPut(`/api/students/${id}`, data);
  },

  /** Deactivate a student (soft delete, super_admin only) */
  async deactivateStudent(id: string): Promise<void> {
    await apiDelete(`/api/students/${id}`);
  },

  /** Bulk import students from Excel file */
  async bulkImport(file: File, orgId?: string): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    if (orgId) {
      formData.append('orgId', orgId);
    }
    
    // Using fetch directly or custom request setup for multipart/form-data
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const token = localStorage.getItem('sigaram64_token');
    
    const response = await fetch(`${API_URL}/api/students/bulk-import`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData
    });
    
    const json = await response.json();
    if (!response.ok) {
      throw new Error(json.error || json.message || 'Bulk import failed');
    }
    return json.data !== undefined ? json.data : json;
  },

  /** Download bulk import Excel template */
  async downloadBulkTemplate(): Promise<Blob> {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const token = localStorage.getItem('sigaram64_token');
    
    const response = await fetch(`${API_URL}/api/students/bulk-template`, {
      method: 'GET',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {}
    });
    
    if (!response.ok) {
      throw new Error('Failed to download template');
    }
    return response.blob();
  },

  /** Get student dashboard data (profile + progress + recent games) */
  async getDashboard(id: string): Promise<any> {
    return apiGet(`/api/students/${id}/dashboard`);
  },

  /** Get detailed student progress */
  async getProgress(id: string): Promise<any> {
    return apiGet(`/api/students/${id}/progress`);
  },

  /**
   * Get paginated games for a student (admin view).
   * Returns { games, total, hasMore } for server-side pagination.
   * @param studentId  the student's studentId string (e.g. "TN9999") or UUID
   * @param limit      page size (default 20, max 100)
   * @param offset     skip N records (default 0)
   */
  async getStudentGames(
    studentId: string,
    limit = 20,
    offset = 0
  ): Promise<{ games: any[]; total: number; hasMore: boolean }> {
    const { data, meta } = await apiGetWithMeta<any[]>(
      `/api/games/player/${studentId}?limit=${limit}&offset=${offset}`
    );
    return {
      games:   Array.isArray(data) ? data : [],
      total:   meta?.total   ?? 0,
      hasMore: meta?.hasMore ?? false,
    };
  },
};
