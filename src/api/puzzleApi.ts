// SIGARAM64 — Puzzle API
import { apiGet, apiPost } from './client';

export const puzzleApi = {
  /** Get the daily puzzle */
  async getDailyPuzzle(): Promise<any> {
    return apiGet('/api/puzzles/daily');
  },

  /** Get a random puzzle with optional filters */
  async getRandomPuzzle(filters?: { section?: string; difficulty?: string }): Promise<any> {
    const params = new URLSearchParams();
    if (filters?.section) params.set('section', filters.section);
    if (filters?.difficulty) params.set('difficulty', filters.difficulty);
    const qs = params.toString();
    return apiGet(`/api/puzzles/random${qs ? '?' + qs : ''}`);
  },

  /** Get a specific puzzle by ID */
  async getPuzzle(id: string): Promise<any> {
    return apiGet(`/api/puzzles/${id}`);
  },

  /** Record a puzzle attempt */
  async recordAttempt(puzzleId: string, data: {
    uciAttempted?: string;
    enteredMoves?: string;
    correct: boolean;
    timeTakenSec: number;
    cplLoss?: number;
  }): Promise<{ recorded: boolean; correct: boolean }> {
    return apiPost(`/api/puzzles/${puzzleId}/attempt`, data);
  },

  /** Get streak info for a student */
  async getStreak(studentId: string): Promise<any> {
    return apiGet(`/api/puzzles/streak/${studentId}`);
  },
};
