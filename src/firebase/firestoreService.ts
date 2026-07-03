// SIGARAM64 — API Bridging Layer (legacy firestoreService proxy)
// Translates legacy Firestore calls to the new Express/MongoDB REST API in src/api/.
// This ensures all legacy components automatically transition to REST API.
import { authApi } from '../api/authApi';
import { studentApi } from '../api/studentApi';
import { gameApi } from '../api/gameApi';
import { puzzleApi } from '../api/puzzleApi';
import { adminApi } from '../api/adminApi';

// ── Type stubs ────────────────────────────────────────────────────────────────
export interface FirestoreUser {
  id: string;
  name?: string;
  Name?: string;
  UserName?: string;
  email?: string;
  Email?: string;
  role?: string;
  school?: any;
  SchoolName?: string;
  SchoolDistrict?: string;
  district?: string;
  Status?: boolean;
  active?: boolean;
  elo?: number;
  rating?: number;
  quizCompleted?: boolean;
  assessmentCompleted?: boolean;
  password?: string;
  [key: string]: any;
}

export interface AggregateResult {
  total: number;
  active: number;
  avgRating: number;
  totalGames: number;
  byDistrict: Record<string, { count: number; totalElo: number }>;
  bySchool: Record<string, { count: number; totalElo: number }>;
}

// ── User functions ─────────────────────────────────────────────────────────────
export async function getUser(uid: string): Promise<FirestoreUser | null> {
  return fetchUserById(uid);
}

export async function fetchUserById(uid: string): Promise<FirestoreUser | null> {
  try {
    const u = await studentApi.getStudent(uid);
    if (!u) return null;
    return {
      ...u,
      id: u.id || u.studentId,
      Name: u.name,
      Email: u.email,
      SchoolDistrict: u.school?.district || u.district,
      SchoolName: u.school?.name || u.school,
      rating: u.elo || 1000,
      Status: u.active,
      quizCompleted: u.quizCompleted,
      assessmentCompleted: u.assessmentCompleted,
    };
  } catch (err) {
    console.error('fetchUserById failed:', err);
    return null;
  }
}

export async function updateUser(uid: string, data: any): Promise<void> {
  // Map legacy keys to REST api body fields
  const payload: any = {};
  if (data.Name !== undefined) payload.name = data.Name;
  if (data.UserName !== undefined) payload.name = data.UserName;
  if (data.Age !== undefined) payload.age = Number(data.Age);
  if (data.SchoolDistrict !== undefined || data.SchoolName !== undefined) {
    payload.school = {
      district: data.SchoolDistrict || '',
      name: data.SchoolName || '',
    };
  }
  if (data.active !== undefined) payload.active = data.active;
  if (data.language !== undefined) payload.language = data.language;

  // Map legacy assessment updates to REST body fields
  if (data.quizCompleted !== undefined) payload.quizCompleted = data.quizCompleted;
  if (data.assessmentCompleted !== undefined) payload.assessmentCompleted = data.assessmentCompleted;
  if (data.rating !== undefined) payload.rating = Number(data.rating);
  if (data.playerCategory !== undefined) payload.playerCategory = data.playerCategory;
  if (data.aiLevel !== undefined) payload.aiLevel = Number(data.aiLevel);

  await studentApi.updateStudent(uid, payload);
}

export async function createUserDocument(uid: string, data: any): Promise<void> {
  // Stubs creating user directly (not typically done on client after migration)
  console.log('createUserDocument stub called:', uid, data);
}

export async function createStudentAccount(data: any, password?: string): Promise<string> {
  const res = await authApi.signup({
    name: data.Name || data.name,
    email: data.Email || data.email,
    password: password || '1234',
    orgId: data.orgId || 'SCH_SYSTEM',
  });
  return res.user?.id || '';
}

