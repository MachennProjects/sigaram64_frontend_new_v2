import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Chess } from 'chess.js';
import { useAuth } from '../../../context/AuthContext';
import { Crown, Badge } from '../../ui';
import ChessBoard from '../../chess/ChessBoard';
import { assessmentApi } from '../../../api/assessmentApi';
import { updateUser } from '../../../firebase/firestoreService';

// ─── Types ────────────────────────────────────────────────────────────────────

type Lang = 'english' | 'tamil';
type EntryType = 'new_player' | 'has_rating' | 'fide_import' | 'chesscom_import' | 'lichess_import';

type Phase =
  | 'welcome'        // Welcome screen — same design as before
  | 'entry_select'   // Pick entry category (new / has_rating / import)
  | 'rules_gate'     // 3 interactive board tasks (beginners only)
  | 'cat_loop'       // Adaptive puzzle loop
  | 'bloom4_probe'   // Bloom 4 conceptual question
  | 'bloom5_probe'   // Bloom 5 game replay evaluation
  | 'submitting'     // Spinner while saving
  | 'results';       // Final results screen (same design as before)

interface CATProfile {
  overallElo: number;
  ratingDeviation: number;
  openings: { elo: number; bloom: number; weakMotifs: string[] };
  middlegame: { elo: number; bloom: number; weakMotifs: string[] };
  endgame: { elo: number; bloom: number; weakMotifs: string[] };
  bloomOverall: number;
  puzzlesAttempted: number;
  puzzlesSolved: number;
  timeTaken: string;
  playerCategory: string;
  aiLevel: number;
  // Rules gate metadata — only set when assessment ended at gate (not CAT loop)
  isRulesGateFail?: boolean;
  rulesGateCorrect?: number;
}

// ─── Rules Gate Board — matches existing ChessBoard design exactly ────────────
// Uses same colors (#805E4B dark / #D8B384 light) and Lichess SVG pieces.

const RB_FILES = ['a','b','c','d','e','f','g','h'];
const RB_RANKS = ['8','7','6','5','4','3','2','1'];

// piece code → Lichess SVG path fragment, e.g. 'wN', 'bK'
const PIECE_SVG: Record<string, string> = {
  '♔': 'wK', '♕': 'wQ', '♖': 'wR', '♗': 'wB', '♘': 'wN', '♙': 'wP',
  '♚': 'bK', '♛': 'bQ', '♜': 'bR', '♝': 'bB', '♞': 'bN', '♟': 'bP',
};

