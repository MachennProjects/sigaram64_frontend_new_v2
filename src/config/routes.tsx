// SIGARAM64 — Centralized Route Configuration (Data Router Pattern)
// All routes defined as a JavaScript object tree using createBrowserRouter
import { createBrowserRouter, Outlet } from 'react-router-dom';

// Routing components
import ProtectedRoute from '../components/routing/ProtectedRoute';
import AuthRoute from '../components/routing/AuthRoute';
import RoleRedirect from '../components/routing/RoleRedirect';

// Layouts
import AdminLayout from '../components/layout/AdminLayout';
import { StudentPagesLayout } from '../components/layout/RoleAdaptiveLayouts';

// Public pages
import LandingPage from '../components/pages/public/LandingPage';
import NotFound from '../components/pages/public/NotFound';

// Student pages
import StudentDashboard from '../components/pages/student/Dashboard';
import ChessAssessment from '../components/pages/student/ChessAssessment';
import QuizGuard from '../components/routing/QuizGuard';
import ProfileGuard from '../components/routing/ProfileGuard';
import PuzzleScreen from '../components/pages/student/PuzzleScreen';
import GameAnalysis from '../components/pages/student/GameAnalysis';
import FeatureShelf from '../components/pages/student/FeatureShelf';
import VideoLessonPlayer from '../components/pages/student/VideoLessonPlayer';
import PlayHub from '../components/pages/student/PlayHub';
import FamousGames from '../components/pages/student/FamousGames';
import PgnViewer from '../components/pages/student/pgn-viewer/PgnViewer';
import ProfileScreen from '../components/pages/student/ProfileScreen';
import PlayWithAI from '../components/pages/student/PlayWithAI';

// Admin pages (super_admin)
import AdminDashboard from '../components/pages/admin/AdminDashboard';
import StudentManager from '../components/pages/admin/StudentManager';
import StudentAnalytics from '../components/pages/admin/StudentAnalytics';
import RenewalReport from '../components/pages/admin/RenewalReport';
import DistrictActivity from '../components/pages/admin/DistrictActivity';
import OrganizationManager from '../components/pages/admin/OrganizationManager';
import OrganizationDetail from '../components/pages/admin/OrganizationDetail';
import BootcampActivity from '../components/pages/admin/BootcampActivity';
import SchoolLeaderboard from '../components/pages/admin/SchoolLeaderboard';

export const router = createBrowserRouter([
  // ── Public routes (no guard) ──────────────────────────────────────────────
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    path: '/login',
    element: <AuthRoute />,
  },
  {
    path: '/home',
    element: <RoleRedirect />,
  },

  // ── Chess/student pages — ALL roles can access (admins play chess too) ────
  {
    element: <ProtectedRoute allowedRoles={['student', 'sub_admin', 'super_admin']} />,
    children: [
      {
        element: <StudentPagesLayout />,
        children: [
          {
            element: (
              <ProfileGuard>
                <QuizGuard>
                  <Outlet />
                </QuizGuard>
              </ProfileGuard>
            ),
            children: [
              { path: '/dashboard',                         element: <StudentDashboard /> },
              { path: '/puzzle',                            element: <PuzzleScreen /> },
              { path: '/analysis',                          element: <GameAnalysis /> },
              { path: '/analysis/:gameId',                  element: <GameAnalysis /> },
              { path: '/students/:uid/games/:gameId',       element: <GameAnalysis /> },
              { path: '/features',                          element: <FeatureShelf /> },
              { path: '/play',                              element: <PlayHub /> },
              { path: '/play/ai',                           element: <PlayWithAI /> },
              { path: '/games-library',                     element: <FamousGames /> },
              { path: '/pgn-load',                          element: <PgnViewer /> },
              { path: '/pgn-load/viewer',                   element: <PgnViewer /> },
              { path: '/profile',                           element: <ProfileScreen /> },
            ],
          },
          { path: '/assessment', element: <ChessAssessment /> },
          { path: '/lessons',    element: <VideoLessonPlayer /> },
        ],
      },
    ],
  },

  // ── Sub Admin e-campus pages ──────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['sub_admin', 'super_admin']} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: '/campus',            element: <AdminDashboard /> },   // sub_admin home (school-scoped)
          { path: '/campus/students',   element: <StudentManager /> },
          // { path: '/district-activity', element: <DistrictActivity /> },
          { path: '/students',          element: <StudentManager /> },
          { path: '/students/:uid',     element: <StudentAnalytics /> },
          { path: '/bootcamp',          element: <BootcampActivity /> },
          { path: '/leaderboard',       element: <SchoolLeaderboard /> },
          // { path: '/renewal-report',    element: <RenewalReport /> },
        ],
      },
    ],
  },

  // ── Super Admin only pages ────────────────────────────────────────────────
  {
    element: <ProtectedRoute allowedRoles={['super_admin']} />,
    children: [
      {
        element: <AdminLayout />,
        children: [
          { path: '/admin',                element: <AdminDashboard /> },
          { path: '/organizations',        element: <OrganizationManager /> },
          { path: '/organizations/:id',    element: <OrganizationDetail /> },
        ],
      },
    ],
  },

  // ── Catch-all ────────────────────────────────────────────────────────────
  {
    path: '*',
    element: <NotFound />,
  },
]);
