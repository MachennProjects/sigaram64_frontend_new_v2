import React, { useState, useEffect, useMemo } from "react";
import { Chess } from "chess.js";
import ChessBoard from "../../../chess/ChessBoard";
import ChessGameLayout, { PlayerInfo, MoveRowData } from "../../../chess/ChessGameLayout";
import { FamousGame } from "../FamousGames";
import { GameAnalysisResult, MoveClass, analyzeGame } from "../../../../engine/gameAnalyzer";
import EvalBar from "../../../chess/EvalBar";

const MOVE_COLORS: Record<MoveClass, string> = {
  brilliant: '#1BACA6',
  great: '#5C8BB0',
  book: '#A88B65',
  best: '#96BC4B',
  excellent: '#96BC4B',
  good: '#6BAA64',
  inaccuracy: '#E6A42B',
  mistake: '#E68A2B',
  miss: '#CA3431',
  blunder: '#CA3431',
};

const MOVE_ICONS: Record<MoveClass, string> = {
  brilliant: '‼',
  great: '!',
  book: '📖',
  best: '★',
  excellent: '👍',
  good: '✓',
  inaccuracy: '?!',
  mistake: '?',
  miss: '✗',
  blunder: '??',
};

/* ── Helpers for Parsing & Commentating ───────────────────────────────── */
function getMoveCommentary(move: string, index: number, color: 'w' | 'b') {
  const side = color === 'w' ? 'White' : 'Black';

  if (move === 'e4' || move === 'd4') {
    return `${side} opens with a central pawn advance, staking a claim in the center and opening lines for development.`;
  }
  if (move === 'e5' || move === 'd5') {
    return `${side} responds symmetrically, contesting control of the key central squares.`;
  }
  if (move.startsWith('Nf3') || move.startsWith('Nf6')) {
    return `${side} develops the knight to a natural square, controlling central squares and preparing king safety.`;
  }
  if (move.startsWith('Nc3') || move.startsWith('Nc6')) {
    return `${side} develops the knight towards the center, supporting central pawns and adding pressure.`;
  }
  if (move.startsWith('O-O')) {
    return `${side} castles, tucking the king away to safety and bringing the rook closer to the action.`;
  }
  if (move.includes('#')) {
    return `Checkmate! ${side} wins a brilliant historical game!`;
  }
  if (move.includes('+')) {
    return `${side} delivers a check, forcing the opponent's king to respond.`;
  }
  if (move.includes('x')) {
    return `${side} captures a piece, increasing the tactical tension on the board.`;
  }
  if (move.startsWith('B')) {
    return `${side} activates the bishop, placing it on an active diagonal to target key enemy weaknesses.`;
  }
  if (move.startsWith('Q')) {
    return `${side} brings out the queen, the most powerful piece on the board, to join the battle.`;
  }
  if (move.startsWith('R')) {
    return `${side} repositions the rook, aiming to control an open file or support the back rank.`;
  }

  return `${side} plays ${move}. Study how this move impacts the board control and coordinates with the other pieces.`;
}

/* ── GameViewer (Interactive Study Component) ─────────────────────────── */
interface GameViewerProps {
  game: FamousGame;
  onBack: () => void;
}

