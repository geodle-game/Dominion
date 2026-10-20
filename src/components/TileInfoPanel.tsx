import React from 'react';
import { City, FogState, HexTile, Kingdom, Unit } from '../types/game';
import { TERRAIN_DATA, UNIT_DEFINITIONS } from '../game/constants';
import { Shield, Swords, Footprints, Eye, Castle, ChevronRight, Crosshair, Trash2, Tent, Sparkles } from 'lucide-react';
import { sounds } from '../audio/soundManager';

interface TileInfoPanelProps {
  tile: HexTile | null;
  unit: Unit | null;
  city: City | null;
  fogState: FogState;
  kingdoms: Kingdom[];
  onFortifyUnit: (unitId: string) => void;
  onUnfortifyUnit?: (unitId: string) => void;
  onDisbandUnit: (unitId: string) => void;
  onFoundCity?: (unitId: string) => void;
  onOpenCityModal: (cityId: string) => void;
  onClose: () => void;
  onFocusTile: (q: number, r: number) => void;
}

export const TileInfoPanel: React.FC<TileInfoPanelProps> = ({
  tile,
  unit,
  city,
  fogState,
  kingdoms,
  onFortifyUnit,
  onUnfortifyUnit,
  onDisbandUnit,
  onFoundCity,
  onOpenCityModal,
  onClose,
  onFocusTile,
}) => {
  if (!tile) return null;

  const tData = TERRAIN_DATA[tile.terrain];
  const owner = tile.ownerId ? kingdoms.find(k => k.id === tile.ownerId) : null;
  const isFriendlyUnit = unit?.ownerId === 'player';
  const isFriendlyCity = city?.ownerId === 'player';
  const uDef = unit ? UNIT_DEFINITIONS[unit.type] : null;

  const canFoundCity =
    unit &&
    unit.type === 'settler' &&
    unit.ownerId === 'player' &&
    !tile.cityId &&
    tile.terrain !== 'mountain' &&
    tile.terrain !== 'water';

  return (
    <div className="pointer-events-auto absolute bottom-4 left-4 z-20 w-84 rounded-xl border border-slate-700/80 bg-slate-900/95 p-3.5 text-slate-100 shadow-2xl backdrop-blur-none select-none">
      {/* Top Header: Coordinates & Terrain */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <div
            className="h-3.5 w-3.5 rounded-full border border-slate-500 shadow"
            style={{ backgroundColor: `#${tData.color.toString(16).padStart(6, '0')}` }}
          />
          <div>
            <h3 className="font-bold text-sm text-slate-100">{tData.name}</h3>
            <span className="text-[11px] text-slate-400 font-mono">
              Hex ({tile.q}, {tile.r})
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              sounds.playSelect();
              onFocusTile(tile.q, tile.r);
            }}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-amber-400 transition cursor-pointer"
            title="Focus camera here"
          >
            <Crosshair className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white transition cursor-pointer"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Terrain Attributes */}
      <div className="mt-2.5 grid grid-cols-3 gap-2 rounded-lg bg-slate-950/60 p-2 text-xs text-slate-300">
        <div>
          <span className="block text-[10px] text-slate-400 uppercase">Movement</span>
          <span className="font-bold text-slate-200">
            {tile.moveCost >= 900 ? 'Impassable' : `${tile.moveCost} MP`}
          </span>
        </div>
        <div>
          <span className="block text-[10px] text-slate-400 uppercase">Defense</span>
          <span className={`font-bold ${tile.defenseBonus > 0 ? 'text-emerald-400' : 'text-slate-300'}`}>
            {tile.defenseBonus > 0 ? `+${Math.round(tile.defenseBonus * 100)}%` : '0%'}
          </span>
        </div>
        <div>
          <span className="block text-[10px] text-slate-400 uppercase">Domain</span>
          <span className="font-bold text-slate-200 truncate">
            {owner ? owner.name.split(' ')[0] : 'Wilderness'}
          </span>
        </div>
      </div>

      {/* Resource bonus banner if present */}
      {tile.resourceBonus && (
        <div className="mt-2 flex items-center justify-between rounded bg-amber-950/40 border border-amber-600/30 px-2 py-1 text-xs text-amber-200">
          <span className="font-medium">Special Deposit:</span>
          <span className="font-bold capitalize">{tile.resourceBonus.replace('_', ' ')}</span>
        </div>
      )}

      {/* Unit Section */}
      {unit && (
        <div className="mt-3 rounded-lg border border-slate-700/60 bg-slate-800/60 p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded bg-slate-700 font-bold text-xs text-amber-400">
                {unit.type === 'settler' ? '⛺' : '⚔️'}
              </span>
              <div>
                <h4 className="font-bold text-xs text-slate-100">{unit.name}</h4>
                <span className="text-[10px] text-slate-400">
                  {unit.ownerId === 'player' ? 'Imperial Army' : 'Hostile Army'}
                  {unit.veterancy > 0 && ` · Rank ${unit.veterancy}`}
                </span>
              </div>
            </div>
            {unit.isFortified && (
              <span className="rounded bg-sky-900/60 px-1.5 py-0.5 text-[10px] font-bold text-sky-300 border border-sky-500/40">
                Fortified
              </span>
            )}
          </div>

          {/* Unit Traits */}
          {uDef?.traits && uDef.traits.length > 0 && (
            <div className="mt-1.5 rounded bg-amber-950/30 border border-amber-500/30 px-2 py-1 text-[10px] text-amber-300 flex items-center gap-1">
              <Sparkles className="h-3 w-3 shrink-0 text-amber-400" />
              <span>{uDef.traits[0]}</span>
            </div>
          )}

          {/* Unit Health Bar */}
          <div className="mt-2">
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-slate-400">Health</span>
              <span className="font-mono font-bold text-emerald-400">
                {unit.hp} / {unit.maxHp} HP
              </span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-slate-900 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  unit.hp / unit.maxHp > 0.5
                    ? 'bg-emerald-500'
                    : unit.hp / unit.maxHp > 0.25
                    ? 'bg-amber-500'
                    : 'bg-rose-500'
                }`}
                style={{ width: `${(unit.hp / unit.maxHp) * 100}%` }}
              />
            </div>
          </div>

          {/* Unit Stats Grid */}
          <div className="mt-2.5 grid grid-cols-4 gap-1 rounded bg-slate-900/80 p-1.5 text-center text-xs">
            <div title="Attack Strength">
              <Swords className="mx-auto h-3.5 w-3.5 text-rose-400" />
              <span className="font-bold text-slate-200">{unit.attack}</span>
            </div>
            <div title="Defense">
              <Shield className="mx-auto h-3.5 w-3.5 text-sky-400" />
              <span className="font-bold text-slate-200">{unit.defense}</span>
            </div>
            <div title="Movement Left / Max">
              <Footprints className="mx-auto h-3.5 w-3.5 text-emerald-400" />
              <span className="font-bold text-slate-200">
                {unit.movesLeft}/{unit.maxMoves}
              </span>
            </div>
            <div title="Vision Range">
              <Eye className="mx-auto h-3.5 w-3.5 text-amber-400" />
              <span className="font-bold text-slate-200">{unit.visionRange}</span>
            </div>
          </div>

          {/* Unit Actions (Only for player-controlled units) */}
          {isFriendlyUnit && (
            <div className="mt-2.5 flex flex-col gap-1.5 pt-1 border-t border-slate-700/60">
              {/* Movement Status Guidance Banner */}
              {unit.movesLeft > 0 ? (
                <div className="rounded bg-emerald-950/40 border border-emerald-500/30 px-2 py-1 text-[11px] text-emerald-300 flex items-center gap-1.5">
                  <Footprints className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <span>Ready to move: Click any green-highlighted hex on map</span>
                </div>
              ) : (
                <div className="rounded bg-slate-900/60 border border-slate-700/40 px-2 py-1 text-[10px] text-slate-400 italic text-center">
                  Movement spent · Refills on next turn (Space)
                </div>
              )}

              {/* Special Settler Found City Action */}
              {unit.type === 'settler' && onFoundCity && (
                <button
                  disabled={!canFoundCity}
                  onClick={() => {
                    sounds.playCapture();
                    onFoundCity(unit.id);
                  }}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition shadow cursor-pointer ${
                    canFoundCity
                      ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 hover:from-emerald-400 hover:to-teal-500 active:scale-95'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50'
                  }`}
                >
                  <Tent className="h-3.5 w-3.5" />
                  <span>Found New Colony Here</span>
                </button>
              )}

              <div className="flex items-center gap-1.5">
                {unit.isFortified ? (
                  <button
                    onClick={() => {
                      sounds.playSelect();
                      if (onUnfortifyUnit) onUnfortifyUnit(unit.id);
                    }}
                    className="flex-1 rounded bg-sky-800/80 hover:bg-sky-700 py-1 text-[11px] font-bold text-sky-100 transition cursor-pointer border border-sky-500/50"
                    title="Wake up unit (removes fortified stance)"
                  >
                    Wake Up / Unfortify
                  </button>
                ) : (
                  <button
                    disabled={unit.movesLeft === 0}
                    onClick={() => {
                      sounds.playSelect();
                      onFortifyUnit(unit.id);
                    }}
                    className="flex-1 rounded bg-slate-700/80 py-1 text-[11px] font-bold text-slate-200 hover:bg-slate-600 transition disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                    title="Fortify unit in position (+25% / +40% Defense)"
                  >
                    Fortify
                  </button>
                )}
                <button
                  onClick={() => {
                    sounds.playSelect();
                    onDisbandUnit(unit.id);
                  }}
                  className="rounded bg-rose-950/60 border border-rose-800/40 p-1 text-rose-300 hover:bg-rose-900/60 transition cursor-pointer"
                  title="Disband unit (Recovers gold)"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* City Section */}
      {city && (
        <div className="mt-3 rounded-lg border border-amber-600/40 bg-amber-950/20 p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Castle className="h-5 w-5 text-amber-400" />
              <div>
                <h4 className="font-bold text-xs text-amber-300">{city.name}</h4>
                <span className="text-[10px] text-slate-400">
                  {isFriendlyCity ? 'Imperial Citadel' : 'Rival Stronghold'} · Pop: {city.population}
                </span>
              </div>
            </div>
            <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-bold text-slate-300">
              Def {city.defense}/{city.maxDefense}
            </span>
          </div>

          {isFriendlyCity && (
            <button
              onClick={() => {
                sounds.playSelect();
                onOpenCityModal(city.id);
              }}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-amber-700 py-1.5 text-xs font-bold text-slate-950 hover:from-amber-500 hover:to-amber-600 shadow transition cursor-pointer"
            >
              <span>Manage Settlement</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
