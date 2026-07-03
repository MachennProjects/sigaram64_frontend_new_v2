// SIGARAM64 — Streak Flame Component
// Displays student puzzle/login streak with a pulsing flame effect.
import React from 'react';

interface StreakFlameProps {
  streakDays: number;
  className?: string;
}

export default function StreakFlame({ streakDays, className = '' }: StreakFlameProps) {
  const isStreakActive = streakDays > 0;

  return (
    <div
      className={`inline-flex items-center gap-2 pl-1 pr-3 py-1 rounded-full bg-navy-mid border transition-all duration-300 ${
        isStreakActive
          ? 'border-orange-500/30 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.15)]'
          : 'border-divider text-gray-500'
      } ${className}`}
      title={isStreakActive ? `${streakDays} Days Streak!` : 'No active streak'}
    >
      <span
        className={`w-7 h-7 rounded-full bg-navy flex items-center justify-center overflow-hidden flex-shrink-0 border transition-all duration-300 ${
          isStreakActive
            ? 'border-orange-500/20 bg-[#070e20] shadow-[inset_0_0_4px_rgba(249,115,22,0.15)]'
            : 'border-divider/50 opacity-40'
        }`}
      >
        <span
          className={`text-base leading-none select-none transition-transform ${
            isStreakActive ? 'animate-glowPulse scale-105 inline-block' : ''
          }`}
        >
          🔥
        </span>
      </span>
      <span className="text-xs font-black tracking-tight tabular-nums">
        {streakDays} {streakDays === 1 ? 'Day' : 'Days'}
      </span>
    </div>
  );
}
