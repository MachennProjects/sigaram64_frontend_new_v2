// SIGARAM64 — BootcampActivity
// 7-day game activity tracker for sub_admin (school-scoped) or super_admin (org-scoped)
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../../../api';

export default function BootcampActivity() {
  const [searchParams]  = useSearchParams();
  const orgId           = searchParams.get('orgId') || undefined;

  const [data,    setData]    = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    setLoading(true);
    adminApi.getBootcampActivity(orgId)
      .then(d => setData(d))
      .catch(() => setError('Failed to load activity data.'))
      .finally(() => setLoading(false));
  }, [orgId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading bootcamp activity…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-red-400 text-sm font-bold">{error}</div>
      </div>
    );
  }

  const heatmap        = data?.heatmap        || [];
  const stats          = data?.stats          || {};
  const studentActivity = data?.studentActivity || [];

  const todayPlayers = studentActivity.filter((s: any) => s.gamesToday > 0);
  const inactivePlayers = studentActivity.filter((s: any) => s.gamesThisWeek === 0);
  const maxGames = Math.max(...heatmap.map((h: any) => h.count), 1);

  const dayLabels: Record<string, string> = {
    Mon: 'Mon', Tue: 'Tue', Wed: 'Wed', Thu: 'Thu',
    Fri: 'Fri', Sat: 'Sat', Sun: 'Sun',
  };

  const getHeatColor = (count: number) => {
    const ratio = count / maxGames;
    if (ratio === 0)    return 'bg-[#12234A]';
    if (ratio < 0.25)   return 'bg-gold/20';
    if (ratio < 0.5)    return 'bg-gold/40';
    if (ratio < 0.75)   return 'bg-gold/65';
    return 'bg-gold';
  };

  return (
    <div className="min-h-screen bg-dark-bg font-sans p-6 lg:p-10 text-xs">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">📍 Bootcamp Activity</h1>
          <p className="text-gray-500 text-xs mt-1">
            Game activity for the last 7 days · {stats.totalStudents || 0} students
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Games This Week',   value: stats.totalGamesWeek      || 0, icon: '♟', gold: true },
            { label: 'Active Students',   value: stats.uniqueActiveStudents || 0, icon: '✅', gold: false },
            { label: 'Games Today',       value: stats.todayGamesCount     || 0, icon: '📅', gold: false },
            { label: 'Inactive This Week', value: inactivePlayers.length,         icon: '⚠️', gold: false },
          ].map(s => (
            <div key={s.label} className="card p-4 text-center">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className={`text-xl font-bold ${s.gold ? 'text-gold' : 'text-white'}`}>
                {s.value}
              </div>
              <div className="text-gray-500 text-[9px] uppercase tracking-wide mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* 7-Day Heatmap */}
        <div className="card p-6">
          <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">7-Day Activity Heatmap</h3>
          <div className="grid grid-cols-7 gap-2">
            {heatmap.map((h: any) => {
              const d = new Date(h.date);
              const day = d.toLocaleDateString('en-US', { weekday: 'short' });
              const dateLabel = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              return (
                <div key={h.date} className="flex flex-col items-center gap-1.5">
                  <div className="text-gray-500 text-[9px]">{day}</div>
                  <div
                    className={`w-full aspect-square rounded-lg flex items-center justify-center font-bold text-[11px] transition-all cursor-default ${getHeatColor(h.count)}`}
                    title={`${h.count} games on ${dateLabel}`}
                  >
                    <span className={h.count > 0 ? 'text-navy' : 'text-gray-700'}>{h.count}</span>
                  </div>
                  <div className="text-gray-600 text-[9px] text-center">{dateLabel}</div>
                </div>
              );
            })}
          </div>
          <p className="text-gray-600 text-[10px] mt-3 text-right">
            Darker = more games played
          </p>
        </div>

        {/* Today's Active Players */}
        {todayPlayers.length > 0 && (
          <div className="card p-6">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-white font-bold text-sm uppercase tracking-wider">Today's Players</h3>
              <span className="text-[10px] font-bold text-green-400 bg-green-900/20 border border-green-500/20 px-2 py-0.5 rounded-full">
                {todayPlayers.length} active today
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {todayPlayers.map((s: any) => (
                <div key={s.id} className="bg-[#12234A] border border-green-500/20 rounded-xl p-3 text-center">
                  <div className="w-8 h-8 rounded-full bg-green-900/40 border border-green-500/30 flex items-center justify-center text-green-400 font-bold text-sm mx-auto mb-2">
                    {s.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <p className="text-white text-[11px] font-semibold truncate">{s.name}</p>
                  <p className="text-green-400 text-[10px] mt-0.5">{s.gamesToday} game{s.gamesToday !== 1 ? 's' : ''} today</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Inactive Students Alert */}
        {inactivePlayers.length > 0 && (
          <div className="card p-6 border-red-500/10">
            <div className="flex items-center gap-3 mb-4">
              <h3 className="text-white font-bold text-sm uppercase tracking-wider">⚠️ Inactive This Week</h3>
              <span className="text-[10px] font-bold text-red-400 bg-red-900/20 border border-red-500/20 px-2 py-0.5 rounded-full">
                {inactivePlayers.length} students
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1E2E52] text-gray-400 text-[10px] uppercase font-bold">
                    <th className="pb-2 pr-4">Student</th>
                    <th className="pb-2 pr-4">Student ID</th>
                    <th className="pb-2">Games This Week</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2E52]/20">
                  {inactivePlayers.map((s: any) => (
                    <tr key={s.id} className="hover:bg-[#12234A]/20">
                      <td className="py-2.5 pr-4 text-white font-semibold">{s.name}</td>
                      <td className="py-2.5 pr-4 text-gray-500 font-mono text-[11px]">{s.studentId || '—'}</td>
                      <td className="py-2.5">
                        <span className="text-red-400 font-bold">0</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Full Per-Student Table */}
        <div className="card p-6">
          <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">All Students — This Week</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#1E2E52] text-gray-400 text-[10px] uppercase font-bold">
                  <th className="pb-3 pr-4">#</th>
                  <th className="pb-3 pr-4">Name</th>
                  <th className="pb-3 pr-4 text-center">Games This Week</th>
                  <th className="pb-3 pr-4 text-center">Today</th>
                  <th className="pb-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2E52]/20">
                {studentActivity.map((s: any, idx: number) => (
                  <tr key={s.id} className="hover:bg-[#12234A]/20 transition-colors">
                    <td className="py-2.5 pr-4 text-gray-600 font-mono">{idx + 1}</td>
                    <td className="py-2.5 pr-4 text-white font-semibold">{s.name}</td>
                    <td className="py-2.5 pr-4 text-center">
                      <span className={`font-bold ${s.gamesThisWeek > 0 ? 'text-gold' : 'text-gray-600'}`}>
                        {s.gamesThisWeek}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-center">
                      {s.gamesToday > 0
                        ? <span className="text-green-400 font-bold">{s.gamesToday}</span>
                        : <span className="text-gray-600">—</span>
                      }
                    </td>
                    <td className="py-2.5">
                      {s.gamesToday > 0
                        ? <span className="text-[9px] font-bold bg-green-900/30 text-green-400 px-2 py-0.5 rounded-full">Active Today</span>
                        : s.gamesThisWeek > 0
                          ? <span className="text-[9px] font-bold bg-gold/10 text-gold px-2 py-0.5 rounded-full">Active This Week</span>
                          : <span className="text-[9px] font-bold bg-red-900/20 text-red-400 px-2 py-0.5 rounded-full">Inactive</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
