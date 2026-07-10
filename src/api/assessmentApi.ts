// SIGARAM64 — Assessment API (CAT)
import { apiGet, apiPost, getApiUrl } from './client';

const API_URL = getApiUrl();

/** Start a new CAT assessment session */
async function startAssessment(data: {
  language?: 'en' | 'ta';
  entryType?: 'new_player' | 'has_rating' | 'fide_import' | 'chesscom_import' | 'lichess_import';
  importedRating?: number;
  guestId?: string;
}): Promise<{ assessmentId: string; status: string; nextPuzzle?: any; guestId?: string }> {
  return apiPost('/api/assessment/start', data);
}

/** Submit answers for rules gate */
async function submitRulesGate(assessmentId: string, data: {
  knightMoves: boolean;
  checkmateVsStalemate: boolean;
  captureFreePiece: boolean;
  guestId?: string;
}): Promise<{ passed: boolean; status: string; nextPuzzle?: any; profile?: any }> {
  return apiPost(`/api/assessment/${assessmentId}/rules-gate`, data);
}

/** Submit a puzzle response in active CAT loop */
async function submitPuzzleResponse(assessmentId: string, data: {
  puzzleId: string;
  correct: boolean;
  timeTakenSec: number;
  guestId?: string;
}): Promise<{ finished: boolean; status: string; currentEstimate?: number; nextPuzzle?: any; profile?: any }> {
  return apiPost(`/api/assessment/${assessmentId}/puzzle-response`, data);
}

/** Save guest name + email before showing results */
async function saveGuestInfo(assessmentId: string, data: {
  guestId: string;
  guestName: string;
  guestEmail: string;
}): Promise<{ success: boolean }> {
  // No auth token needed for this endpoint — use raw fetch
  const res = await fetch(`${API_URL}/api/assessment/${assessmentId}/guest-info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  return json.data ?? json;
}

/** Submit a Bloom probe answer */
async function submitBloomProbe(assessmentId: string, data: {
  probeType: 'bloom4' | 'bloom5';
  answer?: string;
  selectedMove?: number;
  reason?: string;
  correct?: boolean;
  guestId?: string;
}): Promise<{ success: boolean }> {
  const token = localStorage.getItem('sigaram64_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${API_URL}/api/assessment/${assessmentId}/bloom-probe`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
  const json = await res.json();
  return json.data ?? json;
}

/** Submit an answer during assessment (Backward compatibility alias) */
async function submitAnswer(assessmentId: string, data: {
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
  guestId?: string;
}): Promise<any> {
  // If it's a CAT puzzle submit, use the newer endpoint
  if (data.puzzleId) {
    return submitPuzzleResponse(assessmentId, {
      puzzleId: data.puzzleId,
      correct: data.correct ?? false,
      timeTakenSec: data.timeTakenSec ?? 0,
      guestId: data.guestId,
    });
  }
  return apiPost(`/api/assessment/${assessmentId}/answer`, data);
}

/** Complete an assessment and get the final profile */
async function completeAssessment(assessmentId: string, guestId?: string): Promise<any> {
  return apiPost(`/api/assessment/${assessmentId}/complete`, guestId ? { guestId } : undefined);
}

/** Get the latest completed assessment for a student */
async function getLatestAssessment(studentId: string): Promise<any> {
  return apiGet(`/api/assessment/${studentId}/latest`);
}

export const assessmentApi = {
  startAssessment,
  submitRulesGate,
  submitPuzzleResponse,
  saveGuestInfo,
  submitBloomProbe,
  submitAnswer,
  completeAssessment,
  getLatestAssessment,
};
