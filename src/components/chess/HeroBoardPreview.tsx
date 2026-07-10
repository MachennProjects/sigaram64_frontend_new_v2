// HeroBoardPreview — Decorative 3D-tilted chess board for public marketing pages.
// Uses the real ChessBoard component (disabled) so pieces, colors & styling stay in sync.
import React from "react";
import ChessBoard from "./ChessBoard";

const STARTING_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const NO_OP_MOVE   = () => false;

interface HeroBoardPreviewProps {
  /** Total board width in px. Default: 352 (= 8 × 44). Use 240 for sidebar. */
  size?: number;
}

export default function HeroBoardPreview({ size = 352 }: HeroBoardPreviewProps) {
  const perspective = size >= 300 ? 700 : 550;
  const rotateX     = size >= 300 ? 34  : 32;
  const rotateZ     = size >= 300 ? -8  : -7;
  const floatY      = size >= 300 ? 14  : 10;
  const groundW     = Math.round(size * 0.9);
  const keyId       = `hbp-${size}`;

  // Extra space around the board so the 3D rotation doesn't clip corners
  const padding = Math.round(size * 0.18);

  return (
    <div
      className="relative flex flex-col items-center justify-center select-none"
      style={{ width: size + padding * 2, height: (size + padding * 2) * 1.1 }}
    >
      {/* Scoped keyframes — namespaced by size so two instances never clash */}
      <style>{`
        @keyframes ${keyId}-float {
          0%, 100% { transform: perspective(${perspective}px) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) translateY(0px); }
          50%       { transform: perspective(${perspective}px) rotateX(${rotateX}deg) rotateZ(${rotateZ}deg) translateY(-${floatY}px); }
        }
        @keyframes ${keyId}-ambient {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%       { opacity: 0.9; transform: scale(1.06); }
        }
      `}</style>

      {/* Ambient radial glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 70% at 50% 50%, rgba(212,175,55,0.20) 0%, rgba(30,58,138,0.13) 55%, transparent 80%)",
          animation: `${keyId}-ambient 5s ease-in-out infinite`,
        }}
      />

      {/* Floating 3D-tilted wrapper — no overflow:hidden so corners aren't clipped */}
      <div
        style={{
          width: size,
          animation: `${keyId}-float 5s ease-in-out infinite`,
          // Shadow applied here instead of on inner board to avoid clipping
          filter: `drop-shadow(0 ${size >= 300 ? 28 : 18}px ${size >= 300 ? 48 : 30}px rgba(0,0,0,0.65)) drop-shadow(0 0 ${size >= 300 ? 24 : 14}px rgba(212,175,55,0.30))`,
          // Thin gold outline via outline (doesn't clip with 3D)
          outline: `${size >= 300 ? 3 : 2}px solid rgba(212,175,55,0.50)`,
          outlineOffset: 0,
          borderRadius: 8,
        }}
      >
        {/* Real ChessBoard — non-interactive, no coordinates */}
        <ChessBoard
          position={STARTING_FEN}
          onMove={NO_OP_MOVE}
          disabled
          hideCheckmateBadges
          hideCoordinates
        />
      </div>

      {/* Ground glow ellipse */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: "50%",
          transform: "translateX(-50%)",
          width: groundW,
          height: size >= 300 ? 22 : 14,
          background: "rgba(212,175,55,0.28)",
          borderRadius: "50%",
          filter: "blur(16px)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
