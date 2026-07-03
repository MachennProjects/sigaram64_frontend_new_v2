// SIGARAM64 — Student Layout (Composition)
// Assembles sidebar, top bar, bottom nav, and chatbot
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../navigation/Sidebar';
import StudentTopBar from '../navigation/StudentTopBar';
import StudentBottomNav from '../navigation/StudentBottomNav';
import ChatBot from '../navigation/ChatBot';
import { useAuth } from '../../context/AuthContext';

export default function StudentLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const isQuizRoute = location.pathname === '/assessment';
  const isProfileSetupRoute = user?.role === 'student' && !user.dob && !isQuizRoute;
  const isCleanLayout = isQuizRoute || isProfileSetupRoute;

  return (
    <div className={`${isCleanLayout ? 'h-screen overflow-hidden' : 'min-h-screen pb-20 md:pb-0'} bg-dark-bg flex flex-col md:flex-row`}>

      {/* ── Desktop Sidebar (Hidden on Mobile and during Clean Layout) ── */}
      {!isCleanLayout && <Sidebar />}

      {/* ── Main Content Area (Full screen during Clean Layout) ── */}
      <div className={`flex-1 flex flex-col ${isCleanLayout ? 'h-screen overflow-hidden' : 'min-h-screen md:ml-64'}`}>


        {/* ── Sticky top bar + dropdown ── */}
        {!isProfileSetupRoute && <StudentTopBar />}

        {/* ── Page content ── */}
        <div className={`flex-1 animate-fadeIn ${isCleanLayout ? 'pb-0 overflow-hidden flex flex-col' : 'pb-6'}`}>
          <Outlet />
        </div>

      </div>

      {/* ── ChatBot floating button (Hidden during Clean Layout) ── */}
      {!isCleanLayout && <ChatBot />}

      {/* ── Bottom navigation (Mobile Only and Hidden during Clean Layout) ── */}
      {!isCleanLayout && <StudentBottomNav />}
    </div>
  );
}