export default function GameViewer({ game, onBack }: GameViewerProps) {
  const [moveIdx, setMoveIdx] = useState(-1); // -1 is starting position
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [sideTab, setSideTab] = useState<'moves' | 'info'>('moves');
  const [isPlaying, setIsPlaying] = useState(false);
  const [playSpeed, setPlaySpeed] = useState(2000); // milliseconds

  // AI analysis states
  const [showBestMove, setShowBestMove] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [isAnalyzingClient, setIsAnalyzingClient] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisResult, setAnalysisResult] = useState<GameAnalysisResult | null>(null);

  // Reset analysis when game changes
  useEffect(() => {
    setShowAnalysis(false);
    setAnalysisResult(null);
  }, [game]);

  // Precompute FEN positions
  const fens = useMemo(() => {
    const list = [new Chess().fen()];
    const c = new Chess();
    for (const move of game.moves) {
      try {
        c.move(move);
        list.push(c.fen());
      } catch (e) {
        list.push(list[list.length - 1]);
      }
    }
    return list;
  }, [game]);

  // Precompute verbose moves (from, to squares) for highlighting
  const verboseMovesList = useMemo(() => {
    const c = new Chess();
    const list: { from: string; to: string; san: string; color: 'w' | 'b' }[] = [];
    for (const move of game.moves) {
      try {
        const result = c.move(move);
        list.push({
          from: result.from,
          to: result.to,
          san: result.san,
          color: result.color,
        });
      } catch (e) {
        list.push({ from: '', to: '', san: move, color: 'w' });
      }
    }
    return list;
  }, [game]);

  const handleStartClientAnalysis = async () => {
    setIsAnalyzingClient(true);
    setAnalysisProgress(0);

    try {
      // Reconstruct MoveDetail[] list for browser Stockfish analyzer
      const moveDetails = verboseMovesList.map((m, idx) => {
        const c = new Chess(fens[idx]);
        let piece = 'p';
        try {
          const moveInfo = c.move(m.san);
          piece = moveInfo.piece;
        } catch { }
        return {
          from: m.from || '',
          to: m.to || '',
          san: m.san || '',
          piece,
          color: m.color || 'w'
        };
      });

      const analyzed = await analyzeGame(
        moveDetails,
        'white',
        'Legends',
        game.result === '1-0' ? 'white_win' : game.result === '0-1' ? 'black_win' : 'draw',
        (progress) => setAnalysisProgress(progress)
      );

      if (analyzed) {
        setAnalysisResult(analyzed);
        setShowAnalysis(true);
      }
    } catch (err) {
      console.error('Failed to run Stockfish analysis on historical game:', err);
    } finally {
      setIsAnalyzingClient(false);
    }
  };

  // Auto-play timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (isPlaying) {
      timer = setInterval(() => {
        setMoveIdx(prev => {
          if (prev < game.moves.length - 1) {
            return prev + 1;
          } else {
            setIsPlaying(false);
            return prev;
          }
        });
      }, playSpeed);
    }
    return () => clearInterval(timer);
  }, [isPlaying, playSpeed, game]);

  // Bind Keyboard Navigation
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') {
        setMoveIdx(m => Math.max(-1, m - 1));
      } else if (event.key === 'ArrowRight') {
        setMoveIdx(m => Math.min(game.moves.length - 1, m + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [game]);

  const currentFen = fens[moveIdx + 1];
  const lastMove = moveIdx >= 0 ? verboseMovesList[moveIdx] : null;

  // King check status
  const currentKingInCheck = useMemo(() => {
    const temp = new Chess(currentFen);
    if (temp.isCheck()) {
      const board = temp.board();
      const turn = temp.turn();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r][c];
          if (piece && piece.type === 'k' && piece.color === turn) {
            return `${'abcdefgh'[c]}${8 - r}`;
          }
        }
      }
    }
    return null;
  }, [currentFen]);

  // Material captures
  const capturedData = useMemo(() => {
    const boardFen = currentFen.split(' ')[0];
    const counts: Record<string, number> = {
      p: 0, n: 0, b: 0, r: 0, q: 0,
      P: 0, N: 0, B: 0, R: 0, Q: 0
    };
    for (const char of boardFen) {
      if (counts.hasOwnProperty(char)) {
        counts[char]++;
      }
    }
    const capturedByWhite = {
      p: 8 - counts.p,
      n: 2 - counts.n,
      b: 2 - counts.b,
      r: 2 - counts.r,
      q: 1 - counts.q,
    };
    const capturedByBlack = {
      p: 8 - counts.P,
      n: 2 - counts.N,
      b: 2 - counts.B,
      r: 2 - counts.R,
      q: 1 - counts.Q,
    };

    const whiteMaterial = counts.P * 1 + counts.N * 3 + counts.B * 3 + counts.R * 5 + counts.Q * 9;
    const blackMaterial = counts.p * 1 + counts.n * 3 + counts.b * 3 + counts.r * 5 + counts.q * 9;
    const diff = whiteMaterial - blackMaterial;

    return {
      capturedByWhite,
      capturedByBlack,
      whiteAdvantage: diff > 0 ? diff : 0,
      blackAdvantage: diff < 0 ? -diff : 0
    };
  }, [currentFen]);

  // Dynamic layout players
  const playerWhite = {
    name: game.white,
    avatarLetter: 'W',
    avatarBg: '#D8B384',
    isActive: moveIdx === -1 || moveIdx % 2 !== 0,
    capturedPieces: capturedData.capturedByWhite,
    capturedPieceColor: 'b' as const,
    scoreAdvantage: capturedData.whiteAdvantage,
  };

  const playerBlack = {
    name: game.black,
    avatarLetter: 'B',
    avatarBg: '#32312F',
    isActive: moveIdx >= 0 && moveIdx % 2 === 0,
    capturedPieces: capturedData.capturedByBlack,
    capturedPieceColor: 'w' as const,
    scoreAdvantage: capturedData.blackAdvantage,
  };

  const topPlayer: PlayerInfo = orientation === 'white' ? playerBlack : playerWhite;
  const bottomPlayer: PlayerInfo = orientation === 'white' ? playerWhite : playerBlack;

  // Format move rows for Sidebar Moves List
  const moveRows = useMemo(() => {
    const rows: MoveRowData[] = [];
    const moves = game.moves;
    for (let i = 0; i < moves.length; i += 2) {
      const whiteMoveAnalyzed = showAnalysis && analysisResult ? analysisResult.moves[i] : null;
      const blackMoveAnalyzed = showAnalysis && analysisResult ? analysisResult.moves[i + 1] : null;

      rows.push({
        num: Math.floor(i / 2) + 1,
        white: moves[i] ? {
          san: moves[i],
          color: 'w' as const,
          icon: whiteMoveAnalyzed ? (
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white" style={{ backgroundColor: MOVE_COLORS[whiteMoveAnalyzed.classification] }}>
              {MOVE_ICONS[whiteMoveAnalyzed.classification]}
            </div>
          ) : null
        } : null,
        black: moves[i + 1] ? {
          san: moves[i + 1],
          color: 'b' as const,
          icon: blackMoveAnalyzed ? (
            <div className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] text-white" style={{ backgroundColor: MOVE_COLORS[blackMoveAnalyzed.classification] }}>
              {MOVE_ICONS[blackMoveAnalyzed.classification]}
            </div>
          ) : null
        } : null,
        whiteIdx: i,
        blackIdx: i + 1 < moves.length ? i + 1 : null,
      });
    }
    return rows;
  }, [game.moves, showAnalysis, analysisResult]);

  // Commentary
  const currentMoveSan = moveIdx >= 0 ? game.moves[moveIdx] : '';
  const currentMoveColor = moveIdx >= 0 ? (moveIdx % 2 === 0 ? 'w' : 'b') : 'w';

  const moveCommentary = useMemo(() => {
    if (moveIdx === -1) {
      return "Study this legendary chess game. Use keyboard Left/Right arrows or the Autoplay button to step through moves!";
    }
    if (game.commentary && game.commentary[moveIdx]) {
      return game.commentary[moveIdx];
    }
    return getMoveCommentary(currentMoveSan, moveIdx, currentMoveColor);
  }, [moveIdx, game, currentMoveSan, currentMoveColor]);

  const currentAnalyzedMove = showAnalysis && analysisResult && moveIdx >= 0 ? analysisResult.moves[moveIdx] : null;

  const getSquareCenter = (square: string, orient: 'white' | 'black') => {
    const files = 'abcdefgh';
    const fIdx = orient === 'white' ? files.indexOf(square[0]) : 7 - files.indexOf(square[0]);
    const rIdx = orient === 'white' ? parseInt(square[1]) - 1 : 8 - parseInt(square[1]);
    return {
      x: (fIdx + 0.5) * 12.5,
      y: (7 - rIdx + 0.5) * 12.5
    };
  };

  // Sidebar Commentary Box
  const topSidePanelContent = (
    <div className="p-4 min-h-[110px] flex border-b border-[#2B2927] bg-[#191815] flex-shrink-0 w-full">
      {isAnalyzingClient ? (
        <div className="bg-[#1e2e52]/10 border border-[#2b3e6d] rounded-xl p-4 flex-1 flex flex-col justify-center items-center gap-2 w-full">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-[#C9A84C] border-t-transparent rounded-full animate-spin" />
            <span className="text-[#E7CB75] font-bold text-sm">Analyzing game...</span>
          </div>
          <div className="w-full bg-[#1b1a17] rounded-full h-2 mt-1 max-w-[200px] overflow-hidden">
            <div className="bg-[#C9A84C] h-2 rounded-full transition-all duration-300" style={{ width: `${analysisProgress}%` }}></div>
          </div>
          <span className="text-xs text-gray-400 font-medium">{analysisProgress}% complete</span>
        </div>
      ) : showAnalysis && analysisResult ? (
        currentAnalyzedMove ? (
          <div className="bg-white text-[#111] rounded-xl p-4 shadow-lg flex-1 relative border-2 flex flex-col text-left w-full" style={{ borderColor: MOVE_COLORS[currentAnalyzedMove.classification] }}>
            <div className="flex justify-between items-center mb-1.5 select-none">
              <span className="text-[10px] font-extrabold uppercase tracking-wider" style={{ color: MOVE_COLORS[currentAnalyzedMove.classification] }}>
                {MOVE_ICONS[currentAnalyzedMove.classification]} {currentAnalyzedMove.classification}
              </span>
              <span className="text-[10px] text-gray-500 font-bold bg-gray-100 px-1.5 py-0.5 rounded">
                Eval: {(currentAnalyzedMove.evaluation / 100).toFixed(2)}
              </span>
            </div>
            <p className="text-xs text-gray-800 leading-relaxed font-semibold">{currentAnalyzedMove.comment}</p>
          </div>
        ) : (
          <div className="bg-white text-[#111] rounded-xl p-4 shadow-lg flex-1 border-2 border-[#C9A84C]/80 flex items-center select-none text-left w-full">
            <span className="text-xs font-semibold text-gray-700">Let's review this legendary game! Click on any move to start the review.</span>
          </div>
        )
      ) : (
        <div className="bg-[#1e2e52]/20 border border-[#2b3e6d]/40 rounded-xl p-4 flex-1 flex flex-col sm:flex-row justify-between items-center gap-4 w-full">
          <div className="flex-1 text-center sm:text-left">
            <div className="text-[10px] text-[#C9A84C] font-black uppercase tracking-wider mb-0.5 select-none">Coach Commentary</div>
            <p className="text-xs text-white leading-relaxed font-medium">
              {moveCommentary}
            </p>
          </div>
          <button
            onClick={handleStartClientAnalysis}
            className="w-full sm:w-auto px-4 py-2 font-bold text-xs rounded-lg text-[#101c3e] transition-all shadow-md flex items-center justify-center gap-1.5 hover:brightness-110 bg-[#C9A84C] hover:bg-[#D4B55E] flex-shrink-0"
          >
            <span>🤖</span> Get AI Analysis
          </button>
        </div>
      )}
    </div>
  );

  const boardComponent = (
    <div className="relative w-full aspect-square shadow-2xl rounded-sm">
      <ChessBoard
        position={currentFen}
        onMove={() => false} // study mode is read-only
        orientation={orientation}
        disabled={true}
        lastMove={lastMove}
        kingInCheck={currentKingInCheck}
      />
      {showAnalysis && currentAnalyzedMove?.bestMoveFrom && currentAnalyzedMove?.bestMoveTo && (
        <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))' }}>
          <defs>
            <marker id="arrowhead" markerWidth="3" markerHeight="3" refX="2.5" refY="1.5" orient="auto">
              <polygon points="0 0, 3 1.5, 0 3" fill="#96BC4B" opacity="0.9" />
            </marker>
          </defs>
          <line
            x1={`${getSquareCenter(currentAnalyzedMove.bestMoveFrom, orientation).x}%`}
            y1={`${getSquareCenter(currentAnalyzedMove.bestMoveFrom, orientation).y}%`}
            x2={`${getSquareCenter(currentAnalyzedMove.bestMoveTo, orientation).x}%`}
            y2={`${getSquareCenter(currentAnalyzedMove.bestMoveTo, orientation).y}%`}
            stroke="#96BC4B"
            strokeWidth="1.8%"
            strokeLinecap="round"
            opacity="0.9"
            markerEnd="url(#arrowhead)"
          />
        </svg>
      )}
    </div>
  );

  const bottomControls = (
    <div className="flex gap-2 p-3 border-b lg:border-t lg:border-b-0 border-[#1E2E52] order-2 lg:order-3 bg-[#1D1C1A] flex-shrink-0">
      <button
        onClick={onBack}
        className="flex-1 py-2.5 bg-[#32312F] hover:bg-[#403F3C] text-gray-200 font-semibold rounded-md shadow flex items-center justify-center gap-1.5 transition-colors text-xs"
      >
        <span>🔙</span> Back to List
      </button>
      <button
        onClick={() => setOrientation(o => o === 'white' ? 'black' : 'white')}
        className="flex-1 py-2.5 bg-[#32312F] hover:bg-[#403F3C] text-gray-200 font-semibold rounded-md shadow flex items-center justify-center gap-1.5 transition-colors text-xs"
      >
        <span>🔄</span> Flip Board
      </button>
      <button
        onClick={() => setIsPlaying(p => !p)}
        className={`flex-1 py-2.5 font-bold rounded-md shadow flex items-center justify-center gap-1.5 transition-all text-xs ${isPlaying
            ? 'bg-amber-600 text-white hover:bg-amber-700'
            : 'bg-[#C9A84C] text-[#101c3e] hover:brightness-110'
          }`}
      >
        <span>{isPlaying ? '⏸️ Pause' : '▶️ Autoplay'}</span>
      </button>
    </div>
  );

  const renderStatRow = (label: string, icon: string, key: MoveClass, color: string) => {
    if (!analysisResult) return null;
    const w = analysisResult.summary.white[key] || 0;
    const b = analysisResult.summary.black[key] || 0;
    if (w === 0 && b === 0 && key !== 'best' && key !== 'good' && key !== 'inaccuracy' && key !== 'mistake' && key !== 'blunder') return null;

    return (
      <div className="flex items-center py-1.5 px-1 hover:bg-[#2A2825] transition-colors text-[12px]">
        <div className="w-24 text-left text-gray-300 font-semibold">{label}</div>
        <div className="w-12 text-center text-[#E7CB75] font-bold">{w > 0 ? w : ''}</div>
        <div className="flex-1 flex justify-center">
          <div className="w-4 h-4 rounded flex items-center justify-center text-white text-[9px] font-bold" style={{ backgroundColor: color }}>
            {icon}
          </div>
        </div>
        <div className="w-12 text-center text-[#E7CB75] font-bold">{b > 0 ? b : ''}</div>
      </div>
    );
  };

  const infoTabContent = (
    <div className="space-y-4 text-sm text-gray-300">
      {showAnalysis && analysisResult ? (
        <>
          {/* Accuracy Section matching reference */}
          <div className="mb-3 bg-[#191815] rounded-lg border border-[#2B2927] p-3">
            <table className="w-full table-fixed text-center border-b border-[#2B2927] pb-3 block">
              <thead className="block w-full">
                <tr className="flex w-full mb-2">
                  <th className="w-[30%]"></th>
                  <th className="w-[35%] text-[11px] font-bold text-white truncate px-1 text-center">{game.white}</th>
                  <th className="w-[35%] text-[11px] font-bold text-white truncate px-1 text-center">{game.black}</th>
                </tr>
              </thead>
              <tbody className="block w-full">
                <tr className="flex w-full items-center mb-3">
                  <td className="w-[30%] text-left text-[12px] font-bold text-gray-200 pl-1">Players</td>
                  <td className="w-[35%] flex justify-center">
                    <div className="w-[40px] h-[40px] bg-[#E1E1E1] rounded overflow-hidden flex items-center justify-center shadow">
                      <span className="text-[30px] text-[#8C8C8C] leading-none mt-1">♙</span>
                    </div>
                  </td>
                  <td className="w-[35%] flex justify-center">
                    <div className="w-[40px] h-[40px] bg-[#E1E1E1] rounded overflow-hidden flex items-center justify-center shadow border-2 border-[#82A84E]">
                      <span className="text-[30px] text-[#8C8C8C] leading-none mt-1">♙</span>
                    </div>
                  </td>
                </tr>
                <tr className="flex w-full items-center mb-1">
                  <td className="w-[30%] text-left text-[12px] font-bold text-gray-200 pl-1">Accuracy</td>
                  <td className="w-[35%] flex justify-center">
                    <div className="bg-white text-black font-extrabold text-[14px] rounded px-2.5 py-0.5 shadow min-w-[3rem]">
                      {analysisResult.summary.white.accuracy}
                    </div>
                  </td>
                  <td className="w-[35%] flex justify-center">
                    <div className="bg-[#2D2A26] text-white font-extrabold text-[14px] rounded px-2.5 py-0.5 shadow min-w-[3rem]">
                      {analysisResult.summary.black.accuracy}
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Categories Breakdown */}
          <div className="bg-[#191815] rounded-lg border border-[#2B2927] overflow-hidden p-1.5 mb-2">
            {renderStatRow('Brilliant', MOVE_ICONS.brilliant, 'brilliant', MOVE_COLORS.brilliant)}
            {renderStatRow('Great', MOVE_ICONS.great, 'great', MOVE_COLORS.great)}
            {renderStatRow('Book', MOVE_ICONS.book, 'book', MOVE_COLORS.book)}
            {renderStatRow('Best', MOVE_ICONS.best, 'best', MOVE_COLORS.best)}
            {renderStatRow('Excellent', MOVE_ICONS.excellent, 'excellent', MOVE_COLORS.excellent)}
            {renderStatRow('Good', MOVE_ICONS.good, 'good', MOVE_COLORS.good)}
            {renderStatRow('Inaccuracy', MOVE_ICONS.inaccuracy, 'inaccuracy', MOVE_COLORS.inaccuracy)}
            {renderStatRow('Mistake', MOVE_ICONS.mistake, 'mistake', MOVE_COLORS.mistake)}
            {renderStatRow('Miss', MOVE_ICONS.miss, 'miss', MOVE_COLORS.miss)}
            {renderStatRow('Blunder', MOVE_ICONS.blunder, 'blunder', MOVE_COLORS.blunder)}
          </div>
        </>
      ) : null}

      <div className="flex items-center gap-2 text-gray-400 text-xs">
        <span className="text-base select-none">🏆</span>
        <span>Event: {game.event}</span>
      </div>
      <div className="flex items-center gap-2 text-gray-400 text-xs">
        <span className="text-base select-none">📅</span>
        <span>Year: {game.year}</span>
      </div>
      <div className="flex items-center gap-2 text-gray-400 text-xs">
        <span className="text-base select-none">🏁</span>
        <span>Result: {game.result}</span>
      </div>
      <div className="flex items-center gap-2 text-gray-400 text-xs">
        <span className="text-base select-none">📊</span>
        <span>Total Moves: {game.moves.length} moves</span>
      </div>

      <div className="w-full h-px bg-[#1E2E52] my-2" />

      {/* Autoplay Speed Control */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-wider text-gray-500 select-none">Autoplay Speed</label>
        <div className="flex gap-2">
          {([
            { label: 'Slow (3s)', val: 3000 },
            { label: 'Normal (2s)', val: 2000 },
            { label: 'Fast (1s)', val: 1000 }
          ]).map(speed => (
            <button
              key={speed.val}
              onClick={() => setPlaySpeed(speed.val)}
              className={`flex-1 py-2 rounded text-[11px] font-bold border transition-all ${playSpeed === speed.val
                  ? 'bg-[#C9A84C]/20 border-[#C9A84C] text-[#E7CB75]'
                  : 'bg-navy border-[#1E2E52] text-gray-400 hover:text-white'
                }`}
            >
              {speed.label}
            </button>
          ))}
        </div>
      </div>

      <div className="w-full h-px bg-[#1E2E52] my-2" />

      <div className="bg-[#191815] rounded-lg p-3 border border-white/5 space-y-1.5 text-xs text-gray-400 select-none">
        <p className="font-semibold text-gray-200">Study Tips:</p>
        <p>• Use your Keyboard Left/Right Arrow keys to step through moves quickly.</p>
        <p>• Click any move in the list to jump straight to that position.</p>
        <p>• Autoplay will automatically step through the entire game at your selected speed.</p>
      </div>
    </div>
  );

  return (
    <div className="h-auto lg:h-[calc(100vh-88px)] overflow-y-auto lg:overflow-hidden bg-dark-bg flex flex-col pt-3 lg:pt-4 pb-2 lg:pb-3 w-full">
      <ChessGameLayout
        boardComponent={boardComponent}
        evalBarComponent={null}
        topPlayer={topPlayer}
        bottomPlayer={bottomPlayer}
        sideTab={sideTab}
        onSideTabChange={setSideTab}
        moveRows={moveRows}
        highlightIdx={moveIdx}
        onMoveClick={setMoveIdx}
        viewMoveIndex={moveIdx}
        totalMoves={game.moves.length}
        onMoveNav={(dir) => {
          if (dir === 'first') setMoveIdx(-1);
          else if (dir === 'prev') setMoveIdx(m => Math.max(-1, m - 1));
          else if (dir === 'next') setMoveIdx(m => Math.min(game.moves.length - 1, m + 1));
          else if (dir === 'last') setMoveIdx(game.moves.length - 1);
        }}
        infoTabContent={infoTabContent}
        bottomControls={bottomControls}
        topSidePanelContent={topSidePanelContent}
        autoScroll={true}
        mobilePanelHeight="480px"
      />
    </div>
  );
}
