import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { Chess, Square, PieceSymbol, Color } from 'chess.js';

// ── Props ────────────────────────────────────────────────────────────────────
interface PuzzleBoardProps {
  position: string;
  onMove: (from: string, to: string) => boolean;
  /** Squares that hold a ⭐ star target the player must reach */
  starSquares?: string[];
  disabled?: boolean;
  orientation?: 'white' | 'black';
}

// ── Constants ─────────────────────────────────────────────────────────────────
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['8', '7', '6', '5', '4', '3', '2', '1'];

const DARK_SQ  = '#805E4B';
const LIGHT_SQ = '#D8B384';

function squareColor(fileIdx: number, rankIdx: number): 'dark' | 'light' {
  return (fileIdx + rankIdx) % 2 === 0 ? 'light' : 'dark';
}

function pieceImgSrc(color: Color, type: PieceSymbol) {
  return `https://lichess1.org/assets/piece/cburnett/${color}${type.toUpperCase()}.svg`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function PuzzleBoard({
  position,
  onMove,
  starSquares = [],
  disabled = false,
  orientation = 'white',
}: PuzzleBoardProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [legalTargets, setLegalTargets] = useState<string[]>([]);

  // Parse board
  const game = useMemo(() => {
    const g = new Chess();
    try { g.load(position); } catch { g.reset(); }
    return g;
  }, [position]);

  const board = useMemo(() => game.board(), [game]);

  // Reset selection when position changes
  useEffect(() => {
    setSelected(null);
    setLegalTargets([]);
  }, [position]);

  const orderedFiles = orientation === 'white' ? FILES : [...FILES].reverse();
  const orderedRanks = orientation === 'white' ? RANKS : [...RANKS].reverse();

  // Occupied squares set
  const occupied = useMemo(() => {
    const s = new Set<string>();
    board.forEach(row => row.forEach(sq => { if (sq) s.add(sq.square); }));
    return s;
  }, [board]);

  // ── Click handler ─────────────────────────────────────────────────────────
  const handleClick = useCallback((sq: string) => {
    if (disabled) return;

    if (selected) {
      // Deselect same square
      if (sq === selected) {
        setSelected(null);
        setLegalTargets([]);
        return;
      }

      // Legal chess target OR star square target
      const canMoveTo = legalTargets.includes(sq) || starSquares.includes(sq);
      if (canMoveTo) {
        const success = onMove(selected, sq);
        setSelected(null);
        setLegalTargets([]);
        return;
      }

      // Re-select another own piece
      const clickedPiece = game.get(sq as Square);
      if (clickedPiece && clickedPiece.color === game.turn()) {
        const moves = game.moves({ square: sq as Square, verbose: true });
        setSelected(sq);
        setLegalTargets(moves.map(m => m.to));
        return;
      }

      // Deselect
      setSelected(null);
      setLegalTargets([]);
      return;
    }

    // No selection — select own piece
    const piece = game.get(sq as Square);
    if (piece && piece.color === game.turn()) {
      const moves = game.moves({ square: sq as Square, verbose: true });
      setSelected(sq);
      setLegalTargets(moves.map(m => m.to));
    }
  }, [disabled, selected, legalTargets, starSquares, game, onMove]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full select-none" style={{ aspectRatio: '1/1' }}>
      {/* Board */}
      <div
        className="absolute inset-0 rounded-xl overflow-hidden shadow-2xl"
        style={{ border: '2px solid rgba(128,94,75,0.4)' }}
      >
        <div className="grid w-full h-full" style={{ gridTemplateColumns: 'repeat(8, 1fr)', gridTemplateRows: 'repeat(8, 1fr)' }}>
          {orderedRanks.map((rank, rankIdx) =>
            orderedFiles.map((file, fileIdx) => {
              const sq     = `${file}${rank}`;
              const isDark = squareColor(fileIdx, rankIdx) === 'dark';
              const baseBg = isDark ? DARK_SQ : LIGHT_SQ;

              const isSelected   = selected === sq;
              const isLegal      = legalTargets.includes(sq);
              const isStar       = starSquares.includes(sq);
              const isOccupied   = occupied.has(sq);

              // Piece
              const boardRow  = 8 - parseInt(rank);
              const boardCol  = FILES.indexOf(file);
              const pieceData = board[boardRow]?.[boardCol];

              return (
                <div
                  key={sq}
                  onClick={() => handleClick(sq)}
                  className="relative flex items-center justify-center cursor-pointer"
                  style={{ backgroundColor: baseBg }}
                >
                  {/* ── Selected highlight ── */}
                  {isSelected && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: 'rgba(201,168,76,0.28)',
                        boxShadow: 'inset 0 0 0 3px #C9A84C, inset 0 0 14px rgba(201,168,76,0.5)',
                      }}
                    />
                  )}

                  {/* ── Legal move dot (empty square) ── */}
                  {isLegal && !isOccupied && !isStar && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                      <div
                        className="rounded-full"
                        style={{
                          width: '28%',
                          height: '28%',
                          backgroundColor: 'rgba(0,0,0,0.28)',
                        }}
                      />
                    </div>
                  )}

                  {/* ── Legal capture ring ── */}
                  {isLegal && isOccupied && !isStar && (
                    <div
                      className="absolute inset-[3px] rounded-full pointer-events-none z-10"
                      style={{ border: '3px solid rgba(0,0,0,0.32)' }}
                    />
                  )}

                  {/* ── ⭐ STAR TARGET — large, prominent, always visible ── */}
                  {isStar && (
                    <div
                      className="absolute inset-0 flex items-center justify-center pointer-events-none z-20"
                      style={{
                        background: isSelected
                          ? 'rgba(201,168,76,0.18)'
                          : 'rgba(201,168,76,0.12)',
                      }}
                    >
                      {/* Pulsing glow behind star */}
                      <div
                        className="absolute rounded-full animate-ping"
                        style={{
                          width: '55%',
                          height: '55%',
                          backgroundColor: 'rgba(201,168,76,0.25)',
                          animationDuration: '1.8s',
                        }}
                      />
                      {/* Star SVG — gold, always large */}
                      <svg
                        viewBox="0 0 24 24"
                        style={{
                          width: '62%',
                          height: '62%',
                          position: 'relative',
                          filter: 'drop-shadow(0 0 5px rgba(201,168,76,0.9)) drop-shadow(0 0 12px rgba(201,168,76,0.5))',
                        }}
                      >
                        <path
                          fill="#C9A84C"
                          stroke="#fff"
                          strokeWidth="0.4"
                          d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
                        />
                      </svg>
                    </div>
                  )}

                  {/* ── Piece ── */}
                  {pieceData && (
                    <div
                      className="absolute inset-0 flex items-center justify-center z-30 pointer-events-none"
                    >
                      <img
                        src={pieceImgSrc(pieceData.color, pieceData.type)}
                        alt={`${pieceData.color}${pieceData.type}`}
                        className="object-contain select-none"
                        style={{
                          width: '88%',
                          height: '88%',
                          cursor: disabled ? 'default' : 'pointer',
                        }}
                        draggable={false}
                      />
                    </div>
                  )}

                  {/* ── Coordinate: file label (bottom row) ── */}
                  {rankIdx === 7 && (
                    <span
                      className="absolute bottom-[2px] right-[3px] text-[10px] font-bold pointer-events-none z-40 leading-none"
                      style={{ color: isDark ? LIGHT_SQ : DARK_SQ }}
                    >
                      {file}
                    </span>
                  )}

                  {/* ── Coordinate: rank label (left col) ── */}
                  {fileIdx === 0 && (
                    <span
                      className="absolute top-[2px] left-[3px] text-[10px] font-bold pointer-events-none z-40 leading-none"
                      style={{ color: isDark ? LIGHT_SQ : DARK_SQ }}
                    >
                      {rank}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Disabled overlay */}
        {disabled && (
          <div className="absolute inset-0 z-50 cursor-not-allowed" />
        )}
      </div>
    </div>
  );
}
