import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Chess } from "chess.js";
import { useSearchParams } from "react-router-dom";
import { LEARN_DATA, LearnCategory, LearnStage } from "../../../../data/lessons/learnLevels";
import { Badge } from "../../../ui";
import { useAuth } from "../../../../context/AuthContext";
import { lessonApi } from "../../../../api";
import PuzzleBoard from "../../../chess/PuzzleBoard";
import chessPiecesImg from "../../../../assets/Images/learnBanner/Chess Pieces Card Image.jpg";
import fundamentalsImg from "../../../../assets/Images/learnBanner/Fundamentals Card Image.jpg";
import intermediateImg from "../../../../assets/Images/learnBanner/Intermediate Card Image.jpg";
import advancedImg from "../../../../assets/Images/learnBanner/Advanced Card Image.jpg";

// ── Category metadata ────────────────────────────────────────────────────────
const CATEGORY_META: Record<string, { image: string; description: string }> = {
  "Chess Pieces": {
    image: chessPiecesImg,
    description: "Learn how each piece moves — from the powerful Queen to the humble Pawn. Master the unique rules of every piece on the board.",
  },
  "Fundamentals": {
    image: fundamentalsImg,
    description: "Build a solid foundation with board setup, castling, en passant, and stalemate. The essential rules every chess player must know.",
  },
  "Intermediate": {
    image: intermediateImg,
    description: "Level up your game with captures, protection, combat tactics, and check sequences. Sharpen your tactical vision and precision.",
  },
  "Advanced": {
    image: advancedImg,
    description: "Dive into piece values, multi-move checks, and deep strategic thinking. Push your chess mastery to the next level.",
  },
};

// ── Local progress helpers (localStorage — persists across refreshes) ─────────
function makeLessonId(stageName: string, levelNum: number) {
  return `interactive_${stageName}_${levelNum}`.replace(/\s+/g, "_").toLowerCase();
}

function getLocalStars(lessonId: string): number {
  const v = localStorage.getItem(`learn_stars_${lessonId}`);
  return v ? parseInt(v, 10) : 0;
}

function setLocalStars(lessonId: string, stars: number) {
  const current = getLocalStars(lessonId);
  if (stars > current) {
    localStorage.setItem(`learn_stars_${lessonId}`, stars.toString());
  }
}

