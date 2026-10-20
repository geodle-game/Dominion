import React from 'react';
import { BookOpen, Swords, Footprints, Coins, Eye, Castle, Shield, Sparkles } from 'lucide-react';

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
              <p className="text-xs text-slate-400">Rules of engagement, territorial annexation, and statecraft</p>
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
          {/* Controls */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="font-bold text-sm text-amber-400 mb-2 flex items-center gap-2">
              <Sparkles className="h-4 w-4" /> Camera & Field Controls
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
              <div>
                <span className="font-mono text-amber-300">W / A / S / D</span> or <span className="font-mono text-amber-300">Right-Drag</span>: Pan camera across realm
              </div>
              <div>
                <span className="font-mono text-amber-300">Mouse Wheel</span>: Zoom in / out
              </div>
              <div>
                <span className="font-mono text-amber-300">Q / E</span>: Orbit / rotate battlefield angle
              </div>
              <div>
                <span className="font-mono text-amber-300">Left Click</span>: Select tile, friendly unit, or city
              </div>
            </div>
          </div>

          {/* Movement & Fog of War */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="font-bold text-sm text-sky-400 mb-2 flex items-center gap-2">
              <Footprints className="h-4 w-4" /> Movement & Fog of War
            </h3>
            <p>
              Each unit has Movement Points (MP). Grassland costs 1 MP, while Forests, Hills, and Rivers cost 2 MP. Mountains and Deep Waters are impassable.
            </p>
            <p className="mt-2">
              Genuine Fog of War envelops the realm:
            </p>
            <ul className="list-disc list-inside mt-1 space-y-1 text-slate-400">
              <li><strong className="text-slate-200">Unexplored:</strong> Shrouded in black mist. Terrain and occupants unknown.</li>
              <li><strong className="text-slate-200">Explored:</strong> Previously charted terrain is remembered in dim light, but enemy unit positions are concealed!</li>
              <li><strong className="text-slate-200">Visible:</strong> In active line-of-sight of friendly regiments or cities. Fully lit with real-time troop detection.</li>
            </ul>
          </div>

          {/* Combat System */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="font-bold text-sm text-rose-400 mb-2 flex items-center gap-2">
              <Swords className="h-4 w-4" /> Combat & Fortifications
            </h3>
            <p>
              When a friendly unit is selected, reachable tiles glow <span className="text-emerald-400 font-bold">Green</span> and enemy targets glow <span className="text-rose-400 font-bold">Red</span>. Clicking an enemy attacks them.
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2 text-slate-400">
              <div>• <strong>Forests:</strong> +25% Defense</div>
              <div>• <strong>Hills:</strong> +35% Defense</div>
              <div>• <strong>Citadels:</strong> +35% Base Defense</div>
              <div>• <strong>Fortified Units:</strong> +25% Defense</div>
            </div>
            <p className="mt-2">
              Archers and Trebuchets can fire at range 2 without taking melee retaliation! Surviving battles grants units Veterancy, boosting their combat prowess by +12% per rank.
            </p>
          </div>

          {/* Economy & Victoria 3 Depth */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="font-bold text-sm text-emerald-400 mb-2 flex items-center gap-2">
              <Coins className="h-4 w-4" /> Economy & Imperial Decrees
            </h3>
            <p>
              Cities generate gold from commerce and working citizens. Farms supply grain to feed growing populations and military rations.
            </p>
            <p className="mt-2">
              Click the Treasury or Granary counter in the top bar to inspect the Economic Ledger and toggle decrees like <strong className="text-amber-300">War Mobilization</strong> or <strong className="text-sky-300">Mercantile Free Trade</strong>.
            </p>
          </div>

          {/* Victory Conditions */}
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-4">
            <h3 className="font-bold text-sm text-amber-400 mb-2 flex items-center gap-2">
              <Castle className="h-4 w-4" /> Victory & Defeat
            </h3>
            <p>
              Capture all rival kingdoms' capital citadels to achieve complete Imperial Hegemony. If your own capital falls to enemy forces, your empire collapses in defeat!
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
