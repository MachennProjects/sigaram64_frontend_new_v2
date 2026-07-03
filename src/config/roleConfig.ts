// SIGARAM64 — Centralized Role Configuration
import type { UserRole } from '../data/users';

/**
 * Default home page for each role after login.
 * Used by ProtectedRoute (wrong-role redirect) and RoleRedirect (post-login redirect).
 */
export const ROLE_HOME: Record<UserRole, string> = {
  super_admin: '/admin',
  sub_admin:   '/campus',
  student:     '/dashboard',
};
