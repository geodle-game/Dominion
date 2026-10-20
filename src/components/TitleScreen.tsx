import React, { useEffect, useState } from 'react';
import { Shield, Sparkles, Swords, Play, Compass, Volume2, VolumeX, BookOpen } from 'lucide-react';
import { sounds } from '../audio/soundManager';

interface TitleScreenProps {
  onStartGame: (mapRadius: number, factionCount: number) => void;
  onOpenHelp: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStartGame,
  onOpenHelp,
  isMuted,
  onToggleMute,
}) => {
  const [mapRadius, setMapRadius] = useState<number>(7);
  const [factionCount, setFactionCount] = useState<number>(3);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'Space') {
        sounds.playRecruit();
        onStartGame(mapRadius, factionCount);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mapRadius, factionCount, onStartGame]);

  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-between p-6 sm:p-12 pointer-events-auto bg-gradient-to-b from-slate-950/70 via-slate-900/50 to-slate-950/80 backdrop-blur-none select-none">
      {/* Top Bar on Title Screen */}
      <div className="w-full max-w-5xl flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2 tracking-widest font-mono uppercase text-amber-400 font-bold">
          <Sparkles className="h-4 w-4" />
          <span>Google AI Studio Build · Dominion 3D</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMute}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-850 px-2.5 py-1 text-slate-300 hover:text-white transition cursor-pointer"
          >
            {isMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            <span>{isMuted ? 'Muted' : 'Audio On'}</span>
          </button>
          <button
            onClick={() => {
              sounds.playSelect();
              onOpenHelp();
            }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-850 px-2.5 py-1 text-slate-300 hover:text-white transition cursor-pointer"
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Codex</span>
          </button>
        </div>
      </div>

      {/* Hero Centerpiece with Bespoke Inline SVG Title Lockup */}
      <div className="flex flex-col items-center text-center my-auto max-w-2xl">
        <div className="relative mb-3">
          {/* Bespoke Strategy Game Crown/Eagle Shield Logo SVG */}
          <svg className="w-24 h-24 mx-auto text-amber-400 drop-shadow-[0_0_25px_rgba(245,158,11,0.5)]" viewBox="0 0 100 100" fill="none">
            <polygon points="50,6 88,26 88,68 50,94 12,68 12,26" stroke="#f59e0b" strokeWidth="3" fill="#1e1b4b" fillOpacity="0.8" />
            <polygon points="50,14 80,30 80,64 50,86 20,64 20,30" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="3 3" />
            <path d="M50 24 L56 38 L72 38 L60 48 L64 62 L50 52 L36 62 L40 48 L28 38 L44 38 Z" fill="#f59e0b" />
            <circle cx="50" cy="74" r="3" fill="#60a5fa" />
          </svg>
        </div>

        <h1 className="text-4xl sm:text-6xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-600 font-serif drop-shadow-lg uppercase">
          Dominion
        </h1>
        <p className="mt-2 text-sm sm:text-base text-slate-300 font-medium tracking-wide">
          Turn-Based 3D Grand Strategy & Territorial Warfare
        </p>

        {/* Match Configuration Card */}
        <div className="mt-8 rounded-2xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-2xl w-full max-w-md text-left">
          <div className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-3 flex items-center gap-1.5">
            <Compass className="h-3.5 w-3.5" /> Realm Generation Parameters
          </div>

          <div className="space-y-4 text-xs">
            {/* Map Size */}
            <div>
              <div className="flex justify-between text-slate-300 font-medium mb-1.5">
                <span>Map Territory Scope</span>
                <span className="font-mono text-amber-400">
                  {mapRadius === 6 ? 'Compact (91 Hexes)' : mapRadius === 7 ? 'Standard (127 Hexes)' : 'Grand Realm (169 Hexes)'}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[6, 7, 8].map((rad) => (
                  <button
                    key={rad}
                    onClick={() => {
                      sounds.playSelect();
                      setMapRadius(rad);
                    }}
                    className={`rounded-lg py-1.5 font-bold transition cursor-pointer border ${
                      mapRadius === rad
                        ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {rad === 6 ? 'Compact' : rad === 7 ? 'Standard' : 'Grand'}
                  </button>
                ))}
              </div>
            </div>

            {/* Rival Factions */}
            <div>
              <div className="flex justify-between text-slate-300 font-medium mb-1.5">
                <span>Rival AI Kingdoms</span>
                <span className="font-mono text-amber-400">{factionCount - 1} Rival Dynasties</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {[3, 4].map((count) => (
                  <button
                    key={count}
                    onClick={() => {
                      sounds.playSelect();
                      setFactionCount(count);
                    }}
                    className={`rounded-lg py-1.5 font-bold transition cursor-pointer border ${
                      factionCount === count
                        ? 'border-amber-500 bg-amber-500/20 text-amber-200'
                        : 'border-slate-800 bg-slate-950 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    {count === 3 ? '2 Rivals (3 Factions)' : '3 Rivals (4 Factions)'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Primary CTA Button */}
          <button
            onClick={() => {
              sounds.playRecruit();
              onStartGame(mapRadius, factionCount);
            }}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600 py-3 text-sm font-black text-slate-950 shadow-xl shadow-amber-500/20 hover:from-amber-400 hover:to-amber-500 transition active:scale-95 cursor-pointer"
          >
            <Play className="h-4 w-4 fill-current" />
            <span>Found Your Empire</span>
          </button>
        </div>
      </div>

      {/* Flat Control-Hint Line */}
      <div className="w-full text-center text-xs text-slate-400 font-mono tracking-wider">
        <span className="text-slate-300">WASD / Right-Drag</span> Pan ·{' '}
        <span className="text-slate-300">Q / E</span> Rotate ·{' '}
        <span className="text-slate-300">Scroll</span> Zoom ·{' '}
        <span className="text-slate-300">Space / Enter</span> Action
      </div>
    </div>
  );
};
