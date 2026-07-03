import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { studentApi } from '../../../api';
import { GameAnalysisResult, AnalyzedMove, MoveClass, getGameOutcome } from '../../../engine/gameAnalyzer';

/**
 * Converts a legacy game document into the structured GameAnalysisResult
 * expected by the new GameAnalysis.tsx component.
 */
export function convertLegacyGameToAnalysis(game: any): GameAnalysisResult {
  if (game && typeof game === 'object' && game.summary && game.summary.white && game.summary.black) {
    return {
      ...game,
      date: game.playedAt || game.date || new Date().toISOString()
    };
  }

  const moves: AnalyzedMove[] = (game.moves || []).map((m: any, idx: number) => ({
    moveIndex: idx,
    san: m.san || '?',
    color: m.color || (idx % 2 === 0 ? 'w' : 'b'),
    fen: m.fen || '',
    fenBefore: m.fenBefore || '',
    from: m.from || '',
    to: m.to || '',
    evaluation: Math.round((m.evaluation || 0) * 100),
    evalBefore: Math.round((m.evalBefore || 0) * 100),
    bestMove: m.bestMove || '',
    bestMoveUci: m.bestMoveUci || '',
    bestMoveFrom: m.bestMoveFrom || '',
    bestMoveTo: m.bestMoveTo || '',
    classification: (m.classification || 'good') as MoveClass,
    winPercentBefore: m.winPercentBefore || 50,
    winPercentAfter: m.winPercentAfter || 50,
    cpLoss: m.cpLoss || 0,
    comment: m.comment || '',
    pieceMoved: m.pieceMoved || (m.san ? m.san.charAt(0) : '')
  }));

  const accuracy = game.accuracy || 0;
  const blunders = game.blunders || 0;
  const mistakes = game.mistakes || 0;
  const inaccuracies = game.inaccuracies || 0;

  return {
    moves,
    summary: {
      white: { accuracy, brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, inaccuracy: inaccuracies, mistake: mistakes, miss: 0, blunder: blunders, book: 0, acpl: game.acpl || 0 },
      black: { accuracy, brilliant: 0, great: 0, best: 0, excellent: 0, good: 0, inaccuracy: inaccuracies, mistake: mistakes, miss: 0, blunder: blunders, book: 0, acpl: game.acpl || 0 },
    },
    evalHistory: moves.map(m => m.evaluation),
    result: game.result || "Unknown",
    totalMoves: moves.length,
    date: game.playedAt || new Date().toISOString(),
    coachSummary: "This is a past game played on Sigaram64.",
    playerColor: game.playerColor || 'white',
    difficulty: game.aiLevel ? `AI Level ${game.aiLevel}` : "Unknown"
  };
}

export default function StudentAnalytics() {
  const { uid } = useParams();
  const [student, setStudent] = useState<any>(null);
  const [progress, setProgress] = useState<any>(null);
  const [games, setGames] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (uid) {
      studentApi.getDashboard(uid)
        .then(res => {
          setStudent(res.user);
          setProgress(res.progress);
          setGames(res.recentGames || []);
          setLoading(false);
        })
        .catch(err => {
          console.error("Failed to load student dashboard info", err);
          setLoading(false);
        });
    }
  }, [uid]);

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
  const gamesPlayed = stats.gamesPlayed || 0;
  const winRate = gamesPlayed ? Math.round(((stats.gamesWon || 0) / gamesPlayed) * 100) : 0;
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
                  <span className="text-green-400">Won ({stats.gamesWon || 0})</span>
                  <span className="text-red-400">Lost ({stats.gamesLost || 0})</span>
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
              <h3 className="text-white font-bold text-sm uppercase tracking-wider">Game History ({games.length})</h3>
            </div>
            
            {games.length === 0 ? (
              <div className="h-32 flex items-center justify-center border border-dashed border-[#1E2E52] rounded-xl select-none">
                <span className="text-gray-500">No games recorded yet.</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#1E2E52] text-gray-400 text-[10px] uppercase font-bold">
                      <th className="pb-3 pr-4">Date</th>
                      <th className="pb-3 pr-4">Result</th>
                      <th className="pb-3 pr-4 text-center">Moves</th>
                      <th className="pb-3 pr-4 text-center">Accuracy</th>
                      <th className="pb-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#1E2E52]/20">
                    {games.map(game => {
                      const dateStr = game.playedAt 
                        ? new Date(game.playedAt).toLocaleDateString() 
                        : 'Unknown Date';
                        
                      const outcome = getGameOutcome(game.result || '', game.playerColor || 'white');
                      const isWin = outcome === 'win';
                      const isLoss = outcome === 'loss';
                      
                      return (
                        <tr key={game.id} className="hover:bg-[#12234A]/20 transition-colors">
                          <td className="py-4 pr-4 text-gray-300">{dateStr}</td>
                          <td className="py-4 pr-4 font-bold">
                            <span className={isWin ? "text-green-400" : isLoss ? "text-red-400" : "text-gray-300"}>
                              {game.result || "Unknown"}
                            </span>
                          </td>
                          <td className="py-4 pr-4 text-center text-gray-400">
                            {game.moves?.length ? Math.floor(game.moves.length / 2) : "—"}
                          </td>
                          <td className="py-4 pr-4 text-center font-mono">
                            {game.accuracy ? (
                              <span className="text-gold">{game.accuracy}%</span>
                            ) : "—"}
                          </td>
                          <td className="py-4 text-right">
                            <Link 
                              to={`/students/${uid}/games/${game.id}`}
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
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
