import React, { useState } from 'react';
import { BuildingType, City, HexTile, Kingdom, UnitType } from '../types/game';
import { BUILDING_DEFINITIONS, TECHNOLOGIES, UNIT_DEFINITIONS } from '../game/constants';
import { Castle, Shield, Users, Lock, Plus, Check, AlertCircle, Sparkles } from 'lucide-react';
import { sounds } from '../audio/soundManager';

interface CityManagementModalProps {
  city: City;
  cityTile: HexTile;
  player: Kingdom;
  onRecruitUnit: (unitType: UnitType) => void;
  onBuildStructure: (buildingType: BuildingType) => void;
  onClose: () => void;
}

export const CityManagementModal: React.FC<CityManagementModalProps> = ({
  city,
  cityTile,
  player,
  onRecruitUnit,
  onBuildStructure,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'recruit' | 'buildings'>('recruit');

  const unitList = Object.values(UNIT_DEFINITIONS);
  const buildingList = Object.values(BUILDING_DEFINITIONS);
  const isCityTileOccupied = cityTile.unitId !== null;
  const researched = player.researchedTechs || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-none select-none">
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/60 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
              <Castle className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">{city.name}</h2>
              <div className="flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5 text-sky-400" />
                  Pop: {city.population}
                </span>
                <span className="flex items-center gap-1">
                  <Shield className="h-3.5 w-3.5 text-amber-400" />
                  Citadel Defense: {city.defense}/{city.maxDefense}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-800 px-6 pt-2 bg-slate-950/30">
          <button
            onClick={() => {
              sounds.playSelect();
              setActiveTab('recruit');
            }}
            className={`pb-2.5 px-4 text-sm font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'recruit'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Muster Army
          </button>
          <button
            onClick={() => {
              sounds.playSelect();
              setActiveTab('buildings');
            }}
            className={`pb-2.5 px-4 text-sm font-bold border-b-2 transition cursor-pointer ${
              activeTab === 'buildings'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Civic Works & Structures
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'recruit' && (
            <>
              {isCityTileOccupied && (
                <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-950/30 p-3 text-xs text-amber-200">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>The city citadel is currently garrisoned. Move the existing unit out of the hex to muster new regiments.</span>
                </div>
              )}

              <div className="grid gap-3">
                {unitList.map((unitDef) => {
                  const isTechUnlocked = !unitDef.requiredTech || researched.includes(unitDef.requiredTech);
                  const canAffordGold = player.gold >= unitDef.costGold;
                  const canAffordFood = player.food >= unitDef.costFood;
                  const canAffordIron = player.iron >= unitDef.costIron;
                  const canRecruit = isTechUnlocked && !isCityTileOccupied && canAffordGold && canAffordFood && canAffordIron;

                  return (
                    <div
                      key={unitDef.type}
                      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 transition ${
                        isTechUnlocked
                          ? 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                          : 'border-slate-900 bg-slate-950/20 opacity-60'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-sm text-slate-200">{unitDef.name}</h4>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 font-mono">
                            {unitDef.moves} MP · {unitDef.range > 1 ? `Range ${unitDef.range}` : 'Melee'}
                          </span>
                          {!isTechUnlocked && unitDef.requiredTech && (
                            <span className="flex items-center gap-1 rounded bg-rose-950/40 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                              <Lock className="h-3 w-3" /> Requires {TECHNOLOGIES[unitDef.requiredTech]?.name}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 max-w-md">{unitDef.description}</p>
                        {unitDef.traits && (
                          <div className="text-[11px] text-amber-400 font-medium pt-0.5">
                            {unitDef.traits.join(' · ')}
                          </div>
                        )}
                        <div className="flex items-center gap-3 text-xs text-slate-300 pt-1">
                          <span className="text-rose-400 font-bold">Atk {unitDef.attack}</span>
                          <span className="text-sky-400 font-bold">Def {unitDef.defense}</span>
                          <span className="text-emerald-400 font-bold">HP {unitDef.maxHp}</span>
                          <span className="text-slate-400">Upkeep: {unitDef.upkeep}g/t</span>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 shrink-0">
                        {/* Cost Badges */}
                        <div className="flex items-center gap-2 text-xs font-mono">
                          <span className={canAffordGold ? 'text-amber-300' : 'text-rose-400 font-bold'}>
                            🪙 {unitDef.costGold}
                          </span>
                          <span className={canAffordFood ? 'text-emerald-300' : 'text-rose-400 font-bold'}>
                            🌾 {unitDef.costFood}
                          </span>
                          {unitDef.costIron > 0 && (
                            <span className={canAffordIron ? 'text-slate-300' : 'text-rose-400 font-bold'}>
                              ⛏️ {unitDef.costIron}
                            </span>
                          )}
                        </div>

                        <button
                          disabled={!canRecruit}
                          onClick={() => {
                            sounds.playRecruit();
                            onRecruitUnit(unitDef.type);
                          }}
                          className={`rounded-lg px-4 py-1.5 text-xs font-bold transition shadow cursor-pointer ${
                            canRecruit
                              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold active:scale-95'
                              : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                          }`}
                        >
                          {!isTechUnlocked ? 'Tech Locked' : isCityTileOccupied ? 'Tile Occupied' : 'Recruit Regiment'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {activeTab === 'buildings' && (
            <div className="grid gap-3">
              {buildingList.map((bDef) => {
                const isTechUnlocked = !bDef.requiredTech || researched.includes(bDef.requiredTech);
                const isBuilt = city.buildings.includes(bDef.type);
                const canAfford = player.gold >= bDef.costGold;
                const canBuild = isTechUnlocked && !isBuilt && canAfford;

                return (
                  <div
                    key={bDef.type}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border p-4 transition ${
                      isTechUnlocked
                        ? 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                        : 'border-slate-900 bg-slate-950/20 opacity-60'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-slate-200">{bDef.name}</h4>
                        {isBuilt && (
                          <span className="flex items-center gap-1 rounded bg-emerald-950/60 border border-emerald-500/40 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                            <Check className="h-3 w-3" /> Operational
                          </span>
                        )}
                        {!isTechUnlocked && bDef.requiredTech && (
                          <span className="flex items-center gap-1 rounded bg-rose-950/40 border border-rose-500/30 px-2 py-0.5 text-[10px] font-bold text-rose-300">
                            <Lock className="h-3 w-3" /> Requires {TECHNOLOGIES[bDef.requiredTech]?.name}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 max-w-md">{bDef.description}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-300 pt-1">
                        {bDef.goldYield > 0 && <span className="text-amber-400 font-bold">+{bDef.goldYield} Gold/t</span>}
                        {bDef.foodYield > 0 && <span className="text-emerald-400 font-bold">+{bDef.foodYield} Food/t</span>}
                        {bDef.prodYield > 0 && <span className="text-sky-400 font-bold">+{bDef.prodYield} Prod/t</span>}
                        {bDef.defenseBonus > 0 && <span className="text-purple-400 font-bold">+{bDef.defenseBonus} City Def</span>}
                        <span className="text-slate-500">Upkeep: {bDef.upkeep}g/t</span>
                      </div>
                    </div>

                    <div className="flex sm:flex-col items-end justify-between sm:justify-center gap-2 shrink-0">
                      <div className="text-xs font-mono">
                        <span className={canAfford ? 'text-amber-300' : 'text-rose-400 font-bold'}>
                          🪙 {bDef.costGold} Gold
                        </span>
                      </div>

                      <button
                        disabled={!canBuild}
                        onClick={() => {
                          sounds.playRecruit();
                          onBuildStructure(bDef.type);
                        }}
                        className={`flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-xs font-bold transition shadow cursor-pointer ${
                          isBuilt
                            ? 'bg-slate-800 text-slate-500 cursor-default'
                            : canBuild
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 active:scale-95'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                        }`}
                      >
                        {isBuilt ? (
                          'Constructed'
                        ) : !isTechUnlocked ? (
                          'Tech Locked'
                        ) : (
                          <>
                            <Plus className="h-3.5 w-3.5" />
                            <span>Construct</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
