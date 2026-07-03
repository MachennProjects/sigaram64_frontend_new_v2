// SIGARAM64 — Admin API
import { apiGet, apiPost, apiPut, apiDelete, apiGetWithMeta } from './client';

export const adminApi = {
  /** Get platform-wide metrics (super_admin: global, sub_admin: school-scoped) */
  async getMetrics(): Promise<any> {
    return apiGet('/api/admin/metrics');
  },

  /** Get schools list */
  async getSchools(district?: string): Promise<any[]> {
    const qs = district ? `?district=${encodeURIComponent(district)}` : '';
    return apiGet(`/api/admin/schools${qs}`);
  },

  /** Get recent activity feed */
  async getActivityFeed(district?: string, limit = 20): Promise<any[]> {
    const params = new URLSearchParams();
    if (district) params.set('district', district);
    params.set('limit', String(limit));
    return apiGet(`/api/admin/activity-feed?${params.toString()}`);
  },

  /** Get ELO rating distribution histogram */
  async getRatingDistribution(): Promise<any[]> {
    return apiGet('/api/admin/rating-distribution');
  },

  /** Get renewal report for a district */
  async getRenewalReport(district: string, period?: string): Promise<any> {
    const qs = period ? `?period=${encodeURIComponent(period)}` : '';
    return apiGet(`/api/reports/renewal/${encodeURIComponent(district)}${qs}`);
  },

  /** Get individual student report */
  async getStudentReport(studentId: string): Promise<any> {
    return apiGet(`/api/reports/student/${studentId}`);
  },

  /** List all sub admin accounts (super_admin only) */
  async listSubAdmins(): Promise<any[]> {
    return apiGet('/api/admin/sub-admins');
  },

  /** Deactivate a sub admin account (super_admin only) */
  async deactivateSubAdmin(id: string): Promise<any> {
    return apiDelete(`/api/admin/sub-admins/${id}`);
  },

  /** Get leaderboard (school-scoped or global) */
  async getLeaderboard(schoolId?: string): Promise<any[]> {
    const qs = schoolId ? `?schoolId=${encodeURIComponent(schoolId)}` : '';
    return apiGet(`/api/admin/leaderboard${qs}`);
  },

  // ── Organization Management (super_admin only) ──────────────────────────────

  /** List all organizations with live student count and avg ELO */
  async getOrganizations(): Promise<any[]> {
    return apiGet('/api/admin/organizations');
  },

  /** Get one organization's full details + stats */
  async getOrganizationDetail(id: string): Promise<any> {
    return apiGet(`/api/admin/organizations/${id}`);
  },

  /** Update org fields (name, phone, district, address, active) */
  async updateOrganization(id: string, data: Record<string, any>): Promise<any> {
    return apiPut(`/api/admin/organizations/${id}`, data);
  },

  /** Get paginated students for a specific org */
  async getOrgStudents(
    orgId: string, limit = 20, offset = 0
  ): Promise<{ students: any[]; total: number; hasMore: boolean }> {
    const { data, meta } = await apiGetWithMeta<any[]>(
      `/api/admin/organizations/${orgId}/students?limit=${limit}&offset=${offset}`
    );
    return {
      students: Array.isArray(data) ? data : [],
      total:    meta?.total   ?? 0,
      hasMore:  meta?.hasMore ?? false,
    };
  },

  /** Get bootcamp activity — heatmap + per-student game count for last 7 days */
  async getBootcampActivity(orgId?: string): Promise<any> {
    const qs = orgId ? `?orgId=${encodeURIComponent(orgId)}` : '';
    return apiGet(`/api/admin/bootcamp-activity${qs}`);
  },

  /** Download renewal report PDF */
  async downloadRenewalReportPDF(district: string, period: string): Promise<Blob> {
    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
    const token = localStorage.getItem('sigaram64_token');
    
    const response = await fetch(`${API_URL}/api/reports/renewal/${encodeURIComponent(district)}/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ period })
    });
    
    if (!response.ok) {
      throw new Error('Failed to download PDF');
    }
    return response.blob();
  },
};


