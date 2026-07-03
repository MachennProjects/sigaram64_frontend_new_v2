/**
 * useStockfish.ts — React hook for Stockfish engine interaction
 * Provides findBestMove() and getEvaluation() as clean async APIs.
 * Uses an isBusy guard to prevent concurrent engine calls (race condition fix).
 */

import { useEffect, useRef, useCallback } from 'react';
import StockfishEngine from './StockfishEngine';

export interface StockfishConfig {
  skillLevel?: number;
}

export function useStockfish(config?: StockfishConfig) {
  const engineRef = useRef<StockfishEngine | null>(null);
  const isBusyRef = useRef(false);

  useEffect(() => {
    const engine = new StockfishEngine();
    engineRef.current = engine;
    isBusyRef.current = false;

    if (config?.skillLevel !== undefined) {
      const timer = setTimeout(() => {
        engine.setSkillLevel(config.skillLevel!);
      }, 200);
      return () => {
        clearTimeout(timer);
        engine.terminate();
        engineRef.current = null;
        isBusyRef.current = false;
      };
    }

    return () => {
      engine.terminate();
      engineRef.current = null;
      isBusyRef.current = false;
    };
  }, [config?.skillLevel]);

  /** Find the best move for a given FEN position at a given depth */
  const findBestMove = useCallback(
    (fen: string, depth = 12): Promise<string> => {
      return new Promise((resolve, reject) => {
        const engine = engineRef.current;
        if (!engine) {
          reject(new Error('Stockfish engine not initialized'));
          return;
        }
        if (isBusyRef.current) {
          reject(new Error('Stockfish engine is busy'));
          return;
        }

        isBusyRef.current = true;

        const timeout = setTimeout(() => {
          engine.offMessage(handler);
          isBusyRef.current = false;
          reject(new Error('Stockfish timeout'));
        }, 12000);

        const handler = ({ bestMove }: { bestMove?: string }) => {
          if (bestMove) {
            clearTimeout(timeout);
            engine.offMessage(handler);
            isBusyRef.current = false;
            resolve(bestMove);
          }
        };

        engine.onMessage(handler);
        engine.evaluatePosition(fen, depth);
      });
    },
    []
  );

  /** Get the centipawn evaluation for a position — waits if engine is busy */
  const getEvaluation = useCallback(
    (fen: string, depth = 10): Promise<number> => {
      return new Promise((resolve, reject) => {
        // If engine busy, wait up to 3s then try
        const attempt = () => {
          const engine = engineRef.current;
          if (!engine) { reject(new Error('Engine not initialized')); return; }
          if (isBusyRef.current) {
            // retry after 300ms
            setTimeout(attempt, 300);
            return;
          }

          isBusyRef.current = true;
          let lastEval: number | undefined;

          const timeout = setTimeout(() => {
            engine.offMessage(handler);
            isBusyRef.current = false;
            if (lastEval !== undefined) resolve(lastEval);
            else reject(new Error('Stockfish evaluation timeout'));
          }, 8000);

          const handler = ({
            positionEvaluation,
            possibleMate,
            bestMove,
          }: {
            positionEvaluation?: number;
            possibleMate?: number;
            bestMove?: string;
          }) => {
            if (positionEvaluation !== undefined) lastEval = positionEvaluation;
            if (possibleMate !== undefined) {
              lastEval = possibleMate > 0 ? 10000 : -10000;
            }
            if (bestMove) {
              clearTimeout(timeout);
              engine.offMessage(handler);
              isBusyRef.current = false;
              resolve(lastEval ?? 0);
            }
          };

          engine.onMessage(handler);
          engine.evaluatePosition(fen, depth);
        };

        attempt();
      });
    },
    []
  );

  /** Stop the current engine search */
  const stop = useCallback(() => {
    engineRef.current?.stop();
    isBusyRef.current = false;
  }, []);

  return { findBestMove, getEvaluation, stop };
}
