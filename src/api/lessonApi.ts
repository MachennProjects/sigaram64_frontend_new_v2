// SIGARAM64 — Lesson & Games Library API
import { apiGet, apiPost } from './client';

export const lessonApi = {
  /** Get video lessons list */
  async getVideoLessons(): Promise<any[]> {
    return apiGet('/api/lessons/videos');
  },

  /** Get interactive learning modules */
  async getInteractiveLessons(): Promise<any[]> {
    return apiGet('/api/lessons/interactive');
  },

  /** Mark a lesson as completed (awards XP) */
  async completeLesson(lessonId: string, lessonType: 'video' | 'interactive'): Promise<any> {
    return apiPost(`/api/lessons/${lessonId}/complete`, { lessonType });
  },

  /** Get completion status for all lessons for a student */
  async getLessonProgress(studentId: string): Promise<any[]> {
    return apiGet(`/api/lessons/progress/${studentId}`);
  },

  /** Get Games Library (classic / famous games) */
  async getClassicGames(params?: { category?: string; search?: string; page?: number; limit?: number }): Promise<any> {
    const queryParts: string[] = [];
    if (params?.category) queryParts.push(`category=${encodeURIComponent(params.category)}`);
    if (params?.search) queryParts.push(`search=${encodeURIComponent(params.search)}`);
    if (params?.page) queryParts.push(`page=${params.page}`);
    if (params?.limit) queryParts.push(`limit=${params.limit}`);
    
    const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';
    return apiGet(`/api/games-library${qs}`);
  },

  /** Get a specific classic game by ID */
  async getClassicGame(id: string): Promise<any> {
    return apiGet(`/api/games-library/${id}`);
  },
};
