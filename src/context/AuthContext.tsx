// SIGARAM64 — Auth Context (REST + JWT)
// Replaces Firebase Auth + Firestore with the new backend REST API.
// JWT token is stored in localStorage and attached to all API calls via client.ts.
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi } from '../api/authApi';
import { getToken, clearToken } from '../api/client';
import { gameApi } from '../api/gameApi';
import type { UserRole } from '../data/users';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AppUser {
  id: string;
  studentId?: string;
  name: string;
  email?: string;
  role: UserRole;
  school?: {
    id: string;
    name: string;
    district: string;
  };
  managedSchoolId?: string;
  managedSchoolName?: string;
  language: 'en' | 'ta';
  active: boolean;
  quizCompleted: boolean;
  assessmentCompleted: boolean;
  age?: number;
  dob?: string;
  rollNo?: string;
  studentClass?: string;
  // Lowercase aliases for UI compatibility
  avatar?: string;
  district?: string;
  elo?: number;
  streak?: number;
  totalXP?: number;
  badges?: string[];
}

interface AuthContextValue {
  user: AppUser | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (identifier: string, password: string, isAdmin?: boolean) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  games: any[];
  loadingGames: boolean;
  refreshGames: () => Promise<void>;
}

// ── Context ───────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeUser(raw: any): AppUser {
  return {
    ...raw,
    id:       raw.id || raw._id || raw.uid || '',
    name:     raw.name || raw.Name || '',
    email:    raw.email || raw.Email || '',
    role:     raw.role || 'student',
    language: raw.language || 'en',
    active:   raw.active ?? true,
    quizCompleted:      raw.quizCompleted ?? false,
    assessmentCompleted: raw.assessmentCompleted ?? false,
    managedSchoolId:    raw.managedSchoolId,
    managedSchoolName:  raw.managedSchoolName,
    // UI aliases
    avatar:   (raw.name || raw.Name || raw.email || '?')[0]?.toUpperCase(),
    district: raw.school?.district || raw.SchoolDistrict || raw.district || '',
    elo:      raw.currentElo || raw.rating || raw.elo || 200,
    streak:   raw.streakDays || raw.streak || 0,
    totalXP:  raw.totalXP || 0,
    badges:   raw.badges || [],
  };
}

// ── Provider ──────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [games, setGames] = useState<any[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);

  // ── Fetch games ────────────────────────────────────────────────────────────
  const refreshGames = useCallback(async () => {
    if (!user) return;
    setLoadingGames(true);
    try {
      // Use studentId (e.g. "TN9999") which is stored on game documents,
      // fall back to UUID id only if studentId is not set.
      const lookupId = user.studentId || user.id;
      const gamesData = await gameApi.getPlayerGames(lookupId, 20);
      setGames(gamesData || []);
    } catch (err) {
      console.error('Error fetching games:', err);
    } finally {
      setLoadingGames(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      refreshGames();
    } else {
      setGames([]);
    }
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── On mount: restore session from JWT ────────────────────────────────────
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }
    authApi.getMe()
      .then(raw => setUser(normalizeUser(raw)))
      .catch(() => {
        clearToken();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── Login ─────────────────────────────────────────────────────────────────
  const login = useCallback(async (identifier: string, password: string, isAdmin = false) => {
    let raw: any;
    if (isAdmin) {
      // Admin login: email + password only
      const res = await authApi.loginAdmin(identifier, password);
      raw = res.user;
    } else {
      // Student login: tries email and studentId
      const res = await authApi.loginStudent(identifier, password);
      raw = res.user;
    }
    setUser(normalizeUser(raw));
  }, []);

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    authApi.logout();
    setUser(null);
    setGames([]);
  }, []);

  // ── Refresh User ──────────────────────────────────────────────────────────
  const refreshUser = useCallback(async () => {
    try {
      const raw = await authApi.getMe();
      setUser(normalizeUser(raw));
    } catch (err) {
      console.error('refreshUser error:', err);
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        isAuthenticated: !!user,
        loading,
        login,
        logout,
        refreshUser,
        games,
        loadingGames,
        refreshGames,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
