// SIGARAM64 — Admin Dashboard (REST API Integrated)
import React, { useState, useEffect } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Crown, Badge } from "../../ui";
import { adminApi, studentApi } from "../../../api";
import { useAuth } from "../../../context/AuthContext";

type Tab = "overview" | "schools" | "activity";

interface Metric {
  label: string;
  value: string | number;
  icon: string;
  color: string;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("overview");
  
  // Dashboard states
  const [metrics, setMetrics] = useState<any>(null);
  const [schools, setSchools] = useState<any[]>([]);
  const [activityFeed, setActivityFeed] = useState<any[]>([]);
  const [ratingDistribution, setRatingDistribution] = useState<any[]>([]);
  const [inactiveStudents, setInactiveStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const { district } = useOutletContext<{ district: string }>();
  const isSubAdmin = user?.role === "sub_admin";

  // Load Dashboard Data
  useEffect(() => {
    async function loadDashboard() {
      setLoading(true);
      try {
        const [mRes, sRes, aRes, dRes] = await Promise.all([
          adminApi.getMetrics(),
          adminApi.getSchools(district !== "All Districts" ? district : undefined),
          adminApi.getActivityFeed(district !== "All Districts" ? district : undefined),
          adminApi.getRatingDistribution()
        ]);

        setMetrics(mRes);
        setSchools(sRes);
        setActivityFeed(aRes);
        setRatingDistribution(dRes);

        // Scoped fetch for inactive students if campus sub_admin
        if (isSubAdmin) {
          const bRes = await adminApi.getBootcampActivity();
          const inactive = (bRes?.studentActivity || []).filter((s: any) => s.gamesThisWeek === 0);
          setInactiveStudents(inactive);
        }
      } catch (err) {
        console.error("Failed to load admin metrics:", err);
      } finally {
        setLoading(false);
      }
    }
    loadDashboard();
  }, [district, isSubAdmin]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-dark-bg">
        <div className="text-gold font-bold">Loading Dashboard...</div>
      </div>
    );
  }

  const METRICS: Metric[] = [
    { label: "Total Students", value: metrics?.totalStudents ?? 0, icon: "👥", color: "text-gold" },
    { label: "Active Students", value: metrics?.activeStudents ?? 0, icon: "📈", color: "text-green-400" },
    { label: "Avg Rating (Elo)", value: metrics?.avgEloRating ?? 1000, icon: "♟", color: "text-white" },
    { 
      label: isSubAdmin ? "Total Bootcamp Sessions" : "Total Managed Schools", 
      value: isSubAdmin ? (metrics?.totalSessions ?? 0) : (metrics?.totalSchools ?? 0), 
      icon: isSubAdmin ? "🎮" : "🏫", 
      color: "text-gold-light" 
    },
  ];

  const maxBucketCount = Math.max(...(ratingDistribution || []).map(b => b.count), 1);

  return (
    <div className="min-h-screen bg-dark-bg font-sans">
      <div className="px-6 lg:px-16 py-8">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-black text-white">
              {isSubAdmin ? `🏫 Campus Dashboard` : `📊 District Dashboard`}
            </h1>
            <p className="text-gray-400 text-xs mt-1">
              {isSubAdmin 
                ? `${user?.managedSchoolName || 'My Managed School'} · ${metrics?.totalStudents ?? 0} students`
                : `${district} · ${metrics?.totalStudents ?? 0} total students`
              }
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => navigate(isSubAdmin ? "/campus/students" : "/students")}
              className="px-4 py-2 bg-[#C9A84C] text-[#101c3e] text-xs font-bold rounded-xl shadow hover:brightness-110 transition-all"
            >
              👥 Manage Students
            </button>
          </div>
        </div>

