import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { studentApi } from '../../api/studentApi';

export default function ProfileGuard({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading, refreshUser, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [needsProfile, setNeedsProfile] = useState(false);

  // Form State
  const [dob, setDob] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authLoading) return;
    
    if (!user || !user.id) {
      setLoading(false);
      return;
    }

    // Only apply to students
    if (user.role !== 'student') {
      setNeedsProfile(false);
      setLoading(false);
      return;
    }

    // Check if required DOB field exists
    const hasDob = !!(user as any).dob;

    if (!hasDob) {
      setNeedsProfile(true);
      setDob((user as any).dob || '');
    } else {
      setNeedsProfile(false);
    }
    
    setLoading(false);
  }, [user, authLoading]);

  const calculateAge = (dobString: string): number => {
    const today = new Date();
    const birthDate = new Date(dobString);
    let ageVal = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      ageVal--;
    }
    return ageVal;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dob) {
      setError("Please enter your date of birth.");
      return;
    }
    
    const calculatedAge = calculateAge(dob);
    if (calculatedAge < 3 || calculatedAge > 100) {
      setError("Please enter a valid date of birth.");
      return;
    }
    
    setSaving(true);
    setError('');
    
    const userId = user?.id;
    if (!userId) {
      setError("User session not found.");
      return;
    }

    try {
      await studentApi.updateStudent(userId, {
        dob: dob,
        age: calculatedAge,
      });
      // Refresh user context so the app knows we have the details
      await refreshUser();
      setNeedsProfile(false);
    } catch (err: any) {
      setError("Failed to save details: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-gold animate-pulse text-lg">Loading...</div>
      </div>
    );
  }

  if (needsProfile) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4 font-sans">
        <div className="w-full max-w-md bg-navy border border-divider rounded-2xl p-6 md:p-8 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent" />
          
          <div className="text-center mb-6">
            <span className="text-4xl block mb-2">🎉</span>
            <h1 className="text-2xl font-bold text-white mb-2">Welcome, {user?.name || 'Student'}!</h1>
            <p className="text-gray-400 text-sm">
              Please enter your date of birth to complete your profile setup.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5 font-semibold">Date of Birth</label>
              <input
                type="date"
                value={dob}
                onChange={e => { setDob(e.target.value); setError(''); }}
                max={new Date().toISOString().split('T')[0]}
                className="w-full bg-navy-mid border border-divider rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-gold/50 transition-colors"
                required
              />
            </div>

            {error && (
              <div className="bg-red-900/30 border border-red-700/40 rounded-xl px-3 py-2 mt-2">
                <p className="text-red-400 text-xs text-center">⚠ {error}</p>
              </div>
            )}

            <button
               type="submit"
               disabled={saving}
               className={`w-full mt-6 bg-gold text-navy font-bold py-3 rounded-xl transition-all hover:bg-gold-light active:scale-[0.98] ${saving ? "opacity-70 cursor-wait" : ""}`}
            >
              {saving ? "Saving..." : "Save & Continue"}
            </button>

            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login');
              }}
              className="w-full text-center text-gray-400 hover:text-white text-xs font-semibold mt-4 hover:underline cursor-pointer block"
            >
              Logout / Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
