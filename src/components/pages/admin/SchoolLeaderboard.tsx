// SIGARAM64 — SchoolLeaderboard
// Top students ranked by ELO — podium + full table
import React, { useEffect, useState } from 'react';
import { adminApi } from '../../../api';
import { useAuth } from '../../../context/AuthContext';

const CATEGORY_COLORS: Record<string, string> = {
  'Basic Level Player':    'text-gray-400 bg-gray-800/40',
  'Intermediate Player':   'text-blue-400 bg-blue-900/30',
  'Advanced Player':       'text-purple-400 bg-purple-900/30',
  'Expert Player':         'text-gold bg-gold/10',
};

const MEDAL: Record<number, { bg: string; text: string; crown: string }> = {
  1: { bg: 'bg-gradient-to-b from-yellow-400/30 to-yellow-600/10 border-yellow-400/40', text: 'text-yellow-300', crown: '👑' },
  2: { bg: 'bg-gradient-to-b from-gray-400/20 to-gray-600/10 border-gray-400/30',       text: 'text-gray-300',   crown: '🥈' },
  3: { bg: 'bg-gradient-to-b from-amber-700/20 to-amber-900/10 border-amber-700/30',    text: 'text-amber-400',  crown: '🥉' },
};

export default function SchoolLeaderboard() {
  const { user }              = useAuth();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState('All');

  useEffect(() => {
    const schoolId = user?.role === 'sub_admin' ? user.managedSchoolId : undefined;
    adminApi.getLeaderboard(schoolId)
      .then(data => setLeaderboard(Array.isArray(data) ? data : []))
      .catch(err => console.error('Failed to load leaderboard', err))
      .finally(() => setLoading(false));
  }, [user]);

  const categories = ['All', 'Basic Level Player', 'Intermediate Player', 'Advanced Player', 'Expert Player'];

  const filtered = filter === 'All'
    ? leaderboard
    : leaderboard.filter(s => s.category === filter || s.playerCategory === filter);

  const top3 = filtered.slice(0, 3);
  const rest  = filtered.slice(3);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg font-sans p-6 lg:p-10 text-xs">
      <div className="max-w-4xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">🏆 School Leaderboard</h1>
          <p className="text-gray-500 text-xs mt-1">
            Top students ranked by ELO rating · {filtered.length} students
          </p>
        </div>

        {/* Category filter */}
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`text-[11px] font-bold px-3 py-1.5 rounded-full border transition-colors ${
                filter === cat
                  ? 'bg-gold text-navy border-gold'
                  : 'text-gray-400 border-[#1E2E52] hover:border-gold/30 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="card p-16 text-center">
            <div className="text-4xl mb-3">🏆</div>
            <p className="text-gray-400 font-bold">No students in leaderboard yet</p>
          </div>
        ) : (
          <>
            {/* Top 3 Podium */}
            {top3.length > 0 && (
              <div className="grid grid-cols-3 gap-4">
                {[top3[1], top3[0], top3[2]].filter(Boolean).map((s, i) => {
                  // Arrange: Silver (left) | Gold (center, taller) | Bronze (right)
                  const rank = s.rank;
                  const medal = MEDAL[rank] || MEDAL[3];
                  const isFirst = rank === 1;
                  return (
                    <div
                      key={s.studentId}
                      className={`card border ${medal.bg} flex flex-col items-center p-5 ${isFirst ? 'sm:-mt-4' : ''} transition-all`}
                    >
                      <div className="text-2xl mb-1">{medal.crown}</div>
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg mb-2 ${
                        isFirst ? 'bg-yellow-400/20 text-yellow-300 border border-yellow-400/30' : 'bg-[#1E2E52] text-gray-300'
                      }`}>
                        {s.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <p className={`font-bold text-sm text-center truncate w-full ${medal.text}`}>{s.name}</p>
                      <p className="text-gray-500 text-[10px] text-center truncate w-full mt-0.5">{s.schoolName}</p>
                      <div className={`text-xl font-bold mt-3 ${medal.text}`}>{s.elo}</div>
                      <div className="text-gray-500 text-[9px] uppercase tracking-wide">ELO Rating</div>
                      {s.xp !== undefined && (
                        <div className="text-[10px] text-gray-600 mt-1">{(s.xp || 0).toLocaleString()} XP</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Full ranked table */}
            <div className="card p-6">
              <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Full Rankings</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1E2E52] text-gray-400 text-[10px] uppercase font-bold">
                      <th className="pb-3 pr-4 w-10">Rank</th>
                      <th className="pb-3 pr-4">Name</th>
                      <th className="pb-3 pr-4 text-right">ELO</th>
                      <th className="pb-3 pr-4 text-right">XP</th>
                      <th className="pb-3">Level</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2E52]/20">
                    {filtered.map((s) => {
                      const medal = MEDAL[s.rank];
                      return (
                        <tr key={s.studentId} className="hover:bg-[#12234A]/20 transition-colors">
                          <td className="py-3 pr-4">
                            {medal ? (
                              <span className={`font-bold text-sm ${medal.text}`}>{medal.crown}</span>
                            ) : (
                              <span className="text-gray-600 font-mono text-[11px]">#{s.rank}</span>
                            )}
                          </td>
                          <td className="py-3 pr-4">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-[#1E2E52] flex items-center justify-center text-gray-300 font-bold text-[10px] flex-shrink-0">
                                {s.name?.[0]?.toUpperCase() || '?'}
                              </div>
                              <div>
                                <p className="text-white font-semibold text-[11px]">{s.name}</p>
                                <p className="text-gray-600 text-[9px]">{s.schoolName}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 pr-4 text-right">
                            <span className="text-gold font-bold font-mono">{s.elo}</span>
                          </td>
                          <td className="py-3 pr-4 text-right text-gray-400 font-mono text-[11px]">
                            {(s.xp || 0).toLocaleString()}
                          </td>
                          <td className="py-3">
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                              CATEGORY_COLORS[s.category || s.playerCategory || ''] || 'text-gray-400 bg-gray-800/40'
                            }`}>
                              {(s.category || s.playerCategory || 'Beginner').replace(' Player', '')}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
