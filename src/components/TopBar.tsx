import React from 'react';
import { Kingdom, EconomicLedger } from '../types/game';
import { Volume2, VolumeX, HelpCircle, BarChart3, ShieldAlert, Sparkles, FastForward } from 'lucide-react';
import { sounds } from '../audio/soundManager';

interface TopBarProps {
  player: Kingdom;
  ledger: EconomicLedger;
  turn: number;
  isAiProcessing: boolean;
  aiProcessingName?: string;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenLedger: () => void;
  onOpenHelp: () => void;
  onEndTurn: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  player,
  ledger,
  turn,
  isAiProcessing,
  aiProcessingName,
  isMuted,
  onToggleMute,
  onOpenLedger,
  onOpenHelp,
  onEndTurn,
}) => {
  const year = 850 + (turn - 1) * 2;

  return (
    <header className="pointer-events-none absolute top-0 left-0 right-0 z-20 flex flex-col items-center p-3 select-none">
      <div className="pointer-events-auto flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700/80 bg-slate-900/90 px-4 py-2 text-slate-100 shadow-2xl backdrop-blur-none max-w-7xl w-full">
        {/* Left: Kingdom Banner & Turn info */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-500/50 bg-gradient-to-br from-blue-600 to-amber-600 font-bold text-white shadow-inner">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold tracking-wide text-amber-400 text-sm">{player.name}</span>
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-400 font-mono">
                {player.leader}
              </span>
            </div>
            <div className="text-xs text-slate-400 font-mono">
              Year {year} · <span className="text-slate-200 font-bold">Turn {turn}</span>
            </div>
          </div>
        </div>

        {/* Center: Victoria 3 Style Economic & Resource Bar */}
        <div className="flex items-center gap-4 text-xs tabular-nums">
          {/* Treasury / Gold */}
          <button
            onClick={() => {
              sounds.playSelect();
              onOpenLedger();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-950/40 px-2.5 py-1 transition hover:bg-amber-900/50 hover:border-amber-400 cursor-pointer"
            title="Imperial Treasury (Click for Economic Ledger)"
          >
            <span className="text-amber-400 font-bold">🪙</span>
            <div>
              <span className="font-bold text-amber-200">{player.gold}</span>
              <span className={`ml-1 text-[11px] ${ledger.netGold >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {ledger.netGold >= 0 ? `+${ledger.netGold}` : ledger.netGold}/t
              </span>
            </div>
          </button>

          {/* Granary / Food */}
          <button
            onClick={() => {
              sounds.playSelect();
              onOpenLedger();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-950/40 px-2.5 py-1 transition hover:bg-emerald-900/50 hover:border-emerald-400 cursor-pointer"
            title="Granaries & Food (Click for Economic Ledger)"
          >
            <span className="text-emerald-400 font-bold">🌾</span>
            <div>
              <span className="font-bold text-emerald-200">{player.food}</span>
              <span className={`ml-1 text-[11px] ${ledger.netFood >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {ledger.netFood >= 0 ? `+${ledger.netFood}` : ledger.netFood}/t
              </span>
            </div>
          </button>

          {/* Iron Stockpile */}
          <div
            className="flex items-center gap-1.5 rounded-lg border border-slate-600/50 bg-slate-800/60 px-2.5 py-1"
            title="Iron Deposits (Used for heavy infantry, knights, catapults)"
          >
            <span className="text-slate-300 font-bold">⛏️</span>
            <span className="font-bold text-slate-200">{player.iron}</span>
          </div>

          {/* Population */}
          <div
            className="flex items-center gap-1.5 rounded-lg border border-sky-600/40 bg-sky-950/40 px-2.5 py-1"
            title="Imperial Population"
          >
            <span className="text-sky-400 font-bold">👥</span>
            <span className="font-bold text-sky-200">{player.population}</span>
          </div>

          {/* Tax Policy Badge */}
          <button
            onClick={() => {
              sounds.playSelect();
              onOpenLedger();
            }}
            className="hidden sm:flex items-center gap-1 rounded border border-purple-500/40 bg-purple-950/40 px-2 py-1 text-[11px] text-purple-300 hover:bg-purple-900/50 transition cursor-pointer"
            title="Click to change Imperial Economic Policy"
          >
            <BarChart3 className="h-3 w-3" />
            <span className="capitalize">{player.taxPolicy.replace('_', ' ')}</span>
          </button>
        </div>

        {/* Right: Audio, Help, and End Turn Button */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleMute}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
            title={isMuted ? 'Unmute procedural sound' : 'Mute sound'}
          >
            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          <button
            onClick={() => {
              sounds.playSelect();
              onOpenHelp();
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700 bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white transition cursor-pointer"
            title="Game Manual & Rules"
          >
            <HelpCircle className="h-4 w-4" />
          </button>

          {/* End Turn CTA */}
          <button
            disabled={isAiProcessing}
            onClick={() => {
              sounds.playTurnEnd();
              onEndTurn();
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-1.5 font-bold text-sm tracking-wide shadow-lg transition cursor-pointer ${
              isAiProcessing
                ? 'bg-amber-600/60 text-amber-100 cursor-wait'
                : 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 hover:shadow-amber-500/20 active:scale-95'
            }`}
          >
            {isAiProcessing ? (
              <>
                <FastForward className="h-4 w-4 animate-spin" />
                <span>{aiProcessingName || 'Rivals Thinking...'}</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" />
                <span>End Turn</span>
              </>
            )}
          </button>
        </div>
      </div>
    </header>
  );
};
