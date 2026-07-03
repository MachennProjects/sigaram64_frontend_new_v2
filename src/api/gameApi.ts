// SIGARAM64 — Game API
import { apiGet, apiPost } from './client';

export interface AccuracySummary {
  playerAccuracy: number;
  acpl: number;
  blunders: number;
  mistakes: number;
  inaccuracies: number;
}

export const gameApi = {
  /** Save a completed game — PGN-only optimized payload (no per-move FEN) */
  async saveGame(data: {
    pgn: string;
    finalFen: string;
    result: string;
    gameType?: string;
    aiLevel?: number;
    playerColor?: string;
    opponentId?: string;
    totalMoves?: number;
    accuracySummary?: AccuracySummary;
  }): Promise<{ gameId: string; ratingChange: number }> {
    return apiPost('/api/games', data);
  },

  /** Get a specific game by ID */
  async getGame(id: string): Promise<any> {
    return apiGet(`/api/games/${id}`);
  },

  /** Get all games for a player */
  async getPlayerGames(studentId: string, limit = 20): Promise<any[]> {
    return apiGet(`/api/games/player/${studentId}?limit=${limit}`);
  },

  /** Trigger Stockfish analysis for a saved game (backend replays PGN) */
  async triggerAnalysis(gameId: string): Promise<any> {
    return apiPost(`/api/games/${gameId}/analyze`);
  },
};