export async function saveBulkStudents(students: any[]): Promise<FirestoreUser[]> {
  const created: FirestoreUser[] = [];
  for (const s of students) {
    try {
      const res = await authApi.signup({
        name: s.data.Name,
        email: s.data.Email,
        password: s.password,
        orgId: s.data.orgId || 'SCH_SYSTEM',
      });
      created.push({
        Name: s.data.Name,
        Email: s.data.Email,
        password: s.password,
        SchoolName: s.data.SchoolName,
        SchoolDistrict: s.data.SchoolDistrict,
        id: res.user?.id || '',
        studentId: res.user?.id || '',
      });
    } catch (err) {
      console.error('saveBulkStudents item failed:', err);
    }
  }
  return created;
}

export async function getAllUsers(filters?: any): Promise<FirestoreUser[]> {
  return fetchStudents(filters?.district);
}

export async function fetchStudents(district?: string): Promise<FirestoreUser[]> {
  try {
    const list = await studentApi.listStudents(district ? { district } : undefined);
    return list.map(s => ({
      ...s,
      id: s.id || s.studentId,
      Name: s.name,
      Email: s.email,
      SchoolDistrict: s.school?.district || s.district,
      SchoolName: s.school?.name || s.school,
      rating: s.elo || 1000,
      Status: s.active,
      quizCompleted: s.quizCompleted,
      assessmentCompleted: s.assessmentCompleted,
    }));
  } catch (err) {
    console.error('fetchStudents failed:', err);
    return [];
  }
}

export function aggregateStats(students: FirestoreUser[]): AggregateResult {
  const byDistrict: Record<string, { count: number; totalElo: number }> = {};
  const bySchool: Record<string, { count: number; totalElo: number }> = {};
  let active = 0;
  let totalElo = 0;
  let totalGames = 0;

  for (const s of students) {
    const elo = s.elo || s.rating || 1000;
    if (s.active !== false && s.Status !== false) active++;
    totalElo += elo;
    totalGames += s.stats?.gamesPlayed || s.gamesPlayed || s.TotalMatch || 0;

    const dist = s.school?.district || s.SchoolDistrict || 'Unknown';
    if (!byDistrict[dist]) byDistrict[dist] = { count: 0, totalElo: 0 };
    byDistrict[dist].count++;
    byDistrict[dist].totalElo += elo;

    const school = s.school?.name || s.SchoolName || 'Unknown';
    if (!bySchool[school]) bySchool[school] = { count: 0, totalElo: 0 };
    bySchool[school].count++;
    bySchool[school].totalElo += elo;
  }

  const avgRating = students.length ? Math.round(totalElo / students.length) : 0;

  return {
    total: students.length,
    active,
    avgRating,
    totalGames,
    byDistrict,
    bySchool,
  };
}

// ── Game functions ─────────────────────────────────────────────────────────────
export async function saveUserGame(uid: string, game: any): Promise<string> {
  const res = await gameApi.saveGame(game);
  return res.gameId;
}

export async function getUserGames(uid: string): Promise<any[]> {
  return gameApi.getPlayerGames(uid);
}

export async function fetchUserGames(uid: string): Promise<any[]> {
  return gameApi.getPlayerGames(uid);
}

export async function fetchUserGameById(uid: string, gameId: string): Promise<any | null> {
  return gameApi.getGame(gameId);
}

// ── Progress functions ─────────────────────────────────────────────────────────
export async function getUserProgress(uid: string): Promise<any | null> {
  return studentApi.getProgress(uid);
}

export async function updateUserProgress(uid: string, data: any): Promise<void> {
  // Legacy stub — progress is handled on the backend now
  console.log('updateUserProgress stub called:', uid, data);
}

// ── Puzzle functions ───────────────────────────────────────────────────────────
export async function getPuzzles(filters?: any): Promise<any[]> {
  // Daily / Random puzzle endpoints
  if (filters?.daily) {
    const res = await puzzleApi.getDailyPuzzle();
    return res ? [res] : [];
  }
  const res = await puzzleApi.getRandomPuzzle(filters);
  return res ? [res] : [];
}

export async function savePuzzleAttempt(data: any): Promise<void> {
  await puzzleApi.recordAttempt(data.puzzleId, data);
}

// ── Admin functions ────────────────────────────────────────────────────────────
export async function getLeaderboard(district?: string): Promise<any[]> {
  return adminApi.getLeaderboard(district);
}

export async function getSchools(): Promise<any[]> {
  return adminApi.getSchools();
}
