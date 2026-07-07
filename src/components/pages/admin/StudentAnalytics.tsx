import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { studentApi } from '../../../api';
import { GameAnalysisResult, AnalyzedMove, MoveClass, getGameOutcome } from '../../../engine/gameAnalyzer';
import { Chess } from 'chess.js';

export function convertLegacyGameToAnalysis(game: any): GameAnalysisResult {
  if (game && typeof game === 'object' && game.summary && game.summary.white && game.summary.black) {
    return {
      ...game,
      id:   game.id || game._id,
      date: game.playedAt || game.date || new Date().toISOString()
    };
  }

  const AI_LEVEL_MAP: Record<number, string> = {
    1: 'Beginner',
    7: 'Intermediate',
    13: 'Advanced',
    19: 'Master',
  };
  const difficultyLabel = game.aiLevel
    ? (AI_LEVEL_MAP[game.aiLevel] ?? `Level ${game.aiLevel}`)
    : 'Unknown';

  let history: any[] = [];
  const tempChess = new Chess();
  if (game.pgn) {
    try {
      tempChess.loadPgn(game.pgn);
      history = tempChess.history({ verbose: true });
    } catch (e) {
      console.error('Error replaying PGN in convertLegacyGameToAnalysis:', e);
    }
  }

  const replayChess = new Chess();
  const moves: AnalyzedMove[] = [];

  for (let idx = 0; idx < history.length; idx++) {
    const historyMove = history[idx];
    const fenBefore = replayChess.fen();
    replayChess.move(historyMove.san);
    const fenAfter = replayChess.fen();

    const dbMove = game.moves?.[idx] || {};

    const evaluation = dbMove.eval !== undefined 
      ? Math.round(dbMove.eval * 100) 
      : 0;

    const evalBefore = idx > 0 
      ? moves[idx - 1].evaluation 
      : 35;

    moves.push({
      moveIndex: idx,
      san: historyMove.san || dbMove.san || '?',
      color: historyMove.color || (idx % 2 === 0 ? 'w' : 'b'),
      fen: fenAfter,
      fenBefore,
      from: historyMove.from || '',
      to: historyMove.to || '',
      evaluation,
      evalBefore,
      bestMove: dbMove.bestMove || '',
      bestMoveUci: dbMove.bestMoveUci || '',
      bestMoveFrom: dbMove.bestMoveFrom || '',
      bestMoveTo: dbMove.bestMoveTo || '',
      classification: (dbMove.classification || 'good') as MoveClass,
      winPercentBefore: 50,
      winPercentAfter: 50,
      cpLoss: dbMove.cpl || 0,
      comment: dbMove.classification ? dbMove.classification.toUpperCase() : '',
      pieceMoved: historyMove.piece || ''
    });
  }

  const analysisSummary = game.analysis || {};
  const acpl = analysisSummary.wcacpl || game.acpl || 0;
  const accuracy = game.accuracy || 0;

  const playerStats = {
    accuracy,
    brilliant: analysisSummary.brilliantCount || 0,
    great: 0,
    best: analysisSummary.bestCount || 0,
    excellent: 0,
    good: analysisSummary.goodCount || 0,
    inaccuracy: analysisSummary.inaccuracyCount || 0,
    mistake: analysisSummary.mistakeCount || 0,
    miss: 0,
    blunder: analysisSummary.blunderCount || 0,
    book: 0,
    acpl
  };

  const summary = {
    white: playerStats,
    black: { ...playerStats }
  };

  return {
    id:    game.id || game._id,
    moves,
    summary,
    evalHistory: moves.map(m => m.evaluation),
    result: game.result || 'Unknown',
    totalMoves: game.totalMoves || moves.length,
    date: game.playedAt || new Date().toISOString(),
    coachSummary: `This is a past game played on Sigaram64. WC-ACPL: ${acpl}`,
    playerColor: game.playerColor || 'white',
    difficulty: difficultyLabel,
  };
}

const PAGE_SIZE = 20;

