// SIGARAM64 — Stockfish Backend API
// Used for deep game analysis and PGN viewer engine connection.
// For real-time play, the client-side WASM Stockfish is used instead.
import { apiPost } from './client';

export const stockfishApi = {
  /** Get best move for a position (for PGN viewer hint) */
  async getBestMove(fen: string, depth?: number): Promise<{
    bestMove: string;
    eval: number;
    depth: number;
    pv?: string[];
  }> {
    return apiPost('/api/stockfish/best-move', { fen, depth });
  },

  /** Evaluate a position with top candidate moves */
  async evaluatePosition(fen: string): Promise<{
    eval: number;
    depth: number;
    topMoves: { move: string; eval: number }[];
  }> {
    return apiPost('/api/stockfish/evaluate', { fen });
  },

  /** Analyze a complete game from PGN — returns per-move classification */
  async analyzeGame(pgn: string): Promise<{
    moves: any[];
    analysis: any;
  }> {
    return apiPost('/api/stockfish/analyze-game', { pgn });
  },
};
