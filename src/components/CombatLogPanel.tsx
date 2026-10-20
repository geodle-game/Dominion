import React, { useState } from 'react';
import { GameLog } from '../types/game';
import { ScrollText, ChevronUp, ChevronDown, Swords, Castle, Coins, Globe } from 'lucide-react';

interface CombatLogPanelProps {
  logs: GameLog[];
}

export const CombatLogPanel: React.FC<CombatLogPanelProps> = ({ logs }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(true);

  const getLogIcon = (type: GameLog['type']) => {
    switch (type) {
      case 'combat':
        return <Swords className="h-3 w-3 text-rose-400 shrink-0" />;
      case 'conquest':
        return <Castle className="h-3 w-3 text-amber-400 shrink-0" />;
      case 'economy':
        return <Coins className="h-3 w-3 text-emerald-400 shrink-0" />;
      default:
        return <Globe className="h-3 w-3 text-sky-400 shrink-0" />;
    }
  };

  return (
    <div className="pointer-events-auto absolute top-16 left-4 z-20 w-72 rounded-xl border border-slate-700/80 bg-slate-900/90 shadow-2xl backdrop-blur-none select-none text-slate-100 overflow-hidden">
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between px-3 py-2 bg-slate-950/60 cursor-pointer hover:bg-slate-800/60 transition border-b border-slate-800"
      >
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
          <ScrollText className="h-3.5 w-3.5 text-amber-400" />
          <span>Realm Chronicle ({logs.length})</span>
        </div>
        <button className="text-slate-400 hover:text-white">
          {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
      </div>

      {isExpanded && (
        <div className="max-h-40 overflow-y-auto p-2 space-y-1.5 text-[11px]">
          {logs.length === 0 ? (
            <div className="text-slate-500 text-center py-2 italic">The chronicle awaits your first deeds...</div>
          ) : (
            logs.slice(0, 15).map((log) => (
              <div key={log.id} className="flex items-start gap-1.5 rounded bg-slate-950/40 p-1.5 border border-slate-800/60 leading-tight">
                <span className="mt-0.5">{getLogIcon(log.type)}</span>
                <div>
                  <span className="text-[10px] text-slate-400 font-mono mr-1">T{log.turn}:</span>
                  <span className="text-slate-200">{log.text}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