export default function StudentAnalytics() {
  const { uid } = useParams();
  const navigate = useNavigate();

  const [student, setStudent]       = useState<any>(null);
  const [progress, setProgress]     = useState<any>(null);
  const [games, setGames]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesPage, setGamesPage]   = useState(1);
  const [gamesTotal, setGamesTotal] = useState(0);
  const [hasMore, setHasMore]       = useState(false);
  const [studentIdStr, setStudentIdStr] = useState<string | null>(null);

  // Settings dropdown and management state
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [showVerifyModal, setShowVerifyModal]   = useState(false);
  const [verifyAction, setVerifyAction]         = useState<'view' | null>(null);
  const [verifyLoading, setVerifyLoading]       = useState(false);
  const [decryptedViewCreds, setDecryptedViewCreds] = useState<any | null>(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState(false);
  const [editModal, setEditModal]               = useState(false);

  // Edit fields
  const [editName, setEditName] = useState("");
  const [editGender, setEditGender] = useState("");
  const [editClass, setEditClass] = useState("");
  const [editRollNo, setEditRollNo] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editContacts, setEditContacts] = useState<string[]>(['']);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [verifyAttempts, setVerifyAttempts] = useState(0);

  const loadDashboard = () => {
    if (!uid) return;
    setLoading(true);
    studentApi.getDashboard(uid)
      .then(res => {
        const user = res.user;
        setStudent(user);
        setProgress(res.progress);
        const sid = user?.studentId || uid;
        setStudentIdStr(sid);

        setGamesLoading(true);
        studentApi.getStudentGames(sid, PAGE_SIZE, 0)
          .then(({ games: g, total, hasMore: hm }) => {
            setGames(g);
            setGamesTotal(total);
            setHasMore(hm);
            setGamesPage(1);
          })
          .catch(err => {
            console.error('Failed to load game history page 1', err);
            setGames(res.recentGames || []);
          })
          .finally(() => setGamesLoading(false));

        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load student dashboard', err);
        setLoading(false);
      });
  };

  useEffect(() => {
    loadDashboard();
  }, [uid]);

  const goToPage = (page: number) => {
    if (!studentIdStr || gamesLoading) return;
    const offset = (page - 1) * PAGE_SIZE;
    setGamesLoading(true);
    studentApi.getStudentGames(studentIdStr, PAGE_SIZE, offset)
      .then(({ games: g, total, hasMore: hm }) => {
        setGames(g);
        setGamesTotal(total);
        setHasMore(hm);
        setGamesPage(page);
      })
      .catch(err => console.error('Failed to load games page', page, err))
      .finally(() => setGamesLoading(false));
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  };

  const openEditModal = () => {
    if (!student) return;
    setEditName(student.name || "");
    setEditGender(student.gender || "");
    setEditClass(student.studentClass || "");
    setEditRollNo(student.rollNo || "");
    setEditEmail(student.email || "");
    setEditContacts(student.contact && student.contact.length > 0 ? [...student.contact] : ['']);
    setEditModal(true);
    setShowSettingsMenu(false);
  };

  const handleSaveEdit = async () => {
    if (!student?.id) return;
    setSaving(true);
    try {
      const updates = {
        name: editName.trim(),
        email: editEmail.trim(),
        gender: editGender || undefined,
        studentClass: editClass || undefined,
        rollNo: editRollNo.trim() || undefined,
        contact: editContacts.filter(Boolean),
      };
      await studentApi.updateStudent(student.id, updates);
      showToast("✅ Profile updated successfully");
      setEditModal(false);
      loadDashboard();
    } catch (err: any) {
      showToast(err.message || "❌ Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!student?.id) return;
    try {
      await studentApi.deleteStudentPermanent(student.id);
      showToast(`🗑️ Permanently deleted student account`);
      setConfirmDeleteModal(false);
      navigate('/students');
    } catch (err: any) {
      showToast(err.message || "❌ Failed to delete student");
    }
  };

  async function handleVerifySubmit(adminPassword: string) {
    if (!student?.id) return;
    setVerifyLoading(true);
    setVerifyError("");
    try {
      const res = await studentApi.decryptCredentials(adminPassword, [student.id]);
      setShowVerifyModal(false);
      setVerifyAttempts(0);
      if (res && res.length > 0) {
        setDecryptedViewCreds(res[0]);
      } else {
        showToast("❌ Credentials not found");
      }
    } catch (err: any) {
      const nextCount = verifyAttempts + 1;
      setVerifyAttempts(nextCount);
      if (nextCount >= 3) {
        localStorage.removeItem('sigaram64_token');
        window.location.href = '/login';
      } else {
        setVerifyError(`❌ Incorrect password. ${3 - nextCount} attempt(s) remaining before secure logout.`);
      }
    } finally {
      setVerifyLoading(false);
    }
  }

  const totalPages = Math.max(1, Math.ceil(gamesTotal / PAGE_SIZE));

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg p-8 flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    );
  }

  if (!student) {
    return (
      <div className="min-h-screen bg-dark-bg p-8 flex flex-col items-center justify-center">
        <div className="text-red-400 font-bold mb-4">Student not found</div>
        <Link to="/students" className="btn-outline-gold px-4 py-2 text-sm">Back to Students</Link>
      </div>
    );
  }

  const stats = progress?.stats || {};
  const gamesPlayed = stats.gamesPlayed || gamesTotal || games.length || 0;
  const gamesWon = stats.gamesWon || games.filter(g => {
    const outcome = getGameOutcome(g.result || '', g.playerColor || 'white');
    return outcome === 'win';
  }).length;
  const gamesLost = stats.gamesLost || (gamesPlayed - gamesWon);
  const winRate = gamesPlayed ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
  const lastActiveDate = progress?.updatedAt 
    ? new Date(progress.updatedAt).toLocaleDateString()
    : 'Unknown';

  const isPhoneInvalid = editContacts.some(c => c.length > 0 && (c.replace(/\D/g, '').length !== 10 || /\D/.test(c)));
  const isEmailInvalid = editEmail.length > 0 && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editEmail);
  const isRollNoInvalid = editRollNo.length > 0 && !/^[a-zA-Z0-9-]+$/.test(editRollNo);

  const inputCls = "w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-3 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gold";
  const labelCls = "block text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1";

  return (
    <div className="min-h-screen bg-dark-bg font-sans p-6 lg:p-10 text-xs">
      {/* Toast notification */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 bg-[#12234A] border border-gold/40 rounded-xl px-4 py-3 text-sm text-white shadow-xl animate-fadeIn">
          {toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/students" className="w-8 h-8 rounded-full bg-navy-mid flex items-center justify-center text-gray-400 hover:text-white hover:bg-navy transition-colors font-bold flex-shrink-0">
            ←
          </Link>
          <div className="flex-1">
            <h1 className="text-xl font-bold text-white flex items-center gap-3">
              {student.name || 'Unknown'}
              <span className={`text-[9px] uppercase font-bold px-2 py-0.5 rounded-full ${student.active ? 'bg-green-900/40 text-green-400' : 'bg-red-900/40 text-red-400'}`}>
                {student.active ? 'Active' : 'Inactive'}
              </span>
            </h1>
            <p className="text-gray-400 text-xs mt-0.5">{student.school?.name || 'No School'} · {student.school?.district || 'No District'}</p>
          </div>

          {/* Settings cog dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowSettingsMenu(prev => !prev)}
              className="px-4 py-2 bg-navy-mid border border-[#1E2E52] hover:border-gold/30 hover:text-gold text-gray-300 rounded-xl font-semibold transition-all flex items-center gap-1.5"
              title="Manage student details"
            >
              ⚙️ Settings
            </button>
            {showSettingsMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowSettingsMenu(false)} />
                <div className="absolute right-0 mt-2 w-48 bg-[#0D1B33] border border-[#1E2E52] rounded-xl shadow-2xl p-1.5 z-20 flex flex-col gap-0.5 animate-slideUp">
                  <button
                    onClick={() => {
                      setVerifyAction('view');
                      setShowVerifyModal(true);
                      setShowSettingsMenu(false);
                    }}
                    className="px-3.5 py-2 text-left text-xs font-bold text-cyan-400 hover:bg-cyan-500/10 hover:text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    🔑 View Credentials
                  </button>
                  <button
                    onClick={openEditModal}
                    className="px-3.5 py-2 text-left text-xs font-bold text-gold hover:bg-gold/10 hover:text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    ✏️ Edit Profile
                  </button>
                  <button
                    onClick={() => {
                      setConfirmDeleteModal(true);
                      setShowSettingsMenu(false);
                    }}
                    className="px-3.5 py-2 text-left text-xs font-bold text-red-400 hover:bg-red-500/10 hover:text-white rounded-lg transition-colors flex items-center gap-2"
                  >
                    🗑️ Delete Student
                  </button>
                </div>
              </>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            <div className="text-gold text-2xl font-black">{progress?.currentElo ?? 1000}</div>
            <div className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Current Elo</div>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="card p-5">
            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Games Played</div>
            <div className="text-xl font-bold text-white">{gamesPlayed}</div>
          </div>
          <div className="card p-5">
            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Win Rate</div>
            <div className="text-xl font-bold text-green-400">{winRate}%</div>
          </div>
          <div className="card p-5">
            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">AI Level Reached</div>
            <div className="text-xl font-bold text-gold">{progress?.aiLevel || 1}</div>
          </div>
          <div className="card p-5">
            <div className="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-1">Last Active</div>
            <div className="text-sm font-bold text-white mt-1">
              {lastActiveDate}
            </div>
          </div>
        </div>

        {/* Detailed Analytics Grid */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Game Record */}
          <div className="card p-6">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Game Record</h3>
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-green-400">Won ({gamesWon})</span>
                  <span className="text-red-400">Lost ({gamesLost})</span>
                </div>
                <div className="h-3 rounded-full bg-red-900/40 overflow-hidden flex">
                  <div className="bg-green-500 h-full" style={{ width: `${winRate}%` }} />
                  <div className="bg-gray-500 h-full" style={{ width: `${gamesPlayed ? ((stats.gamesDrawn || 0) / gamesPlayed) * 100 : 0}%` }} />
                </div>
                <div className="text-center text-[10px] text-gray-500 mt-2">{stats.gamesDrawn || 0} Draws</div>
              </div>
            </div>
          </div>

          {/* Module Progress */}
          <div className="card p-6">
            <h3 className="text-white font-bold text-sm uppercase tracking-wider mb-4">Module Progress</h3>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300">Initial Quiz (Rules Gate)</span>
                  <span className={student.quizCompleted ? "text-green-400 font-bold" : "text-yellow-400 font-bold"}>
                    {student.quizCompleted ? "Completed" : "Pending"}
                  </span>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300">CAT Adaptive Assessment</span>
                  <span className={student.assessmentCompleted ? "text-green-400 font-bold" : "text-yellow-400 font-bold"}>
                    {student.assessmentCompleted ? "Completed" : "Pending"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Game History List */}
        <div className="card p-6">
          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-3">
              <h3 className="text-white font-bold text-sm uppercase tracking-wider">Game History</h3>
              <span className="text-[10px] font-bold text-gold bg-gold/10 border border-gold/20 px-2 py-0.5 rounded-full">
                {gamesTotal > 0 ? `${gamesTotal} total` : `${games.length} games`}
              </span>
              {gamesLoading && (
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <span className="inline-block w-3 h-3 border-2 border-gold/40 border-t-gold rounded-full animate-spin" />
                  Loading…
                </span>
              )}
            </div>
            {gamesTotal > PAGE_SIZE && (
              <span className="text-[10px] text-gray-500">
                Page {gamesPage} of {totalPages} · {gamesTotal} total
              </span>
            )}
          </div>

          {games.length === 0 ? (
            <div className="h-32 flex items-center justify-center border border-dashed border-[#1E2E52] rounded-xl select-none">
              <span className="text-gray-500">
                {gamesLoading ? 'Loading games…' : 'No games recorded yet.'}
              </span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1E2E52] text-gray-400 text-[10px] uppercase font-bold">
                      <th className="pb-3 pr-4">#</th>
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Opponent</th>
                      <th className="pb-3 pr-4">Result</th>
                      <th className="pb-3 pr-4 text-center">Moves</th>
                      <th className="pb-3 pr-4 text-center">Accuracy</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2E52]/20">
                    {games.map((game, idx) => {
                      const globalIdx = (gamesPage - 1) * PAGE_SIZE + idx + 1;
                      const dateStr = game.playedAt
                        ? new Date(game.playedAt).toLocaleDateString()
                        : 'Unknown Date';

                      const outcome = getGameOutcome(game.result || '', game.playerColor || 'white');
                      const isWin = outcome === 'win';
                      const isLoss = outcome === 'loss';

                      const analysis = convertLegacyGameToAnalysis(game);

                      return (
                        <tr key={game.id || game._id} className="hover:bg-[#12234A]/10">
                          <td className="py-3 pr-4 text-gray-500">{globalIdx}</td>
                          <td className="py-3 pr-4 text-gray-300">{dateStr}</td>
                          <td className="py-3 pr-4 text-white font-medium capitalize">
                            {game.opponentId === 'cpu' ? `Computer (Level ${game.aiLevel || 1})` : 'PvP Match'}
                          </td>
                          <td className="py-3 pr-4">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              isWin ? 'bg-green-900/30 text-green-400' : isLoss ? 'bg-red-900/30 text-red-400' : 'bg-gray-800 text-gray-400'
                            }`}>
                              {game.result?.replace('_', ' ') || 'Unknown'}
                            </span>
                          </td>
                          <td className="py-3 pr-4 text-center text-gray-300">{analysis.moves.length}</td>
                          <td className="py-3 pr-4 text-center">
                            <span className="text-white font-semibold">
                              {game.accuracy !== undefined ? `${Math.round(game.accuracy)}%` : '—'}
                            </span>
                          </td>
                          <td className="py-3 text-right">
                            <Link
                              to={`/analysis/${game.id || game._id}`}
                              className="text-[10px] text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded hover:bg-gold hover:text-navy transition-colors font-bold whitespace-nowrap"
                            >
                              Analyze
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 text-gray-400 select-none">
                  <span>Page {gamesPage} of {totalPages}</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => goToPage(gamesPage - 1)}
                      disabled={gamesPage === 1 || gamesLoading}
                      className="px-3.5 py-1.5 bg-navy-mid border border-[#1E2E52] rounded-xl hover:border-gold/30 disabled:opacity-40 disabled:hover:border-[#1E2E52] font-semibold transition-all"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => goToPage(gamesPage + 1)}
                      disabled={gamesPage === totalPages || gamesLoading}
                      className="px-3.5 py-1.5 bg-navy-mid border border-[#1E2E52] rounded-xl hover:border-gold/30 disabled:opacity-40 disabled:hover:border-[#1E2E52] font-semibold transition-all"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs px-4">
          <div className="w-full max-w-md bg-[#0B1628] border border-[#1E2E52] rounded-2xl p-6 shadow-2xl space-y-4 animate-slideUp">
            <h3 className="text-white font-bold text-base">Edit Student Profile</h3>
            <div className="space-y-3">
              <div className="space-y-1">
                <label className={labelCls}>Student Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className={inputCls}
                />
              </div>

              <div className="space-y-1">
                <label className={labelCls}>Student Email</label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={e => setEditEmail(e.target.value)}
                  className={`${inputCls} ${isEmailInvalid ? 'border-red-500/60' : ''}`}
                />
                {isEmailInvalid && (
                  <p className="text-red-400 text-[10px] mt-0.5 font-semibold">⚠️ Invalid email address format</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className={labelCls}>Gender</label>
                  <select
                    value={editGender}
                    onChange={e => setEditGender(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className={labelCls}>Class</label>
                  <select
                    value={editClass}
                    onChange={e => setEditClass(e.target.value)}
                    className={inputCls}
                  >
                    <option value="">Select…</option>
                    {['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'].map(c => (
                      <option key={c} value={c}>Class {c}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className={labelCls}>Roll No</label>
                <input
                  type="text"
                  value={editRollNo}
                  onChange={e => setEditRollNo(e.target.value)}
                  className={`${inputCls} ${isRollNoInvalid ? 'border-red-500/60' : ''}`}
                />
                {isRollNoInvalid && (
                  <p className="text-red-400 text-[10px] mt-0.5 font-semibold">⚠️ Only alphanumeric characters and hyphens (-) allowed</p>
                )}
              </div>

              <div className="space-y-1">
                <label className={labelCls}>Contacts</label>
                {editContacts.map((c, idx) => (
                  <div key={idx} className="space-y-1">
                    <div className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={c}
                        onChange={e => setEditContacts(prev => prev.map((val, i) => i === idx ? e.target.value : val))}
                        className={`${inputCls} flex-1 ${c.length > 0 && (c.replace(/\D/g, '').length !== 10 || /\D/.test(c)) ? 'border-red-500/60' : ''}`}
                        placeholder={`Phone ${idx + 1}`}
                      />
                      {editContacts.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setEditContacts(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-500 hover:text-red-400 text-xs px-1"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                    {c.length > 0 && (c.replace(/\D/g, '').length !== 10 || /\D/.test(c)) && (
                      <p className="text-red-400 text-[10px] mt-0.5 font-semibold">⚠️ Must be exactly 10 digits</p>
                    )}
                  </div>
                ))}
                {editContacts.length < 2 && (
                  <button
                    type="button"
                    onClick={() => setEditContacts(prev => [...prev, ''])}
                    className="text-[10px] text-gold hover:underline font-bold mt-1 block"
                  >
                    + Add Phone Number
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setEditModal(false)}
                className="flex-1 py-2.5 bg-[#32312F] text-gray-300 font-bold rounded-xl text-xs hover:bg-[#403F3C]"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={saving || isPhoneInvalid || isEmailInvalid || isRollNoInvalid}
                className="flex-1 py-2.5 btn-gold font-bold rounded-xl text-xs disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Severe Permanent Deletion Modal */}
      {confirmDeleteModal && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm px-4">
          <div className="w-full max-w-md bg-[#0B1628] border border-red-500/40 rounded-2xl p-6 shadow-2xl space-y-4 animate-slideUp select-none">
            <div className="text-center">
              <div className="w-14 h-14 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
                <span className="text-red-500 text-3xl font-bold">⚠️</span>
              </div>
              <h3 className="text-red-400 font-bold text-lg">⚠️ Severe Permanent Deletion</h3>
              <div className="text-left bg-red-950/10 border border-red-900/30 rounded-xl p-4 mt-3 text-xs text-red-200 leading-relaxed space-y-2">
                <p>You are about to permanently delete student <strong className="font-bold text-white font-mono">"{student?.name}"</strong>.</p>
                <p className="font-semibold text-red-300">This action will permanently purge:</p>
                <ul className="list-disc pl-5 space-y-1 font-mono text-[10px]">
                  <li>Their login account & profile details</li>
                  <li>Learning dashboard progress, peaks, & ELO ratings</li>
                  <li>XP, levels, and earned milestones / badges</li>
                </ul>
                <p className="text-[10px] text-gray-500 font-medium border-t border-red-900/20 pt-2 mt-2">
                  * Note: Their chess games history is preserved securely under admin logs for performance analytics.
                </p>
              </div>
              <p className="text-white text-xs font-bold mt-4">THIS ACTION CANNOT BE UNDONE. Confirm to delete.</p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setConfirmDeleteModal(false)}
                className="flex-1 py-2.5 bg-[#32312F] text-gray-300 font-bold rounded-xl text-xs hover:bg-[#403F3C] transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl text-xs transition-colors shadow-lg"
              >
                Delete Permanently
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Admin Password Verification Modal */}
      {showVerifyModal && createPortal(
        <AdminPasswordVerifyModal
          loading={verifyLoading}
          error={verifyError}
          onClose={() => {
            setShowVerifyModal(false);
            setVerifyAction(null);
            setVerifyError("");
            setVerifyAttempts(0);
          }}
          onSubmit={handleVerifySubmit}
        />,
        document.body
      )}

      {/* Decrypted Credentials View Modal */}
      {decryptedViewCreds && createPortal(
        <DecryptedCredentialsViewModal
          credentials={decryptedViewCreds}
          onClose={() => setDecryptedViewCreds(null)}
        />,
        document.body
      )}
    </div>
  );
}

// ─── Inner Secure Verification Modal ───
interface VerifyModalProps {
  onClose: () => void;
  onSubmit: (password: string) => void;
  loading: boolean;
  error?: string;
}
function AdminPasswordVerifyModal({ onClose, onSubmit, loading, error }: VerifyModalProps) {
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-xs px-4" onClick={onClose}>
      <div 
        className="w-full max-w-sm bg-[#0D1B33] border border-[#1E2E52] rounded-2xl p-6 shadow-2xl animate-slideUp space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center space-y-1">
          <span className="text-2xl">🔐</span>
          <h4 className="text-white font-bold text-sm">Security Verification</h4>
          <p className="text-gray-500 text-[10px]">Please enter your admin login password to authorize this action.</p>
        </div>
        {error && (
          <div className="bg-red-950/20 border border-red-800/30 text-red-400 p-2.5 rounded-xl text-[10px] font-semibold text-center animate-fadeIn">
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={showPass ? "text" : "password"}
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your admin password"
              className="w-full bg-[#12234A] border border-[#1E2E52] rounded-xl px-3 py-2.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-gold pr-10"
              autoFocus
            />
            <button type="button" onClick={() => setShowPass(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-xs">
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-[#32312F] text-gray-300 font-bold rounded-xl text-xs hover:bg-[#403F3C]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="flex-1 py-2 btn-gold font-bold rounded-xl text-xs disabled:opacity-50"
            >
              {loading ? "Verifying…" : "Verify"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Inner Decrypted Credentials View Modal ───
interface ViewCredsModalProps {
  onClose: () => void;
  credentials: { name: string; email: string; rollNo: string; password: string };
}
function DecryptedCredentialsViewModal({ onClose, credentials }: ViewCredsModalProps) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-xs px-4" onClick={onClose}>
      <div 
        className="w-full max-w-sm bg-[#0D1B33] border border-green-800/40 rounded-2xl p-6 shadow-2xl animate-slideUp space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="text-center space-y-1">
          <span className="text-2xl">🔑</span>
          <h4 className="text-white font-bold text-sm">Decrypted Credentials</h4>
          <p className="text-gray-500 text-[10px] font-mono">Active Student: {credentials.name}</p>
        </div>
        <div className="bg-[#0B1628] border border-green-800/20 rounded-xl p-4 space-y-2 select-text text-xs leading-relaxed">
          <p className="flex justify-between items-center"><span className="text-gray-500 font-semibold">Roll No:</span> <span className="text-white font-bold select-all">{credentials.rollNo}</span></p>
          <p className="flex justify-between items-center"><span className="text-gray-500 font-semibold">Email:</span> <span className="text-blue-300 font-mono font-bold select-all">{credentials.email}</span></p>
          <p className="flex justify-between items-center"><span className="text-gray-500 font-semibold">Password:</span> <span className="text-green-300 font-mono font-bold select-all">{credentials.password}</span></p>
        </div>
        <div className="bg-yellow-900/10 border border-yellow-700/20 text-yellow-400 rounded-xl p-3 text-[10px] leading-relaxed">
          ⚠️ Treat this information as highly confidential. Close the popup to clear active decryption caches.
        </div>
        <button
          onClick={onClose}
          className="w-full btn-gold py-2.5 font-bold rounded-xl text-xs"
        >
          Done
        </button>
      </div>
    </div>
  );
}
