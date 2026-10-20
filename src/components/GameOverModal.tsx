import React from 'react';
import { Trophy, Skull, RotateCcw, Award, Shield, Swords } from 'lucide-react';
import { sounds } from '../audio/soundManager';

interface GameOverModalProps {
  status: 'victory' | 'defeat';
  turn: number;
  citiesControlled: number;
  unitsLost: number;
  enemiesDefeated: number;
  onRestart: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({
  status,
  turn,
  citiesControlled,
  unitsLost,
  enemiesDefeated,
  onRestart,
}) => {
  const isVictory = status === 'victory';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-none select-none">
      <div className="relative w-full max-w-lg rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl p-6 sm:p-8 text-center">
        {/* Emblem */}
        <div
          className={`mx-auto flex h-20 w-20 items-center justify-center rounded-2xl border-2 shadow-2xl ${
            isVictory
              ? 'border-amber-400 bg-amber-500/20 text-amber-400 shadow-amber-500/30'
              : 'border-rose-500 bg-rose-500/20 text-rose-500 shadow-rose-500/30'
          }`}
        >
          {isVictory ? <Trophy className="h-10 w-10" /> : <Skull className="h-10 w-10" />}
        </div>

        <h2 className="mt-4 text-3xl font-black tracking-wide font-serif uppercase">
          {isVictory ? 'Imperial Hegemony' : 'Empire in Ruins'}
        </h2>
        <p className="mt-2 text-xs sm:text-sm text-slate-400 max-w-sm mx-auto">
          {isVictory
            ? 'All rival capitals have fallen before your legions. The civilized world bows before your grand dominion!'
            : 'Your royal citadel was breached by hostile forces. Your dynasty fades into myth and sorrow.'}
        </p>

        {/* Campaign Stats Card */}
        <div className="my-6 grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl bg-slate-950/60 p-4 border border-slate-800 text-xs">
          <div>
            <span className="block text-[10px] text-slate-400 uppercase">Turns</span>
            <span className="font-bold font-mono text-base text-amber-300">{turn}</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 uppercase">Cities Held</span>
            <span className="font-bold font-mono text-base text-emerald-400">{citiesControlled}</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 uppercase">Enemies Slain</span>
            <span className="font-bold font-mono text-base text-rose-400">{enemiesDefeated}</span>
          </div>
          <div>
            <span className="block text-[10px] text-slate-400 uppercase">Legions Lost</span>
            <span className="font-bold font-mono text-base text-slate-400">{unitsLost}</span>
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={() => {
            sounds.playSelect();
            onRestart();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 py-3 text-sm font-bold text-slate-950 shadow-lg hover:from-amber-400 hover:to-amber-500 transition active:scale-95 cursor-pointer"
        >
          <RotateCcw className="h-4 w-4" />
          <span>Embark on New Campaign</span>
        </button>
      </div>
    </div>
  );
};
