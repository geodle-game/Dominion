import React from 'react';
import { BookOpen, Swords, Footprints, Coins, Castle, Shield, Sparkles, FlaskConical, Tent } from 'lucide-react';

interface HelpModalProps {
  onClose: () => void;
}

export const HelpModal: React.FC<HelpModalProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-none select-none">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Imperial Strategic Codex</h2>
              <p className="text-xs text-slate-400">Tactical warfare, technology trees, and imperial statecraft</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-xs text-slate-300 leading-relaxed">
          {/* Controls & Hotkeys */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="font-bold text-sm text-amber-400 mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Field Controls & Hotkeys
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
              <div>
                <span className="font-mono text-amber-300">W / A / S / D</span> or <span className="font-mono text-amber-300">Right-Drag</span>: Pan across realm
              </div>
              <div>
                <span className="font-mono text-amber-300">Q / E</span>: Orbit / rotate battlefield view
              </div>
              <div>
                <span className="font-mono text-amber-300">Mouse Wheel</span>: Zoom in / out
              </div>
              <div>
                <span className="font-mono text-amber-300">T</span>: Open Technology Research Tree
              </div>
              <div>
                <span className="font-mono text-amber-300">L</span>: Open Ministry of Treasury Ledger
              </div>
              <div>
                <span className="font-mono text-amber-300">Space</span>: Conclude imperial turn
              </div>
            </div>
          </div>

          {/* Technology Tree & Empire Scaling */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="font-bold text-sm text-purple-400 mb-2 flex items-center gap-2">
              <FlaskConical className="h-4 w-4" /> Technology Tree & Empire-Size Scaling
            </h3>
            <p>
              Dominion features 16 interconnected technologies across 4 specialized branches:
            </p>
            <ul className="list-disc list-inside mt-1.5 space-y-1 text-slate-400">
              <li><strong className="text-emerald-300">Agriculture & Economy:</strong> Farming, Irrigation (famine immunity), Trade (+2g per city route), Administration (+15% gross revenue).</li>
              <li><strong className="text-sky-300">Exploration & Expansion:</strong> Scouting (vision 4, hill mastery), Roads (0.5 MP in territory), Settlements (Settler recruitment), Navigation (embark on water).</li>
              <li><strong className="text-rose-300">Military:</strong> Forged Steel (+1 melee atk), Armour (Phalanx Spearmen), Tactics (Longbowmen & +25% flanking), Siegecraft (Trebuchets).</li>
              <li><strong className="text-amber-300">Engineering:</strong> Construction (Workshops), Fortifications (Walls & +40% fortify def), Logistics (-1 unit upkeep), Advanced Engineering (Range 3 Trebuchets).</li>
            </ul>
            <div className="mt-3 rounded bg-purple-950/30 border border-purple-500/30 p-2 font-mono text-[11px] text-purple-300">
              Polytopia-Style Scaling: Research Cost = Base (40g/70g/120g) + (Cities Count - 1) × Scaling Factor.
              Rapid expansion increases research costs, creating a vital choice between wide conquest and technological focus!
            </div>
          </div>

          {/* Tactical Roles & Combat Counters */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="font-bold text-sm text-rose-400 mb-2 flex items-center gap-2">
              <Swords className="h-4 w-4" /> Tactical Combat & Unit Counters
            </h3>
            <p>
              Hovering over an enemy unit in range displays a live <strong>Tactical Engagement Forecast</strong> with projected damage and modifiers:
            </p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
              <div className="rounded bg-slate-900/60 p-2 border border-slate-800">
                <strong className="text-amber-300">Phalanx vs Cavalry:</strong> Spearmen gain <span className="text-emerald-400 font-bold">+50% combat bonus</span> against Knights.
              </div>
              <div className="rounded bg-slate-900/60 p-2 border border-slate-800">
                <strong className="text-amber-300">Siege vs Citadels:</strong> Trebuchets deliver <span className="text-amber-400 font-bold">+100% damage</span> against Cities and Fortified garrisons.
              </div>
              <div className="rounded bg-slate-900/60 p-2 border border-slate-800">
                <strong className="text-amber-300">Flanking Maneuvers:</strong> Attacking an enemy that borders an ally deals <span className="text-sky-400 font-bold">+25% flanking bonus</span> (requires Tactics).
              </div>
              <div className="rounded bg-slate-900/60 p-2 border border-slate-800">
                <strong className="text-amber-300">Ranged Volleys:</strong> Longbowmen and Trebuchets attack from 2 range without taking melee retaliation.
              </div>
            </div>
          </div>

          {/* Colonization & Expansion */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="font-bold text-sm text-emerald-400 mb-2 flex items-center gap-2">
              <Tent className="h-4 w-4" /> Frontier Colonization
            </h3>
            <p>
              Researching <strong>Frontier Colonisation</strong> unlocks Frontier Settlers. Move a Settler to an unclaimed fertile hex and click <strong>"Found New Colony Here"</strong> in the tile panel to establish a new Level 1 City and claim the surrounding territory!
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/60 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-xl bg-amber-500 hover:bg-amber-400 px-6 py-2 text-xs font-bold text-slate-950 transition cursor-pointer"
          >
            Return to Command
          </button>
        </div>
      </div>
    </div>
  );
};