function RulesBoard({
  pieces,
  onSquareClick,
  highlighted = [],
  selected = null,
}: {
  pieces: Record<string, string>;
  onSquareClick: (sq: string) => void;
  highlighted?: string[];
  selected?: string | null;
}) {
  return (
    <div className="w-full max-w-[300px] select-none">
      <div
        className="relative rounded-xl overflow-hidden shadow-2xl border border-[#805e4b]/30"
        style={{ width: '100%', aspectRatio: '1 / 1' }}
      >
        <div className="grid grid-cols-8 grid-rows-[repeat(8,1fr)] w-full h-full">
          {RB_RANKS.map((r, ri) =>
            RB_FILES.map((f, fi) => {
              const sq = f + r;
              const isDark = (ri + fi) % 2 !== 0;
              const baseBg = isDark ? '#805E4B' : '#D8B384';
              const piece = pieces[sq];
              const svgCode = piece ? PIECE_SVG[piece] : null;
              const isHighlighted = highlighted.includes(sq);
              const isSelected = selected === sq;
              return (
                <div
                  key={sq}
                  onClick={() => onSquareClick(sq)}
                  className="relative flex items-center justify-center cursor-pointer transition-colors duration-150"
                  style={{ backgroundColor: baseBg }}
                >
                  {/* Highlighted (knight target) overlay */}
                  {isHighlighted && (
                    <div className="absolute inset-0 pointer-events-none z-10"
                      style={{ background: 'rgba(74,222,128,0.45)', boxShadow: 'inset 0 0 0 3px #4ade80' }}
                    />
                  )}
                  {/* Selected overlay */}
                  {isSelected && (
                    <div className="absolute inset-0 pointer-events-none z-10"
                      style={{
                        boxShadow: 'inset 0 0 0 3px #C9A84C, inset 0 0 12px rgba(201,168,76,0.5)',
                        background: 'rgba(201,168,76,0.25)',
                      }}
                    />
                  )}
                  {/* Piece SVG */}
                  {svgCode && (
                    <div className="absolute inset-0 flex items-center justify-center z-20 pointer-events-none">
                      <img
                        src={`https://lichess1.org/assets/piece/cburnett/${svgCode}.svg`}
                        alt={svgCode}
                        className="w-[88%] h-[88%] object-contain select-none"
                      />
                    </div>
                  )}
                  {/* File label (bottom row) */}
                  {ri === 7 && (
                    <span
                      className="absolute bottom-[2px] right-[3px] text-[10px] font-bold pointer-events-none z-30 leading-none"
                      style={{ color: isDark ? '#D8B384' : '#805E4B' }}
                    >{f}</span>
                  )}
                  {/* Rank label (left col) */}
                  {fi === 0 && (
                    <span
                      className="absolute top-[2px] left-[3px] text-[10px] font-bold pointer-events-none z-30 leading-none"
                      style={{ color: isDark ? '#D8B384' : '#805E4B' }}
                    >{r}</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ChessAssessment() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuth();

  // Language — same persistence as before
  const [language, setLanguage] = useState<Lang>(() => {
    const saved = sessionStorage.getItem('sigaram64_quiz_lang');
    return (saved === 'english' || saved === 'tamil') ? saved : 'english';
  });

  useEffect(() => {
    const handleToggle = () => setLanguage(l => l === 'english' ? 'tamil' : 'english');
    window.addEventListener('toggle-quiz-lang', handleToggle);
    return () => window.removeEventListener('toggle-quiz-lang', handleToggle);
  }, []);

  useEffect(() => {
    sessionStorage.setItem('sigaram64_quiz_lang', language);
    window.dispatchEvent(new CustomEvent('quiz-lang-changed', { detail: language }));
  }, [language]);

  const lang = language === 'english' ? 'en' : 'ta';

  // ── Phase state ──────────────────────────────────────────────────────────────
  const [phase, setPhase] = useState<Phase>('welcome');

  // ── Entry selection ──────────────────────────────────────────────────────────
  const [entryType, setEntryType] = useState<EntryType>('new_player');
  const [importedRating, setImportedRating] = useState<string>('1200');

  // ── Backend session ──────────────────────────────────────────────────────────
  const [assessmentId, setAssessmentId] = useState<string>('');
  const [currentPuzzle, setCurrentPuzzle] = useState<any>(null);
  const [currentEstimate, setCurrentEstimate] = useState<number>(1000);
  const [puzzleCount, setPuzzleCount] = useState<number>(0);

  // ── Guest mode — track guestId for all backend requests ──────────────────────
  const [guestId, setGuestId] = useState<string | null>(null);
  const guestIdRef = useRef<string | null>(null); // ref for use in async callbacks

  // ── Guest info modal state (name + email collection before results) ───────────
  const [showGuestInfoModal, setShowGuestInfoModal] = useState<boolean>(false);
  const [guestInfoName, setGuestInfoName] = useState<string>('');
  const [guestInfoEmail, setGuestInfoEmail] = useState<string>('');
  const [guestInfoError, setGuestInfoError] = useState<string>('');
  const [guestInfoSaving, setGuestInfoSaving] = useState<boolean>(false);

  // Pending results — held until guest info is collected
  const [pendingProfile, setPendingProfile] = useState<CATProfile | null>(null);

  // ── CAT puzzle loop board state ───────────────────────────────────────────────
  const [boardPosition, setBoardPosition] = useState<string>('start');
  const [game, setGame] = useState<Chess>(new Chess());
  const [correctMoves, setCorrectMoves] = useState<string[]>([]);
  const [moveIndex, setMoveIndex] = useState<number>(0);
  const [puzzleStatus, setPuzzleStatus] = useState<'solving' | 'correct' | 'wrong'>('solving');
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(null);
  const [hintLevel, setHintLevel] = useState<number>(0);
  const [timeLeft, setTimeLeft] = useState<number>(90);
  const [startTime, setStartTime] = useState<number>(Date.now());
  const timerRef = useRef<any>(null);
  const [warningMessage, setWarningMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // Ref mirrors to avoid stale closures inside timer callbacks
  const isSubmittingRef = useRef<boolean>(false);
  const puzzleStatusRef = useRef<'solving' | 'correct' | 'wrong'>('solving');
  const submitPuzzleResultRef = useRef<((correct: boolean) => Promise<void>) | undefined>(undefined);

  // ── Rules gate state ─────────────────────────────────────────────────────────
  const [ruleTask, setRuleTask] = useState<1 | 2 | 3>(1);
  const [knightTapped, setKnightTapped] = useState<string[]>([]);
  const knightTargets = ['b3','b5','c2','c6','e2','e6','f3','f5'];
  const [checkmateChoice, setCheckmateChoice] = useState<string | null>(null);
  const [ruleTask2Anim, setRuleTask2Anim] = useState<boolean>(false);
  const [bishopSelected, setBishopSelected] = useState<boolean>(false);
  const [bishopCaptured, setBishopCaptured] = useState<boolean>(false);
  const [task1Passed, setTask1Passed] = useState<boolean>(false);
  const [task2Passed, setTask2Passed] = useState<boolean>(false);
  const [task3Passed, setTask3Passed] = useState<boolean>(false);

  // ── Bloom probes ─────────────────────────────────────────────────────────────
  const [bloom4Done, setBloom4Done] = useState<boolean>(false);
  const [bloom5Done, setBloom5Done] = useState<boolean>(false);
  const [bloom4Answer, setBloom4Answer] = useState<string | null>(null);
  const [bloom5Move, setBloom5Move] = useState<number>(11);
  const [bloom5Reason, setBloom5Reason] = useState<string>('');
  const [pendingNextPuzzle, setPendingNextPuzzle] = useState<any>(null);

  // ── Results state (mirrors old design) ───────────────────────────────────────
  const [profile, setProfile] = useState<CATProfile | null>(null);
  const [animatedElo, setAnimatedElo] = useState<number>(800);

  // ── Beginner (lessons) notification ─────────────────────────────────────────
  const [showBeginnerNotif, setShowBeginnerNotif] = useState<boolean>(false);

  // ─── Timer ────────────────────────────────────────────────────────────────────
  // FIX: Use a ref-based pattern to avoid stale closure — the timer always calls
  // the latest version of submitPuzzleResult via submitPuzzleResultRef.

  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTimeLeft(90);
    setStartTime(Date.now());
    puzzleStatusRef.current = 'solving';
    isSubmittingRef.current = false;
    timerRef.current = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          // Use ref to call the latest version — avoids stale closure
          if (puzzleStatusRef.current === 'solving' && !isSubmittingRef.current) {
            puzzleStatusRef.current = 'wrong';
            setPuzzleStatus('wrong');
            setWarningMessage(
              sessionStorage.getItem('sigaram64_quiz_lang') === 'tamil'
                ? 'நேரம் முடிந்தது! அடுத்த புதிருக்கு செல்கிறது.'
                : 'Time up! Moving to next puzzle.'
            );
            setTimeout(() => submitPuzzleResultRef.current?.(false), 1200);
          }
          return 0;
        }
        return t - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // ─── Load puzzle into board ───────────────────────────────────────────────────

  // Locked to the initial puzzle FEN — does NOT change as moves are made
  const [puzzleTurn, setPuzzleTurn] = useState<'w' | 'b'>('w');
  const puzzleOrientation: 'white' | 'black' = puzzleTurn === 'b' ? 'black' : 'white';

  const loadPuzzle = useCallback((puzzle: any) => {
    if (!puzzle) return;
    const g = new Chess();
    try { g.load(puzzle.fen); } catch { g.reset(); }
    setGame(g);
    setBoardPosition(puzzle.fen);
    setMoveIndex(0);
    setPuzzleStatus('solving');
    puzzleStatusRef.current = 'solving';
    setLastMove(null);
    setHintLevel(0);
    setWarningMessage('');
    isSubmittingRef.current = false;
    // Lock orientation to the initial puzzle side-to-move
    setPuzzleTurn(g.turn());
    // parse solution UCI list
    const moves: string[] = puzzle.solutionUci || [];
    setCorrectMoves(moves);
  }, []);

  useEffect(() => {
    if (phase === 'cat_loop' && currentPuzzle) {
      loadPuzzle(currentPuzzle);
      startTimer();
    }
  }, [phase, currentPuzzle]);

  // ─── Handle board move ────────────────────────────────────────────────────────

  const handleBoardMove = useCallback((from: string, to: string, promotion?: string): boolean => {
    if (puzzleStatusRef.current !== 'solving') return false;
    const expected = correctMoves[moveIndex];
    if (!expected) return false;

    const expectedFrom = expected.slice(0, 2);
    const expectedTo = expected.slice(2, 4);

    if (from !== expectedFrom || to !== expectedTo) {
      puzzleStatusRef.current = 'wrong';
      setPuzzleStatus('wrong');
      if (timerRef.current) clearInterval(timerRef.current);
      setWarningMessage(language === 'english' ? 'Wrong move! That is not the correct move.' : 'தவறான நகர்வு! அது சரியான நகர்வு அல்ல.');
      setTimeout(() => submitPuzzleResultRef.current?.(false), 1200);
      return false;
    }

    // Apply move
    const move = game.move({ from, to, promotion: promotion || 'q' });
    if (!move) return false;
    setLastMove({ from, to });
    setBoardPosition(game.fen());
    const nextIdx = moveIndex + 1;

    if (nextIdx >= correctMoves.length) {
      puzzleStatusRef.current = 'correct';
      setPuzzleStatus('correct');
      if (timerRef.current) clearInterval(timerRef.current);
      setTimeout(() => submitPuzzleResultRef.current?.(true), 800);
    } else {
      setMoveIndex(nextIdx);
    }
    return true;
  }, [game, moveIndex, correctMoves, language]);

  // handleTimeout is no longer needed — the timer callback now calls
  // submitPuzzleResultRef.current directly to avoid stale closures.

  // ─── Submit puzzle result to backend ─────────────────────────────────────────

  async function submitPuzzleResult(correct: boolean) {
    if (isSubmittingRef.current || !currentPuzzle || !assessmentId) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    try {
      const res = await assessmentApi.submitPuzzleResponse(assessmentId, {
        puzzleId: currentPuzzle.id,
        correct,
        timeTakenSec: elapsed,
        guestId: guestIdRef.current ?? undefined,
      }) as any;

      isSubmittingRef.current = false;
      setIsSubmitting(false);
      const newCount = puzzleCount + 1;
      setPuzzleCount(newCount);

      if (res.finished || res.status === 'completed') {
        await saveResults(res.profile);
        return;
      }

      const est = res.currentEstimate || currentEstimate;
      setCurrentEstimate(est);

      // Bloom probe triggers
      if (est >= 1400 && !bloom4Done) {
        setPendingNextPuzzle(res.nextPuzzle);
        setPhase('bloom4_probe');
        return;
      }
      if (est >= 1700 && !bloom5Done) {
        setPendingNextPuzzle(res.nextPuzzle);
        setPhase('bloom5_probe');
        return;
      }

      setCurrentPuzzle(res.nextPuzzle);
    } catch (err) {
      console.error('Failed to submit puzzle:', err);
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  }

  // Keep ref in sync so timer can always call the latest version
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { submitPuzzleResultRef.current = submitPuzzleResult; });

  // ─── Save results ─────────────────────────────────────────────────────────────

  async function saveResults(p: CATProfile) {
    if (user?.id && user.id !== 'GUEST') {
      // Logged-in student: save immediately to backend
      try {
        await updateUser(user.id, {
          quizCompleted: true,
          assessmentCompleted: true,
          rating: p.overallElo,
          playerCategory: p.playerCategory,
          aiLevel: p.aiLevel,
        });
        await refreshUser();
      } catch (e) {
        console.error('Error saving assessment results:', e);
      }
      setProfile(p);
      setPhase('submitting');
      setTimeout(() => setPhase('results'), 1600);
    } else {
      // Guest: store pending result in localStorage for post-login save
      // Then show guest info modal to collect name + email
      const pendingData = {
        profile: p,
        assessmentId,
        guestId: guestIdRef.current,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem('sigaram64_pending_assessment', JSON.stringify(pendingData));
      setPendingProfile(p);
      setShowGuestInfoModal(true);
    }
  }

  // ─── Animated ELO counter (same as old design) ────────────────────────────────

  useEffect(() => {
    if (phase === 'results' && profile) {
      const endElo = profile.overallElo;
      const start = 800;
      const duration = 1500;
      const steps = 60;
      const stepTime = duration / steps;
      let step = 0;
      const timer = setInterval(() => {
        step++;
        const progress = step / steps;
        const current = Math.floor(start + (endElo - start) * (1 - Math.pow(1 - progress, 2)));
        setAnimatedElo(step >= steps ? endElo : current);
        if (step >= steps) clearInterval(timer);
      }, stepTime);
      return () => clearInterval(timer);
    }
  }, [phase, profile]);

  // ─── Go to Lessons (beginner path) ───────────────────────────────────────────

  async function handleGoToLessons() {
    // Save base ELO 200 for students who don't know chess yet
    try {
      if (user?.id && user.id !== 'GUEST') {
        await updateUser(user.id, {
          quizCompleted: true,
          assessmentCompleted: false,
          rating: 200,
          playerCategory: 'Beginner',
          aiLevel: 1,
        });
        await refreshUser();
      }
    } catch (e) {
      console.error('Error saving beginner ELO:', e);
    }
    setShowBeginnerNotif(true);
  }

  // ─── Start assessment via API ─────────────────────────────────────────────────

  async function handleBeginAssessment() {
    try {
      const rating = ['fide_import','chesscom_import','lichess_import'].includes(entryType)
        ? Number(importedRating) || 1000
        : undefined;

      const res = await assessmentApi.startAssessment({
        language: lang,
        entryType,
        importedRating: rating,
      }) as any;

      setAssessmentId(res.assessmentId);

      // Capture guestId from backend response if user is not logged in
      if (!user && res.guestId) {
        setGuestId(res.guestId);
        guestIdRef.current = res.guestId;
      }

      if (res.status === 'rules_gate') {
        setPhase('rules_gate');
      } else {
        setCurrentPuzzle(res.nextPuzzle);
        setPhase('cat_loop');
      }
    } catch (err) {
      console.error('Failed to start assessment:', err);
    }
  }

  // ─── Guest info modal submit ──────────────────────────────────────────────────

  async function handleGuestInfoSubmit() {
    if (!guestInfoName.trim()) { setGuestInfoError('Please enter your name.'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guestInfoEmail.trim())) { setGuestInfoError('Please enter a valid email address.'); return; }
    setGuestInfoError('');
    setGuestInfoSaving(true);
    try {
      await assessmentApi.saveGuestInfo(assessmentId, {
        guestId: guestIdRef.current!,
        guestName: guestInfoName.trim(),
        guestEmail: guestInfoEmail.trim(),
      });
    } catch (e) {
      console.error('Failed to save guest info:', e);
    } finally {
      setGuestInfoSaving(false);
    }
    // Show results
    setShowGuestInfoModal(false);
    setProfile(pendingProfile);
    setPhase('submitting');
    setTimeout(() => setPhase('results'), 1600);
  }

  // ─── Rules Gate ───────────────────────────────────────────────────────────────

  function handleTask1Click(sq: string) {
    if (sq === 'd4') return;
    setKnightTapped(prev => prev.includes(sq) ? prev.filter(x => x !== sq) : [...prev, sq]);
  }

  function handleTask1Submit() {
    const correct = knightTargets.filter(t => knightTapped.includes(t)).length;
    const wrong = knightTapped.filter(t => !knightTargets.includes(t)).length;
    setTask1Passed(correct === 8 && wrong === 0);
    setRuleTask(2);
  }

  function handleTask2Pick(choice: 'checkmate' | 'stalemate') {
    setCheckmateChoice(choice);
    setTask2Passed(choice === 'checkmate');
    setRuleTask2Anim(true);
    setTimeout(() => setRuleTask(3), 1000);
  }

  function handleTask3Click(sq: string) {
    if (bishopCaptured) return;
    if (sq === 'c3') { setBishopSelected(true); return; }
    if (sq === 'e5' && bishopSelected) {
      setBishopCaptured(true);
      setTask3Passed(true);
      return;
    }
    setBishopSelected(false);
  }

  async function handleRulesGateSubmit() {
    try {
      const res = await assessmentApi.submitRulesGate(assessmentId, {
        knightMoves: task1Passed,
        checkmateVsStalemate: task2Passed,
        captureFreePiece: task3Passed,
        guestId: guestIdRef.current ?? undefined,
      });

      if (res.passed) {
        setCurrentPuzzle(res.nextPuzzle);
        setPhase('cat_loop');
      } else {
        // Failed — assign ELO 400, show results
        const failProfile: CATProfile = {
          overallElo: 400,
          ratingDeviation: 350,
          openings: { elo: 0, bloom: 1, weakMotifs: ['basic_rules'] },
          middlegame: { elo: 0, bloom: 1, weakMotifs: ['basic_rules'] },
          endgame: { elo: 0, bloom: 1, weakMotifs: ['basic_rules'] },
          bloomOverall: 1,
          puzzlesAttempted: 3,
          puzzlesSolved: 0,
          timeTaken: '—',
          playerCategory: 'Basic Level Player',
          aiLevel: 1,
          isRulesGateFail: true,
          rulesGateCorrect: [task1Passed, task2Passed, task3Passed].filter(Boolean).length,
        };
        const backendProfile = res.profile || failProfile;
        // Use saveResults so guests go through modal flow too
        await saveResults(backendProfile);
        if (user) setPhase('results'); // guest flow handled inside saveResults
      }
    } catch (err) {
      console.error('Rules gate error:', err);
    }
  }

  // ─── Bloom 4 submit ───────────────────────────────────────────────────────────

  async function handleBloom4Submit() {
    if (!bloom4Answer) return;
    try {
      await fetch(`/api/assessment/${assessmentId}/bloom-probe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sigaram64_token')}`,
        },
        body: JSON.stringify({ probeType: 'bloom4', answer: bloom4Answer, correct: bloom4Answer === 'B' }),
      });
    } catch {}
    setBloom4Done(true);
    setCurrentPuzzle(pendingNextPuzzle);
    setPendingNextPuzzle(null);
    setPhase('cat_loop');
  }

  // ─── Bloom 5 submit ───────────────────────────────────────────────────────────

  async function handleBloom5Submit() {
    if (!bloom5Reason.trim()) return;
    try {
      await fetch(`/api/assessment/${assessmentId}/bloom-probe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sigaram64_token')}`,
        },
        body: JSON.stringify({ probeType: 'bloom5', selectedMove: bloom5Move, reason: bloom5Reason, correct: bloom5Move === 11 }),
      });
    } catch {}
    setBloom5Done(true);
    setCurrentPuzzle(pendingNextPuzzle);
    setPendingNextPuzzle(null);
    setPhase('cat_loop');
  }

  // ─── Bloom 5 moves replay data ────────────────────────────────────────────────

  const bloom5Moves = [
    { num: 1, move: '1. e4',      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1' },
    { num: 2, move: '1... e5',    fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2' },
    { num: 3, move: '2. Nf3',     fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2' },
    { num: 4, move: '2... Nc6',   fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3' },
    { num: 5, move: '3. Bc4',     fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK1NR b KQkq - 3 3' },
    { num: 6, move: '3... Bc5',   fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4' },
    { num: 7, move: '4. c3',      fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R b KQkq - 0 4' },
    { num: 8, move: '4... Nf6',   fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R w KQkq - 1 5' },
    { num: 9, move: '5. d4',      fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2BPP3/2P2N2/PP3PPP/RNBQK2R b KQkq - 0 5' },
    { num: 10, move: '5... exd4', fen: 'r1bqk2r/pppp1ppp/2n2n2/2b5/2BPP3/2P2N2/PP3PPP/RNBQK2R w KQkq - 0 6' },
    { num: 11, move: '6. cxd4',   fen: 'r1bqk2r/pppp1ppp/2n2n2/2b5/2BPP3/5N2/PP3PPP/RNBQK2R b KQkq - 0 6' },
    { num: 12, move: '6... Bb4+', fen: 'r1bqk2r/pppp1ppp/2n2n2/8/1bBPP3/5N2/PP3PPP/RNBQK2R w KQkq - 1 7' },
    { num: 13, move: '7. Bd2',    fen: 'r1bqk2r/pppp1ppp/2n2n2/8/1bBPP3/5N2/PP1B1PPP/RN1QK2R b KQkq - 2 7' },
    { num: 14, move: '7... Bxd2+',fen: 'r1bqk2r/pppp1ppp/2n2n2/8/3PP3/5N2/PP1b1PPP/RN1QK2R w KQkq - 0 8' },
    { num: 15, move: '8. Nbxd2',  fen: 'r1bqk2r/pppp1ppp/2n2n2/8/3PP3/5N2/PP1N1PPP/R2QK2R b KQkq - 0 8' },
  ];
  const bloom5CurrentFen = bloom5Moves.find(m => m.num === bloom5Move)?.fen || bloom5Moves[0].fen;
  const bloom5CurrentMove = bloom5Moves.find(m => m.num === bloom5Move)?.move || '';

  // ─── Texts ────────────────────────────────────────────────────────────────────

  const txt = {
    english: {
      welcomeTitle: 'Welcome, Champion!',
      welcomeSub: 'A smart adaptive assessment that finds your exact chess level in 3–12 minutes.',
      assessInfo: 'Assessment Info',
      bullet1: '8–18 adaptive puzzles — difficulty adjusts to your answers',
      bullet2: 'Interactive board — click or drag pieces (no notation typing)',
      bullet3: 'Bilingual: switch Tamil ↔ English anytime',
      knowChess: 'Do you know how to play chess?',
      yesStart: "Yes, let's start",
      noLearn: 'No, I want to learn',
      entryTitle: 'Select your entry type',
      entrySub: 'Choose how you want to begin the assessment.',
      optNew: 'New Player (I need a rules check first)',
      optRated: 'I know the rules (start at ELO 1000)',
      optFide: 'Import FIDE Rating',
      optChesscom: 'Import Chess.com Rating',
      optLichess: 'Import Lichess Rating',
      ratingLabel: 'Enter your current rating:',
      begin: 'Begin Assessment',
      gateTitle: 'Rules Gate',
      gateSub: '3 quick board tasks to verify basic knowledge.',
      task1Title: 'Task 1: Knight Moves',
      task1Desc: 'A knight is on d4. Tap all 8 squares it can jump to.',
      task2Title: 'Task 2: Checkmate vs Stalemate',
      task2Desc: 'Look at this position. Is the Black king in Checkmate or Stalemate?',
      checkmate: 'Checkmate',
      stalemate: 'Stalemate',
      task3Title: 'Task 3: Capture a Free Piece',
      task3Desc: 'White to move. Click the White bishop on c3, then capture the undefended Black bishop on e5.',
      continue: 'Continue',
      submitGate: 'Submit & Continue',
      correct: '✓ Correct!',
      wrong: '✗ Wrong',
      puzzle: 'Adaptive Puzzle',
      puzzleOf: 'Puzzle',
      puzzleInstr: 'White to move. Find the best move.',
      timeleft: 'Time',
      currentElo: 'Current Estimate',
      hint: 'Get Hint',
      showMove: 'Show Move',
      showing: 'Hint Active',
      skip: 'Skip Puzzle',
      analyzing: 'Analyzing Chess Intelligence...',
      analyzingSub: 'Building your learning profile from the data...',
      resultsTitle: 'Assessment Complete!',
      resultsSub: 'Here is your personalized chess profile.',
      yourElo: 'Your Chess ELO',
      domainTitle: 'Domain Strengths',
      openings: 'Openings',
      middlegame: 'Middlegame',
      endgame: 'Endgame',
      bloom: 'Bloom Level',
      dashboard: 'Go to Dashboard →',
      bloom4Title: 'Bloom 4: Strategic Analysis',
      bloom4Sub: 'Based on the position you just solved, choose the best explanation:',
      bloom4Q: 'After you played 1. Rxd8+, why does that move work?',
      bloom4A: 'The rook was undefended.',
      bloom4B: 'The queen was defending two pieces and could not handle both.',
      bloom4C: 'It was a discovered check.',
      bloom4D: 'The bishop on b2 was pinning a piece.',
      bloom4Submit: 'Submit Analysis',
      bloom5Title: 'Bloom 5: Game Evaluation',
      bloom5Sub: 'Replay the moves using the slider. Find the turning point where White\'s advantage shifted.',
      bloom5MoveLabel: 'Turning Point Move:',
      bloom5Reason: 'Briefly explain why that move shifted the advantage:',
      bloom5Ph: 'e.g., The knight on d5 dominated the center and restricted all Black pieces...',
      bloom5Submit: 'Submit Evaluation',
    },
    tamil: {
      welcomeTitle: 'வாழ்க, சாம்பியன்!',
      welcomeSub: 'ஒரு தகவமைப்பு மதிப்பீட்டு முறை — 3–12 நிமிடங்களில் உங்கள் சதுரங்க நிலையை கண்டறியும்.',
      assessInfo: 'மதிப்பீட்டு தகவல்',
      bullet1: '8–18 தகவமைப்பு புதிர்கள் — கஷ்டம் உங்கள் பதில்களுக்கு தகுந்தாற்போல் மாறும்',
      bullet2: 'இடைவினை பலகை — காய்களை கிளிக் அல்லது இழுக்கவும் (குறிப்பு தட்டச்சு இல்லை)',
      bullet3: 'இருமொழி: எந்த நேரத்திலும் தமிழ் ↔ ஆங்கிலம் மாற்றலாம்',
      knowChess: 'உங்களுக்கு சதுரங்கம் விளையாட தெரியுமா?',
      yesStart: 'ஆம், ஆரம்பிக்கலாம்',
      noLearn: 'இல்லை, நான் கற்க வேண்டும்',
      entryTitle: 'உங்கள் நுழைவு வகையை தேர்ந்தெடுக்கவும்',
      entrySub: 'மதிப்பீட்டை எப்படி தொடங்க வேண்டும் என்று தேர்ந்தெடுக்கவும்.',
      optNew: 'புதிய விளையாட்டாளர் (முதலில் விதி சரிபார்ப்பு தேவை)',
      optRated: 'விதிகள் தெரியும் (ELO 1000-ல் தொடங்கும்)',
      optFide: 'FIDE மதிப்பீடு இறக்குமதி',
      optChesscom: 'Chess.com மதிப்பீடு இறக்குமதி',
      optLichess: 'Lichess மதிப்பீடு இறக்குமதி',
      ratingLabel: 'உங்கள் தற்போதைய மதிப்பீட்டை உள்ளிடவும்:',
      begin: 'மதிப்பீட்டை தொடங்கு',
      gateTitle: 'விதிமுறை சரிபார்ப்பு',
      gateSub: '3 விரைவான பலகை பணிகள் — அடிப்படை அறிவை சரிபார்க்க.',
      task1Title: 'பணி 1: குதிரை நகர்வுகள்',
      task1Desc: 'குதிரை d4-ல் உள்ளது. அது செல்லக்கூடிய 8 கட்டங்களையும் தட்டவும்.',
      task2Title: 'பணி 2: செக்மேட் அல்லது ஸ்டேல்மேட்',
      task2Desc: 'இந்த நிலையைப் பாருங்கள். கருப்பு ராஜா செக்மேட்டில் உள்ளாரா அல்லது ஸ்டேல்மேட்டில் உள்ளாரா?',
      checkmate: 'செக்மேட்',
      stalemate: 'ஸ்டேல்மேட்',
      task3Title: 'பணி 3: இலவச காயை வெட்டுங்கள்',
      task3Desc: 'வெள்ளை நகர்வு. c3-ல் உள்ள வெள்ளை பிஷப்பை கிளிக் செய்து, e5-ல் பாதுகாப்பற்ற கருப்பு பிஷப்பை வெட்டவும்.',
      continue: 'தொடரவும்',
      submitGate: 'சமர்ப்பி & தொடரவும்',
      correct: '✓ சரி!',
      wrong: '✗ தவறு',
      puzzle: 'தகவமைப்பு புதிர்',
      puzzleOf: 'புதிர்',
      puzzleInstr: 'வெள்ளை நகர்வு. சிறந்த நகர்வை கண்டறியவும்.',
      timeleft: 'நேரம்',
      currentElo: 'தற்போதைய மதிப்பீடு',
      hint: 'குறிப்பு பெறு',
      showMove: 'நகர்வு காட்டு',
      showing: 'குறிப்பு செயலில்',
      skip: 'புதிரை தவிர்',
      analyzing: 'சதுரங்க திறனை ஆய்வு செய்கிறது...',
      analyzingSub: 'உங்கள் கற்றல் விவரத்தை உருவாக்குகிறது...',
      resultsTitle: 'மதிப்பீடு முடிந்தது!',
      resultsSub: 'இதோ உங்கள் தனிப்பட்ட சதுரங்க விவரம்.',
      yourElo: 'உங்கள் சதுரங்க ELO',
      domainTitle: 'பகுதி வலிமைகள்',
      openings: 'திறப்புகள்',
      middlegame: 'நடுவில் விளையாட்டு',
      endgame: 'கடை நிலை',
      bloom: 'புளூம் நிலை',
      dashboard: 'டாஷ்போர்டுக்கு செல்லவும் →',
      bloom4Title: 'புளூம் 4: மூலோபாய பகுப்பாய்வு',
      bloom4Sub: 'நீங்கள் இப்போது தீர்த்த புதிரின் அடிப்படையில் சரியான விளக்கத்தைத் தேர்ந்தெடுக்கவும்:',
      bloom4Q: 'நீங்கள் 1. Rxd8+ விளையாடிய பிறகு, அந்த நகர்வு ஏன் வேலை செய்தது?',
      bloom4A: 'கோட்டை பாதுகாக்கப்படவில்லை.',
      bloom4B: 'ராணி இரண்டு காய்களையும் பாதுகாத்து ஓவர்லோட் செய்யப்பட்டது.',
      bloom4C: 'அது ஒரு டிஸ்கவர்டு செக் ஆகும்.',
      bloom4D: 'b2-ல் உள்ள பிஷப் ஒரு காயை பின் செய்தது.',
      bloom4Submit: 'பகுப்பாய்வை சமர்ப்பி',
      bloom5Title: 'புளூம் 5: விளையாட்டு மதிப்பீடு',
      bloom5Sub: 'ஸ்லைடர் மூலம் நகர்வுகளை ரீப்ளே செய்யவும். வெள்ளையின் நன்மை மாறிய திருப்புமுனையை கண்டறியவும்.',
      bloom5MoveLabel: 'திருப்புமுனை நகர்வு:',
      bloom5Reason: 'அந்த நகர்வு நன்மையை எவ்வாறு மாற்றியது என்று சுருக்கமாக விளக்கவும்:',
      bloom5Ph: 'எ.கா., d5-ல் குதிரை மையத்தை ஆதிக்கம் செய்து கருப்பின் எல்லா காய்களையும் கட்டுப்படுத்தியது...',
      bloom5Submit: 'மதிப்பீட்டை சமர்ப்பி',
    },
  };
  const T = txt[language];

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="w-full flex-1 flex flex-col font-sans select-none overflow-y-auto">

      {/* ── Phase: Welcome — merged entry selection (3 paths per plan flowchart) ── */}
      {(phase === 'welcome' || phase === 'entry_select') && (
        <div className="flex-1 flex items-center justify-center px-4 py-6 md:py-8 animate-fadeIn">
          <div className="w-full max-w-[520px] card-glass relative overflow-hidden border-gold/20 shadow-2xl">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent" />

            {/* Header */}
            <div className="px-6 pt-7 pb-4 text-center">
              <div className="text-5xl animate-bounce mb-3">👑</div>
              <h1 className="text-3xl font-extrabold text-white mb-1 tracking-wide font-heading">{T.welcomeTitle}</h1>
              <p className="text-gray-400 text-sm">{T.welcomeSub}</p>
            </div>

            {/* Info strip */}
            <div className="mx-6 mb-5 bg-navy/60 rounded-xl px-4 py-3 border border-divider/40">
              <p className="text-gold-light text-[10px] font-bold uppercase tracking-wider mb-2">{T.assessInfo}</p>
              <ul className="space-y-1.5 text-[11px] text-gray-300">
                <li className="flex gap-2"><span className="text-green-400">✓</span><span>{T.bullet1}</span></li>
                <li className="flex gap-2"><span className="text-green-400">✓</span><span>{T.bullet2}</span></li>
                <li className="flex gap-2"><span className="text-green-400">✓</span><span>{T.bullet3}</span></li>
              </ul>
            </div>

            {/* 3 Path cards — horizontal grid */}
            <div className="px-6 mb-5">
              <p className="text-white font-bold text-sm text-center mb-3">
                {language === 'english' ? 'Select your entry path:' : 'உங்கள் நுழைவு பாதையை தேர்ந்தெடுக்கவும்:'}
              </p>

              {/* Horizontal 3-card row */}
              <div className="grid grid-cols-3 gap-3 mb-3">

                {/* Card 1: New Player */}
                <button
                  onClick={() => setEntryType('new_player')}
                  className={`flex flex-col items-center text-center border rounded-2xl px-2 py-4 gap-2 transition-all cursor-pointer ${
                    entryType === 'new_player'
                      ? 'bg-gold/15 border-gold shadow-lg shadow-gold/10'
                      : 'bg-navy-mid/60 border-divider hover:border-gold/40 hover:bg-navy-mid/80'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
                    entryType === 'new_player' ? 'bg-gold/20' : 'bg-navy border border-divider'
                  }`}>🌱</div>
                  <span className={`text-xs font-bold leading-tight ${
                    entryType === 'new_player' ? 'text-gold-light' : 'text-white'
                  }`}>
                    {language === 'english' ? 'New Player' : 'புதிய விளையாட்டாளர்'}
                  </span>
                  <span className="text-[10px] bg-navy border border-divider text-gray-400 px-2 py-0.5 rounded-full w-full truncate">
                    ~8–12 min
                  </span>
                  <p className="text-gray-500 text-[10px] leading-tight">
                    {language === 'english' ? 'Rules check first' : 'முதல் விதி சரிபார்ப்பு'}
                  </p>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all mt-auto ${
                    entryType === 'new_player' ? 'bg-gold border-gold' : 'border-divider'
                  }`} />
                </button>

                {/* Card 2: Knows Rules */}
                <button
                  onClick={() => setEntryType('has_rating')}
                  className={`flex flex-col items-center text-center border rounded-2xl px-2 py-4 gap-2 transition-all cursor-pointer ${
                    entryType === 'has_rating'
                      ? 'bg-gold/15 border-gold shadow-lg shadow-gold/10'
                      : 'bg-navy-mid/60 border-divider hover:border-gold/40 hover:bg-navy-mid/80'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
                    entryType === 'has_rating' ? 'bg-gold/20' : 'bg-navy border border-divider'
                  }`}>♟️</div>
                  <span className={`text-xs font-bold leading-tight ${
                    entryType === 'has_rating' ? 'text-gold-light' : 'text-white'
                  }`}>
                    {language === 'english' ? 'Know the Rules' : 'விதிகள் தெரியும்'}
                  </span>
                  <span className="text-[10px] bg-navy border border-divider text-gray-400 px-2 py-0.5 rounded-full w-full truncate">
                    ~8–12 min
                  </span>
                  <p className="text-gray-500 text-[10px] leading-tight">
                    {language === 'english' ? 'Starts at ELO 1000' : 'ELO 1000-ல் தொடங்கும்'}
                  </p>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all mt-auto ${
                    entryType === 'has_rating' ? 'bg-gold border-gold' : 'border-divider'
                  }`} />
                </button>

                {/* Card 3: Has Rating */}
                <button
                  onClick={() => setEntryType(prev => ['fide_import','chesscom_import','lichess_import'].includes(prev) ? prev : 'fide_import')}
                  className={`flex flex-col items-center text-center border rounded-2xl px-2 py-4 gap-2 transition-all cursor-pointer ${
                    ['fide_import','chesscom_import','lichess_import'].includes(entryType)
                      ? 'bg-gold/15 border-gold shadow-lg shadow-gold/10'
                      : 'bg-navy-mid/60 border-divider hover:border-gold/40 hover:bg-navy-mid/80'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
                    ['fide_import','chesscom_import','lichess_import'].includes(entryType) ? 'bg-gold/20' : 'bg-navy border border-divider'
                  }`}>🏅</div>
                  <span className={`text-xs font-bold leading-tight ${
                    ['fide_import','chesscom_import','lichess_import'].includes(entryType) ? 'text-gold-light' : 'text-white'
                  }`}>
                    {language === 'english' ? 'Have a Rating' : 'மதிப்பீடு உள்ளது'}
                  </span>
                  <span className="text-[10px] bg-green-900/50 border border-green-700/40 text-green-400 px-2 py-0.5 rounded-full w-full truncate">
                    ⚡ ~3–4 min
                  </span>
                  <p className="text-gray-500 text-[10px] leading-tight">
                    {language === 'english' ? 'Fast-track 6 puzzles' : '6 சரிபார்ப்பு புதிர்கள்'}
                  </p>
                  <div className={`w-3.5 h-3.5 rounded-full border-2 transition-all mt-auto ${
                    ['fide_import','chesscom_import','lichess_import'].includes(entryType) ? 'bg-gold border-gold' : 'border-divider'
                  }`} />
                </button>
              </div>

              {/* Rating source + input — shown below cards when path 3 selected */}
              {['fide_import','chesscom_import','lichess_import'].includes(entryType) && (
                <div className="border border-gold/30 bg-navy/50 rounded-2xl p-4 animate-fadeIn">
                  <p className="text-[11px] text-gray-400 mb-2 font-semibold">
                    {language === 'english' ? 'Select your rating source:' : 'மதிப்பீட்டு மூலத்தை தேர்ந்தெடுக்கவும்:'}
                  </p>
                  <div className="flex gap-2 mb-3">
                    {(['fide_import','chesscom_import','lichess_import'] as EntryType[]).map(src => {
                      const labels: Record<string, string> = {
                        fide_import: 'FIDE', chesscom_import: 'Chess.com', lichess_import: 'Lichess'
                      };
                      const adjustments: Record<string, string> = {
                        fide_import: language === 'english' ? 'No adjust' : 'மாற்றமில்லை',
                        chesscom_import: '−100 ELO',
                        lichess_import: '−200 ELO'
                      };
                      return (
                        <button
                          key={src}
                          onClick={() => setEntryType(src)}
                          className={`flex-1 flex flex-col items-center py-2 px-1 rounded-xl border text-[10px] font-bold transition-all cursor-pointer ${
                            entryType === src
                              ? 'bg-gold/20 border-gold text-gold-light'
                              : 'bg-navy border-divider text-gray-300 hover:border-gold/40'
                          }`}
                        >
                          <span>{labels[src]}</span>
                          <span className={`text-[9px] mt-0.5 ${entryType === src ? 'text-gold/70' : 'text-gray-500'}`}>
                            {adjustments[src]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <label className="block text-[11px] font-bold text-gold-light mb-1">{T.ratingLabel}</label>
                  <input
                    type="number"
                    value={importedRating}
                    onChange={e => setImportedRating(e.target.value)}
                    className="w-full bg-navy/60 border border-divider/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold/50"
                    placeholder="e.g. 1350"
                  />
                </div>
              )}
            </div>

            {/* Begin button + No chess link */}
            <div className="px-6 pb-7">
              <button
                onClick={handleBeginAssessment}
                className="w-full btn-gold py-3.5 text-sm font-bold shadow-lg mb-3"
              >
                {T.begin}
              </button>
              <p className="text-center text-[11px] text-gray-500">
                {language === 'english' ? "Don't know chess?" : 'சதுரங்கம் தெரியவில்லையா?'}{' '}
                <button
                  onClick={handleGoToLessons}
                  className="text-gold-light hover:text-gold underline underline-offset-2 font-semibold transition-colors"
                >
                  {language === 'english' ? 'Go to Lessons instead' : 'பதிலாக பாடங்களுக்கு செல்லவும்'}
                </button>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Beginner Notification Modal ── */}
      {showBeginnerNotif && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
          <div className="w-full max-w-sm bg-[#0E1830] border border-gold/30 rounded-2xl p-6 shadow-2xl text-center animate-scaleIn">
            <div className="text-5xl mb-4">🌱</div>
            <h2 className="text-xl font-extrabold text-white mb-2">
              {language === 'english' ? 'Welcome, Beginner!' : 'வரவேற்கிறோம், தொடக்கக்காரர்!'}
            </h2>
            <p className="text-gray-300 text-sm leading-relaxed mb-4">
              {language === 'english'
                ? 'You can start your chess journey from 200 ELO — that is the base rating for beginners. Your rating will grow as you learn and play!'
                : 'நீங்கள் 200 ELO இல் இருந்து உங்கள் சதுரங்க பயணத்தை தொடங்கலாம் — அது தொடக்கக்காரர்களுக்கான அடிப்படை மதிப்பீடு. கற்று விளையாடும்போது உங்கள் ELO வளரும்!'}
            </p>
            <div className="bg-navy/60 border border-gold/20 rounded-xl px-4 py-3 mb-5 inline-block">
              <span className="text-gold text-3xl font-black">200</span>
              <span className="text-gray-400 text-xs ml-2 font-bold uppercase tracking-wider">Base ELO</span>
            </div>
            <button
              onClick={() => { setShowBeginnerNotif(false); navigate('/lessons'); }}
              className="w-full btn-gold py-3 text-sm font-bold shadow-lg"
            >
              {language === 'english' ? '🎓 Start Learning Chess →' : '🎓 சதுரங்கம் கற்கத் தொடங்கு →'}
            </button>
          </div>
        </div>
      )}

      {/* ── Guest Info Modal — collect name + email before showing results ── */}
      {showGuestInfoModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center px-4" style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}>
          <div className="w-full max-w-sm bg-[#0E1830] border border-gold/30 rounded-2xl p-6 shadow-2xl animate-scaleIn">
            <div className="text-center mb-5">
              <div className="text-5xl mb-3">🏆</div>
              <h2 className="text-xl font-extrabold text-white mb-1">
                {language === 'english' ? 'Assessment Complete!' : 'மதிப்பீடு முடிந்தது!'}
              </h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                {language === 'english'
                  ? 'Enter your details to see your results. Your score will be saved for future reference.'
                  : 'உங்கள் முடிவுகளை பார்க்க விவரங்களை உள்ளிடவும்.'}
              </p>
            </div>

            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs font-bold text-gold-light mb-1">
                  {language === 'english' ? 'Your Name' : 'உங்கள் பெயர்'}
                </label>
                <input
                  type="text"
                  value={guestInfoName}
                  onChange={e => { setGuestInfoName(e.target.value); setGuestInfoError(''); }}
                  placeholder={language === 'english' ? 'e.g. Arjun Kumar' : 'எ.கா. அர்ஜுன் குமார்'}
                  className="w-full bg-navy/60 border border-divider/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold/50"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gold-light mb-1">
                  {language === 'english' ? 'Email Address' : 'மின்னஞ்சல்'}
                </label>
                <input
                  type="email"
                  value={guestInfoEmail}
                  onChange={e => { setGuestInfoEmail(e.target.value); setGuestInfoError(''); }}
                  placeholder="name@example.com"
                  className="w-full bg-navy/60 border border-divider/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-gold/50"
                />
              </div>
              {guestInfoError && (
                <p className="text-red-400 text-xs font-medium">{guestInfoError}</p>
              )}
            </div>

            <button
              onClick={handleGuestInfoSubmit}
              disabled={guestInfoSaving}
              className="w-full btn-gold py-3 text-sm font-bold shadow-lg disabled:opacity-60 mb-3"
            >
              {guestInfoSaving
                ? (language === 'english' ? 'Saving...' : 'சேமிக்கிறது...')
                : (language === 'english' ? '🎉 View My Results →' : '🎉 என் முடிவுகளை பார்க்க →')}
            </button>

            <p className="text-center text-[11px] text-gray-500">
              {language === 'english' ? 'Already have an account?' : 'ஏற்கனவே கணக்கு இருக்கிறதா?'}{' '}
              <button
                onClick={() => navigate('/login')}
                className="text-gold-light hover:text-gold underline underline-offset-2 font-semibold transition-colors"
              >
                {language === 'english' ? 'Sign in' : 'உள்நுழைக'}
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ── Phase: Rules Gate ── */}
      {phase === 'rules_gate' && (
        <div className="flex-1 flex items-center justify-center px-4 py-6 animate-slideUp">
          <div className="w-full max-w-[480px] card relative border-divider shadow-2xl p-5 md:p-8">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent rounded-t-2xl" />

            {/* Step progress bar */}
            <div className="flex gap-2 mb-5">
              {[1,2,3].map(n => (
                <div key={n} className={`h-1.5 flex-1 rounded-full transition-all ${ruleTask === n ? 'bg-gold' : ruleTask > n ? 'bg-green-500' : 'bg-divider'}`} />
              ))}
            </div>

            <div className="flex justify-between items-center mb-2">
              <Badge variant="gold">{T.gateTitle}</Badge>
              <span className="text-gray-500 text-xs">{T.gateSub}</span>
            </div>

            {/* Task 1: Knight Moves */}
            {ruleTask === 1 && (
              <div className="animate-fadeIn space-y-4">
                <h2 className="text-white text-base font-bold">{T.task1Title}</h2>
                <p className="text-gray-400 text-xs">{T.task1Desc}</p>
                <div className="flex justify-center">
                  <RulesBoard
                    pieces={{ d4: '♘' }}
                    onSquareClick={handleTask1Click}
                    highlighted={knightTapped}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-gray-400">
                  <span>{knightTapped.length} / 8 {language === 'english' ? 'selected' : 'தேர்ந்தெடுத்தது'}</span>
                  {knightTapped.length > 0 && <button onClick={() => setKnightTapped([])} className="text-red-400 hover:text-red-300">Clear</button>}
                </div>
                <button
                  onClick={handleTask1Submit}
                  disabled={knightTapped.length === 0}
                  className="w-full btn-gold py-2.5 text-sm font-bold shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {T.continue}
                </button>
              </div>
            )}

            {/* Task 2: Checkmate vs Stalemate — uses real ChessBoard (disabled, just shows position) */}
            {ruleTask === 2 && (
              <div className="animate-fadeIn space-y-4">
                <h2 className="text-white text-base font-bold">{T.task2Title}</h2>
                <p className="text-gray-400 text-xs">{T.task2Desc}</p>
                <div className="flex justify-center">
                  <div className="w-full max-w-[300px]">
                    <ChessBoard
                      position="4R1k1/5ppp/8/8/8/8/8/6K1 b - - 0 1"
                      onMove={() => false}
                      orientation="white"
                      disabled
                      hideCheckmateBadges={true}
                    />
                  </div>
                </div>
                {checkmateChoice ? (
                  <div className={`p-3 rounded-xl text-center text-sm font-bold ${checkmateChoice === 'checkmate' ? 'bg-green-950/40 text-green-400 border border-green-800/30' : 'bg-red-950/40 text-red-400 border border-red-800/30'}`}>
                    {checkmateChoice === 'checkmate' ? T.correct : T.wrong}
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <button onClick={() => handleTask2Pick('checkmate')} className="flex-1 py-3 bg-navy-mid hover:bg-gold/10 border border-divider hover:border-gold text-white text-sm font-bold rounded-xl transition-all active:scale-95">
                      {T.checkmate}
                    </button>
                    <button onClick={() => handleTask2Pick('stalemate')} className="flex-1 py-3 bg-navy-mid hover:bg-gold/10 border border-divider hover:border-gold text-white text-sm font-bold rounded-xl transition-all active:scale-95">
                      {T.stalemate}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Task 3: Capture Free Piece — uses real ChessBoard (interactive) */}
            {ruleTask === 3 && (
              <div className="animate-fadeIn space-y-4">
                <h2 className="text-white text-base font-bold">{T.task3Title}</h2>
                <p className="text-gray-400 text-xs">{T.task3Desc}</p>
                <div className="flex justify-center">
                  <div className="w-full max-w-[300px]">
                    <ChessBoard
                      position={bishopCaptured
                        ? '6k1/8/8/4B3/8/8/8/6K1 w - - 0 1'
                        : '6k1/8/8/4b3/8/2B5/8/6K1 w - - 0 1'
                      }
                      onMove={(from, to) => {
                        if (from === 'c3' && to === 'e5' && !bishopCaptured) {
                          setBishopCaptured(true);
                          setTask3Passed(true);
                          return true;
                        }
                        return false;
                      }}
                      orientation="white"
                      disabled={bishopCaptured}
                    />
                  </div>
                </div>
                {bishopCaptured && (
                  <div className="p-3 rounded-xl bg-green-950/40 text-green-400 border border-green-800/30 text-center text-sm font-bold animate-bounce">
                    🎉 {T.correct}
                  </div>
                )}
                {!bishopCaptured && (
                  <p className="text-gold text-[11px] text-center animate-pulse">
                    {language === 'english' ? 'Click the White bishop (c3) then capture the Black bishop (e5).' : 'c3 வெள்ளை பிஷப்பை கிளிக் செய்து e5 கருப்பு பிஷப்பை வெட்டவும்.'}
                  </p>
                )}
                <button
                  onClick={handleRulesGateSubmit}
                  disabled={!bishopCaptured}
                  className="w-full btn-gold py-2.5 text-sm font-bold shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {T.submitGate}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Phase: CAT Puzzle Loop ── */}
      {phase === 'cat_loop' && currentPuzzle && (
        <div className="flex-1 flex flex-col items-center justify-center w-full max-w-5xl md:max-w-6xl mx-auto px-4 py-4 md:py-6 animate-slideUp overflow-hidden">
          <div className="w-full flex flex-col md:grid md:grid-cols-5 gap-6 max-h-[90vh] md:max-h-none overflow-y-auto md:overflow-visible items-stretch">

            {/* Left: Board */}
            <div className="md:col-span-3 flex flex-col items-center justify-center bg-card-bg border border-divider rounded-2xl p-4 md:p-6 shadow-xl relative min-h-0 md:min-h-[460px]">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent rounded-t-2xl" />

              {/* Timer + ELO bar */}
              <div className="w-full mb-3">
                <div className="flex items-center justify-between mb-1.5 text-xs">
                  <span className="text-gray-400 font-medium">
                    {T.puzzleOf} {puzzleCount + 1}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className={`font-mono font-bold ${timeLeft <= 15 ? 'text-red-400 animate-pulse' : 'text-gold-light'}`}>
                      ⏱ {timeLeft}s
                    </span>
                    <span className="text-gray-500 text-[11px]">ELO ~{currentEstimate}</span>
                  </div>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${(timeLeft / 90) * 100}%`, background: timeLeft <= 15 ? '#ef4444' : undefined }} />
                </div>
              </div>

              {/* Whose turn indicator — locked to initial puzzle side */}
              <div className={`w-full flex items-center justify-center gap-2 mb-2 px-2 py-1.5 rounded-lg text-xs font-bold ${
                puzzleTurn === 'w'
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'bg-black/40 text-gray-200 border border-gray-600/40'
              }`}>
                <span className={`w-3 h-3 rounded-full inline-block flex-shrink-0 ${
                  puzzleTurn === 'w' ? 'bg-white' : 'bg-gray-900 border border-gray-400'
                }`} />
                <span>
                  {puzzleTurn === 'w'
                    ? (language === 'english' ? '⬜ White to move — move the White pieces' : '⬜ வெள்ளை நகர வேண்டும் — வெள்ளை காய்களை நகர்த்தவும்')
                    : (language === 'english' ? '⬛ Black to move — move the Black pieces' : '⬛ கருப்பு நகர வேண்டும் — கருப்பு காய்களை நகர்த்தவும்')}
                </span>
              </div>

              {/* Board */}
              <div className="w-full max-w-[320px] md:max-w-[380px] lg:max-w-[400px] flex-1 flex items-center justify-center py-2 md:py-4">
                <ChessBoard
                  position={boardPosition}
                  onMove={handleBoardMove}
                  orientation={puzzleOrientation}
                  disabled={puzzleStatus !== 'solving' || isSubmitting}
                  lastMove={lastMove}
                  hintSquares={hintLevel >= 2 && currentPuzzle?.solutionUci?.[moveIndex]
                    ? { from: currentPuzzle.solutionUci[moveIndex].slice(0,2), to: currentPuzzle.solutionUci[moveIndex].slice(2,4) }
                    : null}
                />
              </div>

              {/* Status feedback */}
              {puzzleStatus === 'correct' && (
                <div className="w-full mt-2 p-2.5 bg-green-950/50 border border-green-700/40 text-green-400 text-xs font-bold text-center rounded-lg animate-fadeIn">
                  ✓ {language === 'english' ? 'Correct! Well played.' : 'சரி! அருமை.'}
                </div>
              )}
              {puzzleStatus === 'wrong' && (
                <div className="w-full mt-2 p-2.5 bg-red-950/50 border border-red-700/40 text-red-400 text-xs font-bold text-center rounded-lg animate-fadeIn">
                  ✗ {warningMessage}
                </div>
              )}
            </div>

            {/* Right: Info panel */}
            <div className="md:col-span-2 flex flex-col justify-between bg-card-bg border border-divider rounded-2xl p-4 md:p-6 shadow-xl relative min-h-0 md:min-h-[460px]">
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent rounded-t-2xl" />

              <div className="flex flex-col gap-4 flex-1">
                <div className="flex justify-between items-center">
                  <Badge variant="gold">{T.puzzle}</Badge>
                  <span className="text-gray-500 text-xs">
                    {currentPuzzle.domain || 'middlegame'}
                  </span>
                </div>

                {/* Puzzle instruction */}
                <div className="bg-navy/40 border border-divider/40 rounded-xl p-3 flex flex-col gap-2">
                  <h3 className="text-white text-xs font-bold flex items-center gap-1.5">
                    <span>♟</span><span>{language === 'english' ? 'Puzzle Objective' : 'புதிர் குறிக்கோள்'}</span>
                  </h3>
                  <p className="text-xs text-white font-medium leading-relaxed">
                    {currentPuzzle.instruction?.[lang] || T.puzzleInstr}
                  </p>
                </div>

                {/* Current estimate display */}
                <div className="bg-navy/40 border border-divider/40 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gold-light">{T.currentElo}</span>
                    <span className="text-gold font-extrabold text-lg font-mono">~{currentEstimate}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-navy overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-gold/60 to-gold rounded-full transition-all duration-700"
                      style={{ width: `${Math.min(100, ((currentEstimate - 400) / 2000) * 100)}%` }}
                    />
                  </div>
                </div>

                {/* Hint system */}
                <div className="bg-navy/35 border border-divider/30 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-bold text-[11px] text-gold-light">
                      {language === 'english' ? 'Progressive Hint' : 'குறிப்பு அமைப்பு'}
                    </span>
                    <button
                      onClick={() => setHintLevel(h => Math.min(h + 1, 2))}
                      disabled={hintLevel >= 2 || puzzleStatus !== 'solving'}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold transition-all active:scale-95 cursor-pointer ${
                        hintLevel >= 2 ? 'bg-navy text-gray-500 border border-divider' : 'bg-gold text-navy hover:bg-gold-light'
                      }`}
                    >
                      {hintLevel === 0 ? T.hint : hintLevel === 1 ? T.showMove : T.showing}
                    </button>
                  </div>
                  {hintLevel >= 1 && currentPuzzle?.hint && (
                    <div className="mt-2.5 bg-navy-mid/50 border border-divider/50 rounded-lg p-2.5 text-[11px] text-gold-light animate-fadeIn">
                      <span className="font-bold block mb-0.5">Hint:</span>
                      {currentPuzzle.hint[lang] || currentPuzzle.hint.en}
                    </div>
                  )}
                </div>
              </div>

              {/* Skip button */}
              <button
                onClick={() => { if (timerRef.current) clearInterval(timerRef.current); submitPuzzleResult(false); }}
                disabled={puzzleStatus !== 'solving' || isSubmitting}
                className="w-full mt-4 py-2.5 bg-red-900/10 hover:bg-red-900/20 border border-red-800/30 text-red-400 font-bold rounded-xl text-xs transition-colors disabled:opacity-40"
              >
                {T.skip}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Phase: Bloom 4 Probe ── */}
      {phase === 'bloom4_probe' && (
        <div className="flex-1 flex items-center justify-center px-4 py-6 animate-fadeIn">
          <div className="w-full max-w-[480px] card relative border-divider shadow-2xl p-5 md:p-8">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent rounded-t-2xl" />
            <div className="text-center mb-4">
              <div className="inline-block px-3 py-1 rounded-full bg-gold/15 border border-gold/30 text-gold text-[10px] font-bold uppercase tracking-wider mb-2">Bloom Level 4 — Analyse</div>
              <h2 className="text-xl font-extrabold text-white">{T.bloom4Title}</h2>
              <p className="text-gray-400 text-xs mt-1">{T.bloom4Sub}</p>
            </div>

            <div className="bg-navy/40 border border-divider/40 rounded-xl p-3 mb-4">
              <p className="text-sm text-white font-semibold leading-relaxed">{T.bloom4Q}</p>
            </div>

            <div className="space-y-2 mb-4">
              {(['A','B','C','D'] as const).map(opt => {
                const label = T[`bloom4${opt}` as keyof typeof T] as string;
                return (
                  <button
                    key={opt}
                    onClick={() => setBloom4Answer(opt)}
                    className={`w-full flex items-center gap-3 text-left border rounded-xl px-4 py-3 text-xs font-semibold transition-all cursor-pointer
                      ${bloom4Answer === opt ? 'bg-gold/15 border-gold text-gold-light shadow-md' : 'bg-navy-mid border-divider text-gray-200 hover:border-gold/40'}`}
                  >
                    <span className={`w-5 h-5 flex items-center justify-center rounded-full text-[10px] font-bold flex-shrink-0 ${bloom4Answer === opt ? 'bg-gold text-navy' : 'bg-navy text-gold-light border border-gold/20'}`}>{opt}</span>
                    {label}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleBloom4Submit}
              disabled={!bloom4Answer}
              className="w-full btn-gold py-3 text-sm font-bold shadow-md disabled:opacity-40"
            >
              {T.bloom4Submit}
            </button>
          </div>
        </div>
      )}

      {/* ── Phase: Bloom 5 Probe ── */}
      {phase === 'bloom5_probe' && (
        <div className="flex-1 flex flex-col md:grid md:grid-cols-5 gap-6 max-w-4xl mx-auto w-full px-4 py-6 overflow-y-auto items-stretch animate-fadeIn">
          {/* Left: Board replay */}
          <div className="md:col-span-3 flex flex-col items-center justify-center bg-card-bg border border-divider rounded-2xl p-5 shadow-xl relative">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent rounded-t-2xl" />
            <div className="w-full max-w-[320px] flex items-center justify-center mb-4">
              <ChessBoard position={bloom5CurrentFen} onMove={() => false} disabled />
            </div>
            <div className="w-full max-w-[320px] space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-gray-400 font-bold">{language === 'english' ? 'Drag slider to replay:' : 'ரீப்ளே செய்ய ஸ்லைடரை இழுக்கவும்:'}</span>
                <span className="text-gold font-extrabold font-mono text-sm bg-navy-mid border border-divider px-3 py-1 rounded-md">{bloom5CurrentMove}</span>
              </div>
              <input
                type="range" min={1} max={15} value={bloom5Move}
                onChange={e => setBloom5Move(Number(e.target.value))}
                className="w-full accent-gold h-1.5 bg-navy rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>Move 1</span><span>Move 15</span>
              </div>
            </div>
          </div>

          {/* Right: Evaluation panel */}
          <div className="md:col-span-2 card relative border-divider p-5 md:p-6 flex flex-col justify-between shadow-xl">
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent rounded-t-2xl" />
            <div className="space-y-4 flex-1">
              <div>
                <div className="inline-block px-3 py-1 rounded-full bg-gold/15 border border-gold/30 text-gold text-[10px] font-bold uppercase tracking-wider mb-2">Bloom Level 5 — Evaluate</div>
                <h2 className="text-lg font-extrabold text-white">{T.bloom5Title}</h2>
                <p className="text-gray-400 text-[10px] leading-relaxed mt-1">{T.bloom5Sub}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gold-light block">{T.bloom5MoveLabel}</label>
                <select
                  value={bloom5Move}
                  onChange={e => setBloom5Move(Number(e.target.value))}
                  className="w-full bg-navy/60 border border-divider/60 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-gold/50"
                >
                  {bloom5Moves.map(m => (
                    <option key={m.num} value={m.num}>Move {m.num}: {m.move}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gold-light block">{T.bloom5Reason}</label>
                <textarea
                  rows={4}
                  value={bloom5Reason}
                  onChange={e => setBloom5Reason(e.target.value)}
                  placeholder={T.bloom5Ph}
                  className="w-full bg-navy/60 border border-divider/60 rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-gold/50 resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleBloom5Submit}
              disabled={!bloom5Reason.trim()}
              className="btn-gold w-full py-3 text-xs font-bold shadow-md mt-4 disabled:opacity-40"
            >
              {T.bloom5Submit}
            </button>
          </div>
        </div>
      )}

      {/* ── Phase: Submitting (same spinner as old design) ── */}
      {phase === 'submitting' && (
        <div className="flex-1 flex flex-col items-center justify-center animate-fadeIn px-5 text-center">
          <div className="w-16 h-16 border-4 border-gold border-t-transparent rounded-full animate-spin mb-6" />
          <h2 className="text-2xl font-bold text-white mb-2">{T.analyzing}</h2>
          <p className="text-gray-400 text-sm">{T.analyzingSub}</p>
        </div>
      )}

      {/* ── Phase: Results (same design as old, but CAT profile data) ── */}
      {phase === 'results' && profile && (
        <div className="flex-1 flex items-center justify-center px-4 py-8 animate-fadeIn relative overflow-hidden">

          {/* Confetti (same as old) */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            {Array.from({ length: 40 }).map((_, i) => {
              const left = Math.random() * 100;
              const delay = Math.random() * 4;
              const scale = 0.5 + Math.random() * 0.8;
              const rotation = Math.random() * 360;
              const color = i % 3 === 0 ? 'bg-gold' : i % 3 === 1 ? 'bg-green-400' : 'bg-blue-400';
              return (
                <div
                  key={i}
                  className={`absolute w-3 h-3 ${color} rounded-sm`}
                  style={{
                    left: `${left}%`, top: `-20px`,
                    transform: `scale(${scale}) rotate(${rotation}deg)`,
                    animation: `confettiFall 4s linear infinite`,
                    animationDelay: `${delay}s`,
                  }}
                />
              );
            })}
          </div>

          <div className="w-full max-w-lg card-glow p-8 relative border-gold shadow-2xl text-center animate-scaleIn bg-card-bg/95">
            <div className="gold-top-accent" />
            <div className="text-6xl mb-3">🏆</div>
            <h1 className="text-3xl font-extrabold text-white mb-1 tracking-wide font-heading">
              {language === 'english' ? 'Assessment Complete!' : 'மதிப்பீடு முடிந்தது!'}
            </h1>
            <p className="text-gray-400 text-sm mb-6">
              {language === 'english' ? 'Congratulations on completing your chess evaluation!' : 'மதிப்பீட்டை வெற்றிகரமாக முடித்ததற்கு வாழ்த்துகள்!'}
            </p>

            {/* ELO + Right-side stat */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="bg-navy p-5 rounded-2xl border border-divider text-center shadow-inner relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-[2px] bg-gold/40" />
                <div className="text-gold text-4xl font-black">{animatedElo}</div>
                <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mt-1">
                  {T.yourElo}
                </div>
              </div>

              {profile.isRulesGateFail ? (
                /* Rules gate: show X/3 correct */
                <div className="bg-navy p-5 rounded-2xl border border-divider text-center shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-blue-500/40" />
                  <div className="text-blue-400 text-2xl font-black">
                    {profile.rulesGateCorrect ?? profile.puzzlesSolved}
                    <span className="text-gray-500 text-lg font-bold"> / 3</span>
                  </div>
                  <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mt-1">
                    {language === 'english' ? 'Rules Correct' : 'சரியான விடைகள்'}
                  </div>
                  <div className="text-gray-600 text-[9px] mt-0.5">
                    {language === 'english' ? 'of 3 gate questions' : '3 வாயில் கேள்விகளில்'}
                  </div>
                </div>
              ) : (
                /* CAT loop: show puzzlesSolved */
                <div className="bg-navy p-5 rounded-2xl border border-divider text-center shadow-inner relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[2px] bg-green-500/40" />
                  <div className="text-green-400 text-2xl font-black">
                    {profile.puzzlesSolved}
                  </div>
                  <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider mt-1">
                    {language === 'english' ? 'Puzzles Solved' : 'சரியான விடைகள்'}
                  </div>
                  <div className="text-gray-600 text-[9px] mt-0.5">
                    {language === 'english'
                      ? `of ${profile.puzzlesAttempted} attempted`
                      : `${profile.puzzlesAttempted} இல்`}
                  </div>
                </div>
              )}
            </div>

            {/* Category badge + detail breakdown */}
            <div className="card p-5 border-divider mb-6 bg-navy/60">
              <h2 className="text-gold-light font-bold text-lg leading-tight mb-2">{profile.playerCategory}</h2>
              <div className="mt-1">
                <Badge variant={profile.overallElo >= 1600 ? 'gold' : profile.overallElo >= 1000 ? 'green' : 'gray'}>
                  {profile.overallElo >= 1600 ? 'Gold Category' : profile.overallElo >= 1000 ? 'Silver Category' : 'Bronze Category'}
                </Badge>
              </div>

              <div className="mt-5 space-y-2.5 text-xs text-left max-w-xs mx-auto">

                {profile.isRulesGateFail ? (
                  /* Rules gate failure: hide domain ELOs, show gate breakdown instead */
                  <>
                    <div className="flex items-center justify-between text-gray-300">
                      <span>🏇 {language === 'english' ? 'Knight Moves:' : 'குதிரை நகர்வு:'}</span>
                      <span className={`font-bold font-mono ${task1Passed ? 'text-green-400' : 'text-red-400'}`}>
                        {task1Passed ? '✓ Correct' : '✗ Wrong'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-gray-300">
                      <span>♟ {language === 'english' ? 'Checkmate vs Stalemate:' : 'சத்து vs பாவ:'}</span>
                      <span className={`font-bold font-mono ${task2Passed ? 'text-green-400' : 'text-red-400'}`}>
                        {task2Passed ? '✓ Correct' : '✗ Wrong'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-gray-300">
                      <span>🎯 {language === 'english' ? 'Capture Free Piece:' : 'இலவச காய் பிடிப்பு:'}</span>
                      <span className={`font-bold font-mono ${task3Passed ? 'text-green-400' : 'text-red-400'}`}>
                        {task3Passed ? '✓ Correct' : '✗ Wrong'}
                      </span>
                    </div>
                    <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-3 mt-2 text-center">
                      <p className="text-yellow-300 text-[10px] leading-relaxed">
                        {language === 'english'
                          ? '💡 Learn the basics to unlock the full assessment and improve your rating!'
                          : '💡 முழு மதிப்பீட்டை திறக்க அடிப்படைகளை கற்றுக்கொள்ளுங்கள்!'}
                      </p>
                    </div>
                  </>
                ) : (
                  /* CAT loop: show full domain ELO breakdown */
                  <>
                    {(['openings', 'middlegame', 'endgame'] as const).map(domain => {
                      const domainData = profile[domain];
                      const icons = { openings: '📖', middlegame: '⚔️', endgame: '♟' };
                      const domainLabel = { openings: T.openings, middlegame: T.middlegame, endgame: T.endgame };
                      return (
                        <div key={domain} className="flex items-center justify-between text-gray-300">
                          <span>{icons[domain]} {domainLabel[domain]}:</span>
                          <div className="flex items-center gap-2">
                            <span className="font-bold font-mono text-gold-light">{domainData.elo} ELO</span>
                            <span className="text-gray-500 text-[10px]">B{domainData.bloom}</span>
                          </div>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between text-gray-300 pt-1 border-t border-divider/40">
                      <span>🧠 {T.bloom}:</span>
                      <span className="font-bold font-mono">{profile.bloomOverall} / 6</span>
                    </div>
                  </>
                )}

                <div className="flex items-center justify-between text-gray-300">
                  <span>⏱ {language === 'english' ? 'Time Taken:' : 'எடுத்த நேரம்:'}</span>
                  <span className="font-bold font-mono">{profile.timeTaken}</span>
                </div>
              </div>
            </div>

            {/* Results CTA — different for logged-in vs guest */}
            {user ? (
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full btn-gold py-4 text-base font-extrabold shadow-lg animate-pulse"
              >
                {T.dashboard}
              </button>
            ) : (
              <div className="space-y-3">
                <div className="bg-navy/60 border border-gold/20 rounded-2xl p-4 text-center">
                  <p className="text-gold-light text-sm font-bold mb-1">
                    {language === 'english' ? '🔐 Save Your ELO Rating!' : '🔐 உங்கள் ELO மதிப்பீட்டை சேமிக்கவும்!'}
                  </p>
                  <p className="text-gray-400 text-xs leading-relaxed">
                    {language === 'english'
                      ? 'Sign in or register to save your chess rating, play games, and track your progress over time.'
                      : 'உங்கள் சதுரங்க மதிப்பீட்டை சேமிக்க, விளையாட மற்றும் முன்னேற்றத்தை கண்காணிக்க உள்நுழையுங்கள்.'}
                  </p>
                </div>
                <button
                  onClick={() => navigate('/login')}
                  className="w-full btn-gold py-3 text-sm font-extrabold shadow-lg"
                >
                  {language === 'english' ? '🎯 Sign In to Save My Rating →' : '🎯 என் மதிப்பீட்டை சேமிக்க உள்நுழைக →'}
                </button>
                <button
                  onClick={() => navigate('/')}
                  className="w-full py-2.5 bg-transparent border border-divider/40 text-gray-400 font-semibold rounded-xl text-xs hover:border-divider/80 transition-colors"
                >
                  {language === 'english' ? 'Back to Home' : 'முகப்புக்கு திரும்பு'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