// ── XP Toast component ────────────────────────────────────────────────────────
function XPToast({ xp, onDone }: { xp: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3000);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div className="fixed top-6 right-6 z-[9999] animate-slideUp pointer-events-none">
      <div
        className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl border border-gold/40"
        style={{
          background: "linear-gradient(135deg, #1a2c5a 0%, #0f1b3d 100%)",
          boxShadow: "0 0 30px rgba(201,168,76,0.3)",
        }}
      >
        <span className="text-2xl">🎉</span>
        <div>
          <p className="text-gold font-bold text-base leading-tight">+{xp} XP Earned!</p>
          <p className="text-gray-400 text-xs mt-0.5">Lesson completed for the first time</p>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function InteractiveLearnTab({
  onIsDeepView,
}: {
  onIsDeepView?: (isDeep: boolean) => void;
}) {
  const { user, refreshUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get current navigation parameters from URL query parameters
  const categoryParam = searchParams.get("category");
  const stageParam = searchParams.get("stage");
  const levelParam = searchParams.get("level");

  // Derive active states from query parameters
  const activeCategory = useMemo(() => {
    if (!categoryParam) return null;
    return LEARN_DATA.find((c) => c.name === categoryParam) || null;
  }, [categoryParam]);

  const activeStage = useMemo(() => {
    if (!activeCategory || !stageParam) return null;
    return activeCategory.stages.find((s) => s.name === stageParam) || null;
  }, [activeCategory, stageParam]);

  const activeLevel = useMemo(() => {
    if (!activeStage || !levelParam) return null;
    const lvlNum = parseInt(levelParam, 10);
    return activeStage.levels.some((l) => l.level === lvlNum) ? lvlNum : null;
  }, [activeStage, levelParam]);

  // ── DB progress (lessonId set of completed lessons) ────────────────────────
  const [dbCompletedIds, setDbCompletedIds] = useState<Set<string>>(new Set());
  const [progressLoaded, setProgressLoaded] = useState(false);

  // ── Puzzle state ───────────────────────────────────────────────────────────
  const [game, setGame] = useState(new Chess());
  const [boardPosition, setBoardPosition] = useState("start");
  const [starsToCapture, setStarsToCapture] = useState<string[]>([]);
  const starsRef = useRef<string[]>([]);            // stable ref for move handler
  const movesTakenRef = useRef(0);                  // stable ref for move handler
  const [movesTaken, setMovesTaken] = useState(0);
  const [status, setStatus] = useState<"ready" | "failed" | "completed">("ready");
  const [starsEarned, setStarsEarned] = useState(0);
  const [xpToast, setXpToast] = useState<number | null>(null);

  // ── Deep-view hook (let parent know if we are inside a category/stage/level) ──
  useEffect(() => {
    onIsDeepView?.(activeCategory !== null);
  }, [activeCategory, onIsDeepView]);

  // ── Load DB progress on mount ──────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) { setProgressLoaded(true); return; }

    lessonApi.getLessonProgress(user.id)
      .then((records: any[]) => {
        const ids = new Set<string>();
        records.forEach((r) => {
          if (r.lessonType === "interactive") {
            ids.add(r.lessonId);
            // Ensure localStorage always reflects DB truth (at least 1 star)
            if (getLocalStars(r.lessonId) === 0) {
              localStorage.setItem(`learn_stars_${r.lessonId}`, "1");
            }
          }
        });
        setDbCompletedIds(ids);
      })
      .catch(() => { /* offline — use localStorage only */ })
      .finally(() => setProgressLoaded(true));
  }, [user?.id]);

  // ── Progress helpers ───────────────────────────────────────────────────────
  const getProgress = useCallback(
    (stageName: string, levelNum: number): number => {
      const id = makeLessonId(stageName, levelNum);
      return dbCompletedIds.has(id) ? Math.max(getLocalStars(id), 1) : getLocalStars(id);
    },
    [dbCompletedIds],
  );

  const getStageStars = useCallback(
    (stage: LearnStage) =>
      stage.levels.reduce((acc, lvl) => acc + getProgress(stage.name, lvl.level), 0),
    [getProgress],
  );

  // ── Start/Reset Level ──────────────────────────────────────────────────────
  const resetLevel = useCallback(() => {
    if (!activeStage || !activeLevel) return;
    const config = activeStage.levels.find((l) => l.level === activeLevel);
    if (!config) return;

    setStatus("ready");
    setMovesTaken(0);
    setStarsEarned(0);
    setXpToast(null);
    movesTakenRef.current = 0;

    const newGame = new Chess(config.fen);
    setGame(newGame);
    setBoardPosition(config.fen);

    const stars = config.stars || [];
    setStarsToCapture(stars);
    starsRef.current = [...stars];
  }, [activeLevel, activeStage]);

  // Automatically trigger reset when activeStage or activeLevel parameters change
  useEffect(() => {
    resetLevel();
  }, [activeLevel, activeStage, resetLevel]);

  // Update URL parameters to trigger a level load (prevents React state latency)
  const startLevel = useCallback(
    (levelNum: number, stageToUse = activeStage) => {
      if (!stageToUse || !activeCategory) return;
      setSearchParams({
        category: activeCategory.name,
        stage: stageToUse.name,
        level: String(levelNum),
      });
    },
    [activeCategory, activeStage, setSearchParams],
  );

  // ── Complete a level ───────────────────────────────────────────────────────
  const completeLevel = useCallback(
    async (moves: number, optimal: number) => {
      const stars = moves <= optimal ? 3 : moves <= optimal + 2 ? 2 : 1;
      setStarsEarned(stars);
      setStatus("completed");

      if (activeStage && activeLevel) {
        const id = makeLessonId(activeStage.name, activeLevel);
        setLocalStars(id, stars);

        if (user?.id) {
          try {
            const res = await lessonApi.completeLesson(id, "interactive");
            if (res && !res.alreadyCompleted) {
              const xp = res.xpAwarded ?? 15;
              setXpToast(xp);
              setDbCompletedIds((prev) => new Set([...prev, id]));
              await refreshUser();
            }
          } catch (err) {
            console.error("Failed to save interactive lesson to DB:", err);
          }
        }
      }
    },
    [activeStage, activeLevel, user?.id, refreshUser],
  );

  // ── Move handler (click-to-move, compatible with custom ChessBoard) ─────────
  const onMove = useCallback(
    (sourceSquare: string, targetSquare: string): boolean => {
      if (status === "completed" || status === "failed") return false;

      const config = activeStage?.levels.find((l) => l.level === activeLevel);
      if (!config) return false;

      const piece = game.get(sourceSquare as any);
      if (!piece) return false;

      // Only allow white pieces
      if (piece.color === "b") return false;

      const newMoves = movesTakenRef.current + 1;

      // ── 1. Exact Answer Match ──────────────────────────────────────────────
      if (
        config.answerMove &&
        sourceSquare === config.answerMove.from &&
        targetSquare === config.answerMove.to
      ) {
        executeManualMove(sourceSquare, targetSquare);
        movesTakenRef.current = newMoves;
        setMovesTaken(newMoves);
        completeLevel(newMoves, config.optimalMoves);
        return true;
      } else if (config.answerMove) {
        setStatus("failed");
        return false;
      }

      // ── 2. Star Capture Logic ──────────────────────────────────────────────
      if (starsRef.current.length > 0) {
        executeManualMove(sourceSquare, targetSquare);
        movesTakenRef.current = newMoves;
        setMovesTaken(newMoves);

        if (starsRef.current.includes(targetSquare)) {
          const remaining = starsRef.current.filter((s) => s !== targetSquare);
          starsRef.current = remaining;
          setStarsToCapture([...remaining]);

          if (remaining.length === 0) {
            completeLevel(newMoves, config.optimalMoves);
          }
        }
        return true;
      }

      // ── 3. Normal chess move ───────────────────────────────────────────────
      try {
        const move = game.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
        if (move) {
          setBoardPosition(game.fen());
          movesTakenRef.current = newMoves;
          setMovesTaken(newMoves);
          return true;
        }
      } catch {
        return false;
      }

      return false;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, activeStage, activeLevel, game, completeLevel],
  );

  // ── Manual put/remove (bypass chess.js capture rules for star puzzles) ─────
  function executeManualMove(source: string, target: string) {
    const newGame = new Chess(game.fen());
    const movingPiece = newGame.get(source as any);
    if (!movingPiece) return;
    newGame.remove(source as any);
    newGame.put({ type: movingPiece.type, color: movingPiece.color }, target as any);
    setGame(newGame);
    setBoardPosition(newGame.fen());
  }

  // ── Stars UI ───────────────────────────────────────────────────────────────
  const renderStars = (earned: number, max = 3) =>
    Array.from({ length: max }).map((_, i) => (
      <span
        key={i}
        className={`text-xl transition-all duration-300 ${i < earned ? "text-gold scale-125" : "text-gray-600"}`}
      >
        ★
      </span>
    ));

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 1 — Puzzle (level active)
  // ══════════════════════════════════════════════════════════════════════════
  if (activeLevel && activeStage) {
    const config = activeStage.levels.find((l) => l.level === activeLevel);
    const maxLevels = activeStage.levels.length;

    return (
      <div className="flex flex-col lg:flex-row lg:items-start gap-8 animate-fadeIn">
        {/* XP Toast */}
        {xpToast !== null && (
          <XPToast xp={xpToast} onDone={() => setXpToast(null)} />
        )}

        {/* ── Info Panel ── */}
        <div className="flex-1 w-full max-w-lg order-2 lg:order-1">
          <button
            onClick={() => setSearchParams({ category: activeCategory?.name || "" })}
            className="text-gray-400 hover:text-white flex items-center gap-2 mb-4 text-sm font-semibold"
          >
            ← Back to Levels
          </button>

          <div className="bg-navy-mid border border-divider rounded-2xl p-6 shadow-2xl">
            {/* Level header */}
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xl font-bold text-white">
                {activeStage.name} — Level {activeLevel}
              </h2>
              <Badge variant="gold">{maxLevels} Levels</Badge>
            </div>

            <p className="text-gray-300 mb-5 min-h-[48px] leading-relaxed">
              {config?.description || activeStage.description}
            </p>

            {/* Moves counter */}
            <div className="flex items-center justify-between mb-5 bg-navy p-3 rounded-xl border border-divider">
              <div>
                <p className="text-gray-500 text-xs font-bold uppercase mb-1">Moves Taken</p>
                <p className="text-white font-mono text-lg">{movesTaken}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-xs font-bold uppercase mb-1">3★ Optimal</p>
                <p className="text-gold font-mono text-lg">≤ {config?.optimalMoves}</p>
              </div>
              <div className="text-right">
                <p className="text-gray-500 text-xs font-bold uppercase mb-1">Stars Left</p>
                <p className="text-white font-mono text-lg">
                  {starsToCapture.length > 0 ? `${starsToCapture.length} ⭐` : "—"}
                </p>
              </div>
            </div>

            {/* Completed */}
            {status === "completed" && (() => {
              const currentStageIdx = activeCategory ? activeCategory.stages.findIndex((s) => s.name === activeStage.name) : -1;
              const nextStage = activeCategory && currentStageIdx !== -1 ? activeCategory.stages[currentStageIdx + 1] : null;

              const currentCategoryIdx = activeCategory ? LEARN_DATA.findIndex((c) => c.name === activeCategory.name) : -1;
              const nextCategory = currentCategoryIdx !== -1 ? LEARN_DATA[currentCategoryIdx + 1] : null;

              return (
                <div className="bg-green-900/30 border border-green-700/50 rounded-xl p-4 mb-4 text-center animate-slideUp">
                  <h3 className="text-green-400 font-bold text-lg mb-2">🎉 Level Complete!</h3>
                  <div className="flex justify-center gap-2 mb-4">
                    {renderStars(starsEarned)}
                  </div>
                  <p className="text-gray-400 text-sm mb-4">
                    {starsEarned === 3
                      ? "Perfect! You found the optimal solution."
                      : starsEarned === 2
                      ? "Great work! Try again for a perfect score."
                      : "Level cleared! Practice for more stars."}
                  </p>
                  {activeLevel < maxLevels ? (
                    <button
                      onClick={() => startLevel(activeLevel + 1)}
                      className="btn-gold w-full py-2"
                    >
                      Next Level →
                    </button>
                  ) : nextStage ? (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => startLevel(1, nextStage)}
                        className="btn-gold w-full py-2"
                      >
                        Next Stage: {nextStage.name} →
                      </button>
                      <button
                        onClick={() => setSearchParams({ category: activeCategory?.name || "" })}
                        className="btn-outline-gold w-full py-2"
                      >
                        ← Back to Stage
                      </button>
                    </div>
                  ) : nextCategory ? (
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => {
                          setSearchParams({
                            category: nextCategory.name,
                            stage: nextCategory.stages[0].name,
                            level: "1",
                          });
                        }}
                        className="btn-gold w-full py-2"
                      >
                        Next Category: {nextCategory.name} →
                      </button>
                      <button
                        onClick={() => setSearchParams({ category: activeCategory?.name || "" })}
                        className="btn-outline-gold w-full py-2"
                      >
                        ← Back to Stage
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setSearchParams({ category: activeCategory?.name || "" })}
                      className="btn-outline-gold w-full py-2"
                    >
                      ← Back to Stage
                    </button>
                  )}
                </div>
              );
            })()}

            {/* Failed */}
            {status === "failed" && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-4 mb-4 text-center animate-slideUp">
                <h3 className="text-red-400 font-bold mb-1">Incorrect Move</h3>
                <p className="text-gray-400 text-sm mb-4">
                  That's not the right square. Try the puzzle again!
                </p>
                <button
                  onClick={resetLevel}
                  className="btn-danger w-full py-2"
                >
                  Retry Level ↺
                </button>
              </div>
            )}

            {/* Ready */}
            {status === "ready" && (
              <button
                onClick={resetLevel}
                className="w-full py-2 text-gray-500 hover:text-white transition-colors text-sm border border-divider rounded-xl hover:border-gold"
              >
                Restart Level ↺
              </button>
            )}
          </div>

          {/* Hint card */}
          {status === "ready" && starsToCapture.length > 0 && (
            <div className="mt-4 bg-navy border border-gold/20 rounded-xl p-4">
              <p className="text-gold text-xs font-bold uppercase mb-1">💡 How to Play</p>
              <p className="text-gray-400 text-sm">
                Move your piece to all the <strong className="text-gold">⭐ star squares</strong> on the board.
                Try to do it in <strong className="text-white">{config?.optimalMoves} moves</strong> for a perfect 3-star score.
              </p>
            </div>
          )}
          {status === "ready" && config?.answerMove && (
            <div className="mt-4 bg-navy border border-gold/20 rounded-xl p-4">
              <p className="text-gold text-xs font-bold uppercase mb-1">💡 How to Play</p>
              <p className="text-gray-400 text-sm">
                Find the <strong className="text-white">correct move</strong> for this position.
                Click your piece, then click the destination square.
              </p>
            </div>
          )}
        </div>

        {/* ── Board ── */}
        <div className="w-full lg:w-[500px] max-w-[500px] mx-auto order-1 lg:order-2">
          <div className="relative w-full aspect-square">
            <PuzzleBoard
              position={boardPosition}
              onMove={onMove}
              starSquares={starsToCapture}
              orientation="white"
              disabled={status === "completed" || status === "failed"}
            />
          </div>
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 2 — Stage selection
  // ══════════════════════════════════════════════════════════════════════════
  if (activeCategory) {
    return (
      <div className="animate-fadeIn">
        <button
          onClick={() => setSearchParams({})}
          className="text-gray-400 hover:text-white flex items-center gap-2 mb-6 text-sm font-semibold"
        >
          ← Back to Categories
        </button>

        <h2 className="text-white font-bold text-2xl mb-2">{activeCategory.name}</h2>
        <p className="text-gray-400 mb-8">Select a stage to begin your training.</p>

        {!progressLoaded && (
          <p className="text-gray-500 text-sm mb-4 animate-pulse">Loading your progress…</p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {activeCategory.stages.map((stage) => {
            const stars = getStageStars(stage);
            const maxStars = stage.levels.length * 3;
            const pct = Math.round((stars / maxStars) * 100);

            return (
              <div key={stage.name} className="bg-navy border border-divider rounded-2xl p-6 shadow-lg">
                <h3 className="text-lg font-bold text-white mb-1">{stage.name}</h3>
                <p className="text-gray-400 text-sm mb-5 min-h-[40px]">{stage.description}</p>

                {/* Stage progress bar */}
                <div className="flex items-center gap-3 mb-5">
                  <span className="text-gold font-bold text-sm shrink-0">★ {stars}/{maxStars}</span>
                  <div className="flex-1 h-1.5 bg-navy-mid rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold-light to-gold rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-gray-500 text-xs w-8 text-right">{pct}%</span>
                </div>

                {/* Level buttons */}
                <div className="grid grid-cols-3 gap-2">
                  {stage.levels.map((level) => {
                    const lvlStars = getProgress(stage.name, level.level);
                    // Lock logic: level 1 is always unlocked; level N requires level N-1 completed (> 0 stars)
                    const isUnlocked = level.level === 1 || getProgress(stage.name, level.level - 1) > 0;

                    return (
                      <button
                        key={level.level}
                        disabled={!isUnlocked}
                        onClick={() => {
                          startLevel(level.level, stage);
                        }}
                        className={`py-2 rounded-lg border text-sm font-bold transition-all relative ${
                          lvlStars === 3
                            ? "bg-gold/10 border-gold/50 text-gold hover:bg-gold/20"
                            : lvlStars > 0
                            ? "bg-green-900/20 border-green-700/50 text-green-400 hover:bg-green-900/40"
                            : isUnlocked
                            ? "bg-navy-mid border-divider text-white hover:border-gold hover:text-gold"
                            : "bg-navy-mid/30 border-divider/20 text-gray-600 cursor-not-allowed opacity-50"
                        }`}
                      >
                        {isUnlocked ? (
                          <>
                            {level.level}
                            {lvlStars > 0 && (
                              <span className="absolute -top-1 -right-1 text-[9px] leading-none">
                                {"★".repeat(lvlStars)}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-xs">🔒</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 3 — Category selection (home)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="animate-fadeIn">
      <div className="mb-8">
        <h2 className="text-white font-bold text-xl mb-1">Interactive Learning</h2>
        <p className="text-gray-400 text-sm">
          Master chess fundamentals through interactive puzzles and challenges.
          {!progressLoaded && (
            <span className="ml-2 text-gold animate-pulse text-xs">Loading progress…</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {LEARN_DATA.map((category) => {
          const totalLevels = category.stages.reduce((acc, stage) => acc + stage.levels.length, 0);
          const totalMaxStars = totalLevels * 3;
          const totalEarnedStars = category.stages.reduce(
            (acc, stage) => acc + getStageStars(stage),
            0,
          );
          const progressPercent = Math.round((totalEarnedStars / totalMaxStars) * 100) || 0;
          const meta = CATEGORY_META[category.name];

          return (
            <button
              key={category.name}
              onClick={() => setSearchParams({ category: category.name })}
              className="flex flex-col text-left bg-navy hover:bg-navy-mid border border-divider hover:border-gold shadow-lg hover:shadow-gold/10 rounded-2xl overflow-hidden transition-all group"
            >
              {/* Banner Image */}
              <div className="h-44 relative w-full overflow-hidden border-b border-divider group-hover:border-gold/30">
                {meta?.image ? (
                  <img
                    src={meta.image}
                    alt={category.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full bg-gradient-to-br from-navy to-black flex items-center justify-center">
                    <span className="text-5xl">♟</span>
                  </div>
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                {/* Name + badge pinned to bottom */}
                <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                  <h3 className="text-white font-bold text-lg leading-snug drop-shadow-lg group-hover:text-gold transition-colors">
                    {category.name}
                  </h3>
                  <div className="shrink-0">
                    <Badge variant="gold">{totalLevels} Levels</Badge>
                  </div>
                </div>
              </div>

              <div className="p-5 flex flex-col flex-1 w-full">
                {/* Description */}
                {meta?.description && (
                  <p className="text-gray-400 text-sm leading-relaxed mb-4">{meta.description}</p>
                )}

                {/* Progress bar */}
                <div className="mt-auto">
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-black rounded-full overflow-hidden shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-gold-light to-gold rounded-full transition-all"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="text-gold font-bold text-xs w-8 text-right">
                      {progressPercent}%
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