        {/* Sub Admin Quick Actions */}
        {isSubAdmin && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
            {[
              { icon: '📍', label: 'Bootcamp Activity', sub: 'See who played this week', path: '/bootcamp',     color: 'border-blue-500/20 hover:border-blue-500/40' },
              { icon: '🏆', label: 'Leaderboard',       sub: 'Top students by ELO',      path: '/leaderboard',  color: 'border-gold/20 hover:border-gold/40' },
              // { icon: '📄', label: 'Reports',           sub: 'Student & renewal reports', path: '/renewal-report', color: 'border-green-500/20 hover:border-green-500/40' },
            ].map(qa => (
              <button
                key={qa.path}
                onClick={() => navigate(qa.path)}
                className={`card border ${qa.color} text-left p-4 transition-all hover:bg-[#12234A]/40 active:scale-[0.98]`}
              >
                <div className="text-2xl mb-2">{qa.icon}</div>
                <div className="text-white font-bold text-xs">{qa.label}</div>
                <div className="text-gray-500 text-[10px] mt-0.5">{qa.sub}</div>
              </button>
            ))}
          </div>
        )}

        {/* Tab switcher */}
        <div className="flex border-b border-[#1E2E52]/40 mb-6 gap-6">
          <button
            onClick={() => setTab("overview")}
            className={`pb-3 text-xs font-bold transition-all relative ${
              tab === "overview" ? "text-gold" : "text-gray-400 hover:text-white"
            }`}
          >
            Overview
            {tab === "overview" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gold" />}
          </button>
          {!isSubAdmin && (
            <button
              onClick={() => setTab("schools")}
              className={`pb-3 text-xs font-bold transition-all relative ${
                tab === "schools" ? "text-gold" : "text-gray-400 hover:text-white"
              }`}
            >
              Schools List
              {tab === "schools" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gold" />}
            </button>
          )}
          <button
            onClick={() => setTab("activity")}
            className={`pb-3 text-xs font-bold transition-all relative ${
              tab === "activity" ? "text-gold" : "text-gray-400 hover:text-white"
            }`}
          >
            Live Activity
            {tab === "activity" && <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gold" />}
          </button>
        </div>

        {/* Overview Tab */}
        {tab === "overview" && (
          <div className="space-y-6">
            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {METRICS.map((m, idx) => (
                <div key={idx} className="card p-5 flex items-center justify-between border-divider relative overflow-hidden group">
                  <div className="space-y-1">
                    <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">{m.label}</span>
                    <h3 className="text-2xl font-black text-white">{m.value}</h3>
                  </div>
                  <span className={`text-3xl ${m.color} select-none opacity-80 group-hover:scale-110 transition-transform`}>{m.icon}</span>
                </div>
              ))}
            </div>

            {/* Inactive Students Alert Card */}
            {isSubAdmin && inactiveStudents.length > 0 && (
              <div className="card p-6 border-red-500/20 bg-red-900/5">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-xl">⚠️</span>
                  <div>
                    <h3 className="text-white text-sm font-bold uppercase tracking-wider">Inactive Students Alert</h3>
                    <p className="text-gray-500 text-[10px] mt-0.5">Students who haven't played any games in the last 7 days</p>
                  </div>
                  <span className="ml-auto text-[10px] font-bold text-red-400 bg-red-900/30 border border-red-500/20 px-2.5 py-1 rounded-full">
                    {inactiveStudents.length} Students
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {inactiveStudents.slice(0, 8).map(s => (
                    <div key={s.id} className="bg-[#12234A] border border-red-500/10 rounded-xl p-3 flex items-center justify-between">
                      <div className="min-w-0">
                        <p className="text-white text-xs font-semibold truncate">{s.name}</p>
                        <p className="text-gray-500 text-[9px] font-mono mt-0.5">{s.studentId || 'No ID'}</p>
                      </div>
                      <button
                        onClick={() => navigate(`/students/${s.id}`)}
                        className="text-[10px] text-gold border border-gold/20 hover:border-gold/50 px-2 py-0.5 rounded transition-all ml-2"
                      >
                        View
                      </button>
                    </div>
                  ))}
                </div>
                {inactiveStudents.length > 8 && (
                  <p className="text-gray-500 text-[10px] mt-3 text-right">
                    and {inactiveStudents.length - 8} more students. Go to <button onClick={() => navigate('/bootcamp')} className="text-gold font-bold hover:underline">Bootcamp Activity</button> to view all.
                  </p>
                )}
              </div>
            )}

            {/* Rating Distribution Chart */}
            <div className="card p-6 border-divider">
              <h3 className="text-white text-sm font-bold uppercase tracking-wider mb-4">Rating Distribution</h3>
              <div className="space-y-3.5">
                {(ratingDistribution || []).map(b => {
                  const pct = Math.round((b.count / maxBucketCount) * 100);
                  return (
                    <div key={b.label} className="flex items-center gap-4 text-xs">
                      <span className="text-gray-400 font-semibold w-16 text-right select-none">{b.label}</span>
                      <div className="flex-1 h-3 bg-navy rounded-full overflow-hidden border border-[#1E2E52]/40 relative">
                        <div
                          className="h-full bg-gradient-to-r from-gold/70 to-gold rounded-full transition-all duration-1000"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-white font-bold w-10">{b.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Schools List Tab (For Super Admin only) */}
        {tab === "schools" && !isSubAdmin && (
          <div className="card overflow-hidden border-divider">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#12234A] text-gold uppercase tracking-wider font-bold border-b border-[#1E2E52]">
                    <th className="p-4">School Name</th>
                    <th className="p-4">District</th>
                    <th className="p-4 text-center">Students</th>
                    <th className="p-4 text-center">Avg ELO</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E2E52]/30 text-gray-300">
                  {schools.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center italic text-gray-500">No schools found.</td>
                    </tr>
                  ) : (
                    schools.map((row, idx) => (
                      <tr key={idx} className="hover:bg-[#12234A]/25 transition-colors">
                        <td className="p-4 font-bold text-white">{row.name}</td>
                        <td className="p-4">{row.district}</td>
                        <td className="p-4 text-center font-semibold">{row.totalStudents ?? 0}</td>
                        <td className="p-4 text-center font-bold text-gold">{row.avgElo ?? 1000}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Live Activity Feed */}
        {tab === "activity" && (
          <div className="card border-divider p-6 space-y-4">
            <h3 className="text-white text-sm font-bold uppercase tracking-wider border-b border-[#1E2E52]/40 pb-2">Recent Activities</h3>
            <div className="space-y-4">
              {activityFeed.length === 0 ? (
                <p className="text-center italic text-gray-500 text-xs py-8 select-none">No recent activity logged.</p>
              ) : (
                activityFeed.map((log) => (
                  <div key={log.id} className="flex gap-3 text-xs leading-relaxed items-start border-l-2 border-gold/40 pl-3">
                    <div className="flex-1">
                      <p className="text-gray-300">
                        <span className="text-white font-bold">{log.studentName || 'Student'}</span> {log.description}
                      </p>
                      <span className="text-gray-500 text-[10px]">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
