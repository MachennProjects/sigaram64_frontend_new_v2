// Student Sticky Top Bar + Dropdown Menu
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { STUDENT_DROPDOWN_LINKS } from '../navigation/navConfig';
import { XPBar, StreakFlame } from '../ui';
import logoIcon from '../../assets/Images/Logo/sigaram64_icon_transparent_512.png';

export default function StudentTopBar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [showMenu, setShowMenu] = useState(false);

  const isQuizRoute = location.pathname === '/assessment';
  
  const getPageTitle = () => {
    switch(location.pathname) {
      case '/dashboard': return 'Home';
      case '/lessons': return 'Learn Hub';
      case '/play': return 'Play Hub';
      case '/puzzle': return 'Daily Puzzle';
      case '/famous-games': return 'Games Library';
      case '/pgn-load':
      case '/pgn-load/viewer': return 'PGN Viewer';
      case '/profile': return 'My Profile';
      default: return 'SIGARAM64';
    }
  };
  
  const pageTitle = getPageTitle();
  
  // Quiz language state synced with sessionStorage
  const [quizLang, setQuizLang] = useState<'english' | 'tamil'>(() => {
    const saved = sessionStorage.getItem('sigaram64_quiz_lang');
    return (saved === 'english' || saved === 'tamil') ? saved : 'english';
  });

  useEffect(() => {
    const handleLangChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'english' || detail === 'tamil') {
        setQuizLang(detail);
      }
    };
    window.addEventListener('quiz-lang-changed', handleLangChange);
    return () => {
      window.removeEventListener('quiz-lang-changed', handleLangChange);
    };
  }, []);

  return (
    <>
      {/* ── Sticky top bar ── */}
      <div className={`flex items-center justify-between px-5 py-3 bg-navy border-b border-divider sticky top-0 z-40`}>
        <div className={`flex items-center gap-2`}>
          {location.pathname === '/lessons' && (
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-1.5 text-gold text-xs font-bold bg-navy-mid border border-gold/30 px-3.5 py-1.5 rounded-full hover:bg-gold hover:text-navy transition-all cursor-pointer mr-2 active:scale-95 shadow-sm"
            >
              ← Home
            </button>
          )}
          {/* Hide crown icon on desktop since sidebar has it, but show title */}
          <img
            src={logoIcon}
            alt=""
            className={`h-5 w-5 object-contain ${isQuizRoute ? '' : 'md:hidden'}`}
          />
          <span className="text-gold font-bold text-sm tracking-wide uppercase">{pageTitle}</span>
        </div>

        <div className="flex items-center gap-3">
          {isQuizRoute ? (
            <>
              <button
                onClick={() => window.dispatchEvent(new CustomEvent('toggle-quiz-lang'))}
                className="text-xs font-bold text-gold bg-navy-mid border border-gold/30 px-3.5 py-2 rounded-full hover:bg-gold hover:text-navy transition-colors cursor-pointer"
              >
                {quizLang === 'english' ? "தமிழ்" : "English"}
              </button>
              <button
                onClick={() => {
                  logout();
                  navigate('/login');
                }}
                className="text-gray-400 text-xs font-semibold hover:text-white transition-colors cursor-pointer ml-1"
              >
                {quizLang === 'english' ? "Save & Exit" : "சேமி & வெளியேறு"}
              </button>
            </>
          ) : (
            <>
              {/* XP Bar */}
              {user && (user.role === 'student' || user.role === 'sub_admin') && (
                <XPBar totalXP={user.totalXP || 0} showLabels={false} inline={true} className="hidden md:flex" />
              )}
              {/* Streak flame */}
              {user && (
                <StreakFlame streakDays={user.streak || 0} />
              )}
              {/* Notification bell */}
              {/* <div className="relative cursor-pointer">
                <span className="text-gray-300 text-xl">🔔</span>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">2</span>
              </div> */}
              {/* Avatar + menu */}
              <button
                onClick={() => setShowMenu(m => !m)}
                className="w-8 h-8 rounded-full bg-gold flex items-center justify-center active:scale-95 transition-transform"
              >
                <span className="text-navy font-bold text-sm">{user?.avatar ?? user?.name?.[0] ?? 'S'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Dropdown menu ── */}
      {showMenu && (
        <div
          className="fixed inset-0 z-50"
          onClick={() => setShowMenu(false)}
        >
          <div
            className="absolute top-16 right-4 bg-navy-mid border border-divider rounded-2xl shadow-2xl p-2 min-w-[220px] animate-fadeIn"
            onClick={e => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-divider mb-1">
              <p className="text-white text-sm font-semibold">{user?.name}</p>
              <p className="text-gray-400 text-xs" title={user?.rollNo || user?.studentId || user?.id}>
                {user?.role === 'student'
                  ? (user?.rollNo ? `Roll No: ${user.rollNo}` : `ID: ${user?.studentId || '—'}`)
                  : (user?.email || `ID: ${user?.id?.substring(0, 8)}...`)
                } · Elo {user?.elo ?? '—'}
              </p>
              <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-navy border border-gold/30 text-gold capitalize">{user?.role}</span>
            </div>

            {/* Extra nav links in dropdown for mobile users mostly */}
            <div className="md:hidden">
              {STUDENT_DROPDOWN_LINKS.map(item => (
                <button
                  key={item.path}
                  onClick={() => { navigate(item.path); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-gray-300 text-sm hover:bg-navy hover:text-white rounded-xl transition-colors"
                >
                  {item.icon} {item.label}
                </button>
              ))}
            </div>

            <div className="border-t border-divider mt-1 pt-1">
              {user?.role === 'sub_admin' && (
                <button
                  onClick={() => { navigate('/campus'); setShowMenu(false); }}
                  className="w-full text-left px-4 py-2.5 text-gold text-sm hover:bg-navy hover:text-white rounded-xl transition-colors"
                >
                  🏫 Campus Portal
                </button>
              )}
              <button
                onClick={() => { logout(); navigate('/'); }}
                className="w-full text-left px-4 py-2.5 text-red-400 text-sm hover:bg-navy hover:text-red-300 rounded-xl transition-colors"
              >
                🚪 Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
