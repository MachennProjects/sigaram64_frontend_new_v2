// SIGARAM64 — Student Manager (REST API Integrated)
import React, { useState, useEffect } from "react";
import { useOutletContext, Link } from "react-router-dom";
import { studentApi } from "../../../api";
import { useAuth } from "../../../context/AuthContext";
import StudentList, { Student } from "./StudentList";

interface DeletedGame {
  id: string;
  opponentId: string;
  gameType: string;
  aiLevel?: number;
  result: string;
  playerColor: string;
  playedAt: string;
  deletedStudentInfo?: {
    name: string;
    email?: string;
    rollNo?: string;
    orgId: string;
  };
}

export default function StudentManager() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const { district } = useOutletContext<{ district: string }>();

  // Tab state
  const [activeTab, setActiveTab] = useState<'students' | 'deleted_games'>('students');
  const [deletedGames, setDeletedGames] = useState<DeletedGame[]>([]);
  const [loadingGames, setLoadingGames] = useState(false);

  const isSubAdmin = user?.role === "sub_admin";

  const loadStudents = async () => {
    setLoadingData(true);
    try {
      const data = await studentApi.listStudents({
        district: !isSubAdmin && district !== "All Districts" ? district : undefined,
        limit: 1000,
      });
      // Map API response to Student interface
      const mapped = data.map((s: any) => ({
        id: s.id || s._id,
        name: s.name,
        email: s.email,
        gender: s.gender,
        studentClass: s.studentClass,
        rollNo: s.rollNo,
        contact: s.contact,
        school: s.school,
        active: s.active,
        elo: s.elo ?? 1000,
        gamesPlayed: s.gamesPlayed ?? 0
      }));
      setStudents(mapped);
    } catch (err) {
      console.error("Failed to load students list:", err);
    } finally {
      setLoadingData(false);
    }
  };

  const loadDeletedGames = async () => {
    setLoadingGames(true);
    try {
      const data = await studentApi.getDeletedStudentsGames();
      setDeletedGames(data || []);
    } catch (err) {
      console.error("Failed to load deleted student games:", err);
    } finally {
      setLoadingGames(false);
    }
  };

  useEffect(() => {
    loadStudents();
    if (activeTab === 'deleted_games') {
      loadDeletedGames();
    }
  }, [district, activeTab]);

  return (
    <div className="min-h-screen bg-dark-bg font-sans">
      <div className="px-6 py-6 space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">Student Manager</h1>
            <p className="text-gray-400 text-xs mt-1">
              Manage student accounts, view login credentials, or analyze deleted student gameplay archives.
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex border-b border-[#1E2E52] gap-6 text-xs font-bold uppercase tracking-wider">
          <button
            onClick={() => setActiveTab('students')}
            className={`pb-2.5 transition-all relative ${
              activeTab === 'students' ? 'text-gold' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            👥 Active Students ({students.length})
            {activeTab === 'students' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
            )}
          </button>
          <button
            onClick={() => setActiveTab('deleted_games')}
            className={`pb-2.5 transition-all relative ${
              activeTab === 'deleted_games' ? 'text-gold' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            ♟ Deleted Students Games ({deletedGames.length})
            {activeTab === 'deleted_games' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gold" />
            )}
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === 'students' ? (
          <StudentList
            students={students}
            loadingData={loadingData}
            onRefresh={loadStudents}
            showStats={true}
            showAddImportButtons={true}
          />
        ) : (
          <div className="card overflow-hidden overflow-x-auto border-divider">
            <table className="w-full min-w-[800px] text-xs">
              <thead>
                <tr className="border-b border-[#1E2E52] bg-[#12234A] text-gray-400">
                  <th className="text-left font-bold px-4 py-3.5">Deleted Student</th>
                  <th className="text-left font-bold px-4 py-3.5">Roll No</th>
                  <th className="text-left font-bold px-4 py-3.5">Opponent</th>
                  <th className="text-left font-bold px-4 py-3.5">Game Type</th>
                  <th className="text-center font-bold px-4 py-3.5">Color</th>
                  <th className="text-center font-bold px-4 py-3.5">Result</th>
                  <th className="text-left font-bold px-4 py-3.5">Played At</th>
                  <th className="text-right font-bold px-4 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1E2E52]/20">
                {loadingGames ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="border-b border-divider animate-pulse">
                      <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-32" /></td>
                      <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-16" /></td>
                      <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-20" /></td>
                      <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-16" /></td>
                      <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-10 mx-auto" /></td>
                      <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-12 mx-auto" /></td>
                      <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-24" /></td>
                      <td className="px-4 py-3.5"><div className="h-3 bg-navy-mid rounded w-16 ml-auto" /></td>
                    </tr>
                  ))
                ) : deletedGames.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-gray-500 text-xs italic">
                      No game logs found for deleted students.
                    </td>
                  </tr>
                ) : (
                  deletedGames.map((g) => {
                    const info = g.deletedStudentInfo || { name: 'Deleted Student', email: '', rollNo: '' };
                    return (
                      <tr key={g.id} className="hover:bg-[#12234A]/20 transition-colors">
                        <td className="px-4 py-3.5">
                          <div>
                            <span className="text-white text-xs font-bold block">{info.name}</span>
                            <span className="text-gray-500 text-[10px] block">{info.email || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-gray-300 font-mono">
                          {info.rollNo || '—'}
                        </td>
                        <td className="px-4 py-3.5 text-gray-300 capitalize font-medium">
                          {g.opponentId === 'cpu' ? `Computer (Level ${g.aiLevel || 1})` : 'PvP Match'}
                        </td>
                        <td className="px-4 py-3.5 text-gray-400 capitalize">
                          {g.gameType.replace('_', ' ')}
                        </td>
                        <td className="px-4 py-3.5 text-center text-gray-300 capitalize">
                          {g.playerColor}
                        </td>
                        <td className="px-4 py-3.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[9px] ${
                            g.result.includes('win') ? 'bg-green-900/30 text-green-400' : g.result === 'draw' ? 'bg-gray-800 text-gray-400' : 'bg-red-900/30 text-red-400'
                          }`}>
                            {g.result.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-gray-400">
                          {new Date(g.playedAt).toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <Link
                            to={`/analysis/${g.id}`}
                            className="text-[10px] text-gold bg-gold/10 border border-gold/30 px-2.5 py-1 rounded hover:bg-gold hover:text-navy transition-colors font-bold whitespace-nowrap"
                          >
                            📈 Analyze Game
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
