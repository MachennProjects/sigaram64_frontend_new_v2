// SIGARAM64 — Quiz Guard
// Redirects to /assessment if quiz/assessment is not completed yet.
// Admins bypass this check.
import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function QuizGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [quizCompleted, setQuizCompleted] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user || !user.id) {
      setLoading(false);
      return;
    }

    // Admins bypass assessment requirement — they can play freely
    if (user.role === 'super_admin' || user.role === 'sub_admin') {
      setQuizCompleted(true);
      setLoading(false);
      return;
    }

    // Students: check quizCompleted flag from backend user profile
    if (user.quizCompleted) {
      setQuizCompleted(true);
    }

    setLoading(false);
  }, [user, authLoading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-gold animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (!quizCompleted) {
    return <Navigate to="/assessment" replace />;
  }

  return <>{children}</>;
}
