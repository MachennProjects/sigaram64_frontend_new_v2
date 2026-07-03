import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { studentApi } from '../../../api';
import { GameAnalysisResult, AnalyzedMove, MoveClass, getGameOutcome } from '../../../engine/gameAnalyzer';

import { Chess } from 'chess.js';

/**
 * Converts a legacy game document into the structured GameAnalysisResult
 * expected by the new GameAnalysis.tsx component.
 */
export function convertLegacyGameToAnalysis(game: any): GameAnalysisResult {
  // If it's already a fully normalized frontend result, just return it
  if (game && typeof game === 'object' && game.summary && game.summary.white && game.summary.black) {
    return {
      ...game,
      id:   game.id || game._id,
      date: game.playedAt || game.date || new Date().toISOString()
    };
  }

  // 1. Map Stockfish skill level → human-readable difficulty label
  const AI_LEVEL_MAP: Record<number, string> = {
    1: 'Beginner',
    7: 'Intermediate',
    13: 'Advanced',
    19: 'Master',
  };
  const difficultyLabel = game.aiLevel
    ? (AI_LEVEL_MAP[game.aiLevel] ?? `Level ${game.aiLevel}`)
    : 'Unknown';

  // 2. Replay PGN using chess.js to reconstruct FENs, coordinates, and details
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

    // Backend eval is in pawns (e.g. 0.2), frontend expects centipawns (e.g. 20)
    const evaluation = dbMove.eval !== undefined 
      ? Math.round(dbMove.eval * 100) 
      : 0;

    const evalBefore = idx > 0 
      ? moves[idx - 1].evaluation 
      : 35; // standard starting evaluation

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

  // 3. Map backend GameAnalysis summary to frontend structure
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
  const [student, setStudent]       = useState<any>(null);
  const [progress, setProgress]     = useState<any>(null);
  const [games, setGames]           = useState<any[]>([]);
  const [loading, setLoading]       = useState(true);
  const [gamesLoading, setGamesLoading] = useState(false);
  const [gamesPage, setGamesPage]   = useState(1);
  const [gamesTotal, setGamesTotal] = useState(0);
  const [hasMore, setHasMore]       = useState(false);
  // Stored once after dashboard loads — the "TN9999" style student ID
  const [studentIdStr, setStudentIdStr] = useState<string | null>(null);

  // ── Initial load: profile + progress + first page of games ────────────────
  useEffect(() => {
    if (!uid) return;
    setLoading(true);

    studentApi.getDashboard(uid)
      .then(res => {
        const user = res.user;
        setStudent(user);
        setProgress(res.progress);

        // Save the student ID string for subsequent paginated fetches
        const sid = user?.studentId || uid;
        setStudentIdStr(sid);

        // Fetch first page of games
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
            // Fallback to dashboard's recentGames
            setGames(res.recentGames || []);
          })
          .finally(() => setGamesLoading(false));

        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load student dashboard', err);
        setLoading(false);
      });
  }, [uid]);

  // ── Page change: fetch the new page on demand ──────────────────────────────
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

  const totalPages = Math.max(1, Math.ceil(gamesTotal / PAGE_SIZE));

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg p-8 flex items-center justify-center">
        <div className="text-gold font-bold">Loading Analytics...</div>
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
  // Fallback to loaded gamesTotal or games.length if stats.gamesPlayed is 0
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

  return (
    <div className="min-h-screen bg-dark-bg font-sans p-6 lg:p-10 text-xs">
      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/students" className="w-8 h-8 rounded-full bg-navy-mid flex items-center justify-center text-gray-400 hover:text-white hover:bg-navy transition-colors font-bold">
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
          <div className="text-right">
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

          {/* Game History List */}
          <div className="card p-6 lg:col-span-2">
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
                        // Global row number across all pages
                        const globalIdx = (gamesPage - 1) * PAGE_SIZE + idx + 1;
                        const dateStr = game.playedAt
                          ? new Date(game.playedAt).toLocaleDateString()
                          : 'Unknown Date';

                        const outcome = getGameOutcome(game.result || '', game.playerColor || 'white');
                        const isWin = outcome === 'win';
                        const isLoss = outcome === 'loss';

                        const AI_LEVEL_MAP: Record<number, string> = {
                          1: 'Beginner', 7: 'Intermediate', 13: 'Advanced', 19: 'Master',
                        };
                        const opponentLabel = game.gameType === 'vs_computer'
                          ? `Sigaram AI (${AI_LEVEL_MAP[game.aiLevel] ?? `Lv ${game.aiLevel}`})`
                          : (game.opponentId || 'Opponent');

                        return (
                          <tr key={game.id || game._id} className="hover:bg-[#12234A]/20 transition-colors">
                            <td className="py-3 pr-4 text-gray-600 font-mono">{globalIdx}</td>
                            <td className="py-3 pr-4 text-gray-300">{dateStr}</td>
                            <td className="py-3 pr-4 text-gray-400 truncate max-w-[140px]">{opponentLabel}</td>
                            <td className="py-3 pr-4 font-bold">
                              <span className={isWin ? 'text-green-400' : isLoss ? 'text-red-400' : 'text-gray-300'}>
                                {isWin ? 'Win' : isLoss ? 'Loss' : 'Draw'}
                              </span>
                            </td>
                            <td className="py-3 pr-4 text-center text-gray-400">
                              {(() => {
                                let ply = game.totalMoves || 0;
                                if (!ply && game.moves?.length) ply = game.moves.length;
                                if (!ply && game.pgn) {
                                  try {
                                    const temp = new Chess();
                                    temp.loadPgn(game.pgn);
                                    ply = temp.history().length;
                                  } catch {}
                                }
                                return ply ? Math.ceil(ply / 2) : '—';
                              })()}
                            </td>
                            <td className="py-3 pr-4 text-center font-mono">
                              {(() => {
                                const acc = game.accuracy ?? 
                                  (game.analysis?.wcacpl !== undefined 
                                    ? Math.max(0, Math.min(100, Math.round(100 * Math.exp(-0.008 * game.analysis.wcacpl)))) 
                                    : undefined);
                                return acc !== undefined ? (
                                  <span className="text-gold">{Math.round(acc)}%</span>
                                ) : '—';
                              })()}
                            </td>
                            <td className="py-3 text-right">
                              <Link
                                to={`/students/${uid}/games/${game.id || game._id}`}
                                state={{ analysisResult: convertLegacyGameToAnalysis(game) }}
                                className="text-[10px] text-gold border border-gold/30 hover:bg-gold hover:text-navy px-3 py-1 rounded transition-colors font-bold"
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

                {/* Server-side pagination controls */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4 select-none">
                    <span className="text-[10px] text-gray-500">
                      Showing {(gamesPage - 1) * PAGE_SIZE + 1}–{Math.min(gamesPage * PAGE_SIZE, gamesTotal)} of {gamesTotal}
                    </span>
                    <div className="flex gap-2">
                      <button
                        onClick={() => goToPage(gamesPage - 1)}
                        disabled={gamesPage === 1 || gamesLoading}
                        className="px-3 py-1.5 text-[10px] font-bold bg-navy-mid border border-[#1E2E52] rounded disabled:opacity-40 hover:border-gold/40 transition-colors"
                      >
                        ← Prev
                      </button>
                      <button
                        onClick={() => goToPage(gamesPage + 1)}
                        disabled={gamesPage === totalPages || gamesLoading || !hasMore}
                        className="px-3 py-1.5 text-[10px] font-bold bg-navy-mid border border-[#1E2E52] rounded disabled:opacity-40 hover:border-gold/40 transition-colors"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
