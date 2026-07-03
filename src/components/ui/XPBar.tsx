// SIGARAM64 — XP Progress Bar Component
// Displays level and progress towards the next level based on total XP.
import React, { useMemo } from 'react';

interface XPBarProps {
  totalXP: number;
  showLabels?: boolean;
  className?: string;
  inline?: boolean;
}

export default function XPBar({ totalXP, showLabels = true, className = '', inline = false }: XPBarProps) {
  const { level, percent, currentXPInLevel, nextLevelXPNeeded } = useMemo(() => {
    const lvl = Math.floor(Math.sqrt(totalXP / 100)) + 1;
    const currentLvlStart = Math.pow(lvl - 1, 2) * 100;
    const nextLvlStart = Math.pow(lvl, 2) * 100;
    
    const xpInLevel = totalXP - currentLvlStart;
    const xpNeeded = nextLvlStart - currentLvlStart;
    const pct = Math.min(100, Math.max(0, (xpInLevel / xpNeeded) * 100));

    return {
      level: lvl,
      percent: pct,
      currentXPInLevel: xpInLevel,
      nextLevelXPNeeded: xpNeeded,
    };
  }, [totalXP]);

  if (inline) {
    return (
      <div className={`flex items-center gap-2 select-none ${className}`}>
        <span className="bg-gold/10 text-gold border border-gold/30 rounded px-1.5 py-0.5 font-black text-[10px] whitespace-nowrap">
          Lvl {level}
        </span>
        <div className="w-20 md:w-28 h-2 bg-navy-mid border border-divider rounded-full overflow-hidden p-[1px]">
          <div
            className="h-full bg-gradient-to-r from-gold via-gold-light to-gold rounded-full transition-all duration-700 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1 w-full max-w-[280px] ${className}`}>
      <div className="flex items-center justify-between text-[11px] font-semibold select-none leading-none mb-0.5">
        <div className="flex items-center gap-1.5">
          <span className="bg-gold/10 text-gold border border-gold/30 rounded px-1.5 py-0.5 font-black text-[10px]">
            Lvl {level}
          </span>
          {showLabels && <span className="text-gray-400">Progression</span>}
        </div>
        {showLabels && (
          <span className="text-gold-light tracking-tight font-medium tabular-nums">
            {currentXPInLevel} / {nextLevelXPNeeded} XP
          </span>
        )}
      </div>

      <div className="w-full h-2.5 bg-navy-mid border border-divider rounded-full overflow-hidden p-[1px]">
        <div
          className="h-full bg-gradient-to-r from-gold via-gold-light to-gold rounded-full transition-all duration-700 ease-out"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
