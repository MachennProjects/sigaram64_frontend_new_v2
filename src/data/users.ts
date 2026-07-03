// SIGARAM64 — User Types
// Auth is now handled by the Express/MongoDB backend via REST + JWT.
// This file only exports the shared role types used across the app.

export type UserRole = 'super_admin' | 'sub_admin' | 'student';

// Re-export AppUser type alias from AuthContext for convenience
export type { AppUser } from '../context/AuthContext';
