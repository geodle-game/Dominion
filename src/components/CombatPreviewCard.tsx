import React from 'react';
import { CombatPreview, Unit } from '../types/game';
import { Swords, Shield, Crosshair, AlertTriangle, Sparkles } from 'lucide-react';

interface CombatPreviewCardProps {
  attacker: Unit;
  defender: Unit;
  preview: CombatPreview;
  defenderTileName: string;
}

export const CombatPreviewCard: React.FC<CombatPreviewCardProps> = ({
  attacker,
  defender,
  preview,
  defenderTileName,
}) => {
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 z-30 w-80 rounded-xl border border-amber-500/60 bg-slate-900/95 p-3.5 text-slate-100 shadow-2xl backdrop-blur-none select-none">
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-xs">
        <span className="font-bold text-amber-400 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
          <Crosshair className="h-3.5 w-3.5" /> Tactical Engagement Forecast
        </span>
        <span className="text-[10px] text-slate-400 font-mono">{defenderTileName}</span>
      </div>

      {/* Comparison Grid */}
      <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
        {/* Attacker Forecast */}
        <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800">
          <div className="font-bold text-sky-400 truncate text-[11px]">{attacker.name}</div>
          <div className="mt-1 flex items-baseline justify-between font-mono">
            <span className="text-[10px] text-slate-400">Damage Dealt:</span>
            <span className="font-bold text-amber-400">-{preview.attackerDamage} HP</span>
          </div>
          <div className="flex items-baseline justify-between font-mono text-[10px] text-slate-400">
            <span>Resulting HP:</span>
            <span className="font-bold text-emerald-400">{preview.attackerRemainingHp} / {attacker.maxHp}</span>
          </div>
        </div>

        {/* Defender Forecast */}
        <div className="rounded-lg bg-slate-950/60 p-2 border border-slate-800">
          <div className="font-bold text-rose-400 truncate text-[11px]">{defender.name}</div>
          <div className="mt-1 flex items-baseline justify-between font-mono">
            <span className="text-[10px] text-slate-400">Counter Dmg:</span>
            <span className="font-bold text-rose-400">
              {preview.isRanged ? '0 (Ranged)' : `-${preview.defenderDamage} HP`}
            </span>
          </div>
          <div className="flex items-baseline justify-between font-mono text-[10px] text-slate-400">
            <span>Resulting HP:</span>
            <span className="font-bold text-rose-400">{preview.defenderRemainingHp} / {defender.maxHp}</span>
          </div>
        </div>
      </div>

      {/* Active Tactical Modifiers */}
      <div className="mt-2 space-y-1 text-[10px]">
        {preview.antiCavalryBonus && (
          <div className="flex items-center gap-1 text-emerald-400 font-bold bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-500/30">
            <Shield className="h-3 w-3" />
            <span>Anti-Cavalry Phalanx (+50% Damage)</span>
          </div>
        )}
        {preview.siegeBonus && (
          <div className="flex items-center gap-1 text-amber-400 font-bold bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-500/30">
            <Sparkles className="h-3 w-3" />
            <span>Siege Artillery (+100% vs Citadel/Walls)</span>
          </div>
        )}
        {preview.flankingBonus && (
          <div className="flex items-center gap-1 text-sky-400 font-bold bg-sky-950/40 px-1.5 py-0.5 rounded border border-sky-500/30">
            <Swords className="h-3 w-3" />
            <span>Tactical Flanking Maneuver (+25% Damage)</span>
          </div>
        )}
        {preview.terrainDefenseBonus > 0 && (
          <div className="flex items-center justify-between text-slate-400 px-1">
            <span>Terrain Defense:</span>
            <span className="font-mono text-emerald-400 font-bold">
              +{Math.round(preview.terrainDefenseBonus * 100)}%
            </span>
          </div>
        )}
      </div>

      <div className="mt-2 text-center text-[10px] text-amber-300 font-mono">
        Click target hex to confirm assault
      </div>
    </div>
  );
};
