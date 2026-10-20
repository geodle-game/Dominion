import React, { useState } from 'react';
import { Kingdom, TechBranch, TechId, Technology } from '../types/game';
import { calculateTechCost, TECHNOLOGIES } from '../game/constants';
import { FlaskConical, Check, Lock, ArrowRight, Sparkles, Shield, Compass, Wheat, Hammer } from 'lucide-react';
import { sounds } from '../audio/soundManager';

interface TechTreeModalProps {
  player: Kingdom;
  numCities: number;
  onResearchTech: (techId: TechId) => void;
  onClose: () => void;
}

export const TechTreeModal: React.FC<TechTreeModalProps> = ({
  player,
  numCities,
  onResearchTech,
  onClose,
}) => {
  const researched = player.researchedTechs || [];
  const [selectedTechId, setSelectedTechId] = useState<TechId>('farming');

  const selectedTech = TECHNOLOGIES[selectedTechId];
  const isResearched = researched.includes(selectedTechId);
  const prereqsMet = selectedTech.prerequisites.every(p => researched.includes(p));
  const isAvailable = !isResearched && prereqsMet;
  const currentCost = calculateTechCost(selectedTech.tier, numCities);
  const canAfford = player.gold >= currentCost;

  const branches: { id: TechBranch; title: string; icon: React.ReactNode; color: string; techs: TechId[] }[] = [
    {
      id: 'economy',
      title: 'Agriculture & Economy',
      icon: <Wheat className="h-4 w-4 text-emerald-400" />,
      color: 'border-emerald-500/40 text-emerald-300',
      techs: ['farming', 'irrigation', 'trade', 'administration'],
    },
    {
      id: 'exploration',
      title: 'Exploration & Expansion',
      icon: <Compass className="h-4 w-4 text-sky-400" />,
      color: 'border-sky-500/40 text-sky-300',
      techs: ['scouting', 'roads', 'settlements', 'navigation'],
    },
    {
      id: 'military',
      title: 'Military Supremacy',
      icon: <Shield className="h-4 w-4 text-rose-400" />,
      color: 'border-rose-500/40 text-rose-300',
      techs: ['improved_weapons', 'armour', 'tactics', 'siegecraft'],
    },
    {
      id: 'engineering',
      title: 'Engineering & Defence',
      icon: <Hammer className="h-4 w-4 text-amber-400" />,
      color: 'border-amber-500/40 text-amber-300',
      techs: ['construction', 'fortifications', 'logistics', 'advanced_engineering'],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-none select-none">
      <div className="relative w-full max-w-6xl rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/70 px-6 py-3.5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-400">
              <FlaskConical className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-wide text-slate-100 font-serif uppercase">
                  Imperial Research Academy
                </h2>
                <span className="rounded bg-purple-950/60 border border-purple-500/40 px-2 py-0.5 text-xs font-mono font-bold text-purple-300">
                  {researched.length} / 16 Researched
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Strategic breakthroughs expand military rosters, infrastructure, and territorial dominion
              </p>
            </div>
          </div>

          {/* Right: Treasury & City Scaling Readout */}
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="rounded-lg bg-amber-950/40 border border-amber-500/30 px-3 py-1.5 text-amber-200">
              <span className="text-amber-400 font-bold">🪙 Treasury: </span>
              <span className="font-bold text-sm">{player.gold} Gold</span>
            </div>
            <div className="hidden sm:block rounded-lg bg-slate-800/60 border border-slate-700 px-3 py-1.5 text-slate-300">
              <span>Domain Cities: </span>
              <span className="font-bold text-amber-300">{numCities}</span>
              <span className="text-[10px] text-slate-400 ml-1">(Scaling Active)</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Main Body */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          {/* Tech Tree Matrix (4 Columns) */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 bg-slate-950/30">
            {branches.map(branch => (
              <div
                key={branch.id}
                className="rounded-xl border border-slate-800/80 bg-slate-900/60 p-3.5 flex flex-col gap-3 shadow-inner"
              >
                {/* Branch Header */}
                <div className={`flex items-center gap-2 pb-2 border-b border-slate-800 font-bold text-xs ${branch.color}`}>
                  {branch.icon}
                  <span>{branch.title}</span>
                </div>

                {/* Branch Tech Nodes */}
                <div className="flex flex-col gap-2.5">
                  {branch.techs.map(techId => {
                    const tech = TECHNOLOGIES[techId];
                    const done = researched.includes(techId);
                    const ready = !done && tech.prerequisites.every(p => researched.includes(p));
                    const cost = calculateTechCost(tech.tier, numCities);
                    const isSelected = selectedTechId === techId;

                    return (
                      <div
                        key={techId}
                        onClick={() => {
                          sounds.playSelect();
                          setSelectedTechId(techId);
                        }}
                        className={`group relative rounded-xl border p-3 cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'ring-2 ring-amber-400 border-amber-400 bg-amber-500/10 shadow-lg'
                            : done
                            ? 'border-emerald-500/50 bg-emerald-950/20 hover:border-emerald-400'
                            : ready
                            ? 'border-amber-500/40 bg-slate-800/80 hover:border-amber-400 hover:bg-slate-800'
                            : 'border-slate-800 bg-slate-950/50 opacity-60 hover:opacity-80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{tech.icon}</span>
                            <div>
                              <h4 className="font-bold text-xs text-slate-100 group-hover:text-amber-300 transition">
                                {tech.name}
                              </h4>
                              <span className="text-[10px] text-slate-400 font-mono">
                                Tier {tech.tier}
                              </span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div>
                            {done ? (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500/20 border border-emerald-500 text-emerald-400">
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            ) : ready ? (
                              <span className="rounded bg-amber-500/20 border border-amber-500/50 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-300">
                                {cost}g
                              </span>
                            ) : (
                              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 border border-slate-700 text-slate-500">
                                <Lock className="h-3 w-3" />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Prerequisites connection hint */}
                        {tech.prerequisites.length > 0 && (
                          <div className="mt-2 text-[10px] text-slate-400 border-t border-slate-800/60 pt-1 flex items-center gap-1">
                            <span>Requires:</span>
                            <span className="text-slate-300 font-medium truncate">
                              {tech.prerequisites.map(p => TECHNOLOGIES[p]?.name.split(' ')[0]).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Right Detail & Action Panel */}
          <div className="w-full lg:w-96 border-t lg:border-t-0 lg:border-l border-slate-800 bg-slate-950/80 p-6 flex flex-col justify-between">
            <div>
              {/* Selected Tech Card */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl p-2 rounded-xl bg-slate-800 border border-slate-700">
                  {selectedTech.icon}
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-100">{selectedTech.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="capitalize">{selectedTech.branch}</span> ·{' '}
                    <span className="font-mono">Tier {selectedTech.tier}</span>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-300 leading-relaxed mb-4">
                {selectedTech.description}
              </p>

              {/* Game Effects */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3.5 mb-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Breakthrough Capabilities
                </h4>
                <ul className="space-y-1.5 text-xs text-slate-200">
                  {selectedTech.gameEffects.map((eff, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-emerald-400 font-bold mt-0.5">•</span>
                      <span>{eff}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Research Cost Formula Breakdown */}
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3.5 text-xs">
                <div className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1">
                  Polytopia-Style Empire Cost Formula
                </div>
                <div className="font-mono text-slate-300">
                  Base ({selectedTech.baseCost}g) + ({numCities} cities - 1) × {selectedTech.tier === 1 ? 12 : selectedTech.tier === 2 ? 20 : 35}g ={' '}
                  <span className="font-bold text-amber-300 text-sm">{currentCost} Gold</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Research cost increases as your empire expands its settled colonies.
                </div>
              </div>

              {/* Prerequisites check */}
              {selectedTech.prerequisites.length > 0 && (
                <div className="mt-4 text-xs">
                  <span className="font-bold text-slate-400">Prerequisites:</span>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {selectedTech.prerequisites.map(p => {
                      const pDone = researched.includes(p);
                      return (
                        <span
                          key={p}
                          className={`rounded px-2 py-0.5 text-[11px] font-bold border ${
                            pDone
                              ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-300'
                              : 'border-rose-500/40 bg-rose-950/30 text-rose-300'
                          }`}
                        >
                          {TECHNOLOGIES[p]?.name} {pDone ? '✓' : '✗'}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Research CTA */}
            <div className="pt-6 border-t border-slate-800 mt-6">
              {isResearched ? (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-950/40 border border-emerald-500/40 py-3 text-xs font-bold text-emerald-300">
                  <Check className="h-4 w-4" />
                  <span>Technology Fully Operational</span>
                </div>
              ) : isAvailable ? (
                <button
                  disabled={!canAfford}
                  onClick={() => {
                    sounds.playRecruit();
                    onResearchTech(selectedTechId);
                  }}
                  className={`flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold shadow-lg transition active:scale-95 cursor-pointer ${
                    canAfford
                      ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  <FlaskConical className="h-4 w-4" />
                  <span>
                    {canAfford ? `Research for ${currentCost} Gold` : `Requires ${currentCost} Gold (Short ${currentCost - player.gold}g)`}
                  </span>
                </button>
              ) : (
                <div className="flex items-center justify-center gap-2 rounded-xl bg-slate-800/80 border border-slate-700 py-3 text-xs font-bold text-slate-400">
                  <Lock className="h-4 w-4" />
                  <span>Prerequisites Locked</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
