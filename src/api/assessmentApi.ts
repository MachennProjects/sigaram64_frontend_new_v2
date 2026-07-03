// SIGARAM64 — Assessment API (CAT)
import { apiGet, apiPost } from './client';

export const assessmentApi = {
  /** Start a new CAT assessment session */
  async startAssessment(data: {
    language?: 'en' | 'ta';
    entryType?: 'new_player' | 'has_rating' | 'fide_import' | 'chesscom_import' | 'lichess_import';
    importedRating?: number;
  }): Promise<{ assessmentId: string; status: string; nextPuzzle?: any }> {
    return apiPost('/api/assessment/start', data);
  },

  /** Submit answers for rules gate */
  async submitRulesGate(assessmentId: string, data: {
    knightMoves: boolean;
    checkmateVsStalemate: boolean;
    captureFreePiece: boolean;
  }): Promise<{ passed: boolean; status: string; nextPuzzle?: any; profile?: any }> {
    return apiPost(`/api/assessment/${assessmentId}/rules-gate`, data);
  },

  /** Submit a puzzle response in active CAT loop */
  async submitPuzzleResponse(assessmentId: string, data: {
    puzzleId: string;
    correct: boolean;
    timeTakenSec: number;
  }): Promise<{ finished: boolean; status: string; currentEstimate?: number; nextPuzzle?: any; profile?: any }> {
    return apiPost(`/api/assessment/${assessmentId}/puzzle-response`, data);
  },

  /** Submit an answer during assessment (Backward compatibility alias) */
  async submitAnswer(assessmentId: string, data: {
    section: string;
    questionId: string;
    selectedOption?: string;
    enteredMoves?: string;
    correctAnswer?: string;
    correctMoves?: string;
    timeSec?: number;
    puzzleId?: string;
    correct?: boolean;
    timeTakenSec?: number;
  }): Promise<any> {
    // If it's a CAT puzzle submit, use the newer endpoint
    if (data.puzzleId) {
      return this.submitPuzzleResponse(assessmentId, {
        puzzleId: data.puzzleId,
        correct: data.correct ?? false,
        timeTakenSec: data.timeTakenSec ?? 0
      });
    }
    return apiPost(`/api/assessment/${assessmentId}/answer`, data);
  },

  /** Complete an assessment and get the final profile */
  async completeAssessment(assessmentId: string): Promise<any> {
    return apiPost(`/api/assessment/${assessmentId}/complete`);
  },

  /** Get the latest completed assessment for a student */
  async getLatestAssessment(studentId: string): Promise<any> {
    return apiGet(`/api/assessment/${studentId}/latest`);
  },
};
