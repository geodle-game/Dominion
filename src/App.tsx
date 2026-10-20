import React, { useEffect, useRef, useState, useCallback } from 'react';
import { ThreeScene } from './three/ThreeScene';
import { generateWorldMap } from './game/mapGenerator';
import { GameEngine } from './game/gameEngine';
import { AIEngine } from './game/aiEngine';
import { getReachableTiles, getTilesInRange, hexDistance, hexToKey } from './game/hexUtils';
import { BUILDING_DEFINITIONS, TECHNOLOGIES, TERRAIN_DATA, UNIT_DEFINITIONS } from './game/constants';
import {
  BuildingType,
  City,
  CombatPreview,
  FogState,
  GameLog,
  GamePhase,
  HexTile,
  Kingdom,
  TechId,
  Unit,
  UnitType,
} from './types/game';
import { sounds } from './audio/soundManager';

import { TopBar } from './components/TopBar';
import { TileInfoPanel } from './components/TileInfoPanel';
import { CityManagementModal } from './components/CityManagementModal';
import { EconomyLedgerModal } from './components/EconomyLedgerModal';
import { TechTreeModal } from './components/TechTreeModal';
import { CombatPreviewCard } from './components/CombatPreviewCard';
import { CombatLogPanel } from './components/CombatLogPanel';
import { Minimap } from './components/Minimap';
import { TitleScreen } from './components/TitleScreen';
import { GameOverModal } from './components/GameOverModal';
import { HelpModal } from './components/HelpModal';

export default function App() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<ThreeScene | null>(null);

  // Core Game State
  const [phase, setPhase] = useState<GamePhase>('title');
  const [turn, setTurn] = useState<number>(1);
  const [tiles, setTiles] = useState<Map<string, HexTile>>(new Map());
  const [units, setUnits] = useState<Map<string, Unit>>(new Map());
  const [cities, setCities] = useState<Map<string, City>>(new Map());
  const [kingdoms, setKingdoms] = useState<Kingdom[]>([]);
  const [fogMap, setFogMap] = useState<Map<string, FogState>>(new Map());
  const [exploredTiles, setExploredTiles] = useState<Set<string>>(new Set());

  // Interactive Selection State
  const [selectedTileKey, setSelectedTileKey] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [combatPreview, setCombatPreview] = useState<{
    attacker: Unit;
    defender: Unit;
    preview: CombatPreview;
    tileName: string;
  } | null>(null);

  // Modals
  const [activeModal, setActiveModal] = useState<'city' | 'ledger' | 'help' | 'techtree' | null>(null);
  const [activeCityId, setActiveCityId] = useState<string | null>(null);

  // Turn processing & UI
  const [isAiProcessing, setIsAiProcessing] = useState<boolean>(false);
  const [aiProcessingName, setAiProcessingName] = useState<string>('');
  const [gameLogs, setGameLogs] = useState<GameLog[]>([]);
  const [isMuted, setIsMuted] = useState<boolean>(false);

  // Campaign Metrics
  const [stats, setStats] = useState({
    unitsLost: 0,
    enemiesDefeated: 0,
  });

  // Authoritative references to prevent stale closures in event callbacks
  const stateRef = useRef({
    phase,
    tiles,
    units,
    cities,
    kingdoms,
    fogMap,
    exploredTiles,
    selectedTileKey,
    selectedUnitId,
    turn,
    isAiProcessing,
  });

  useEffect(() => {
    stateRef.current = {
      phase,
      tiles,
      units,
      cities,
      kingdoms,
      fogMap,
      exploredTiles,
      selectedTileKey,
      selectedUnitId,
      turn,
      isAiProcessing,
    };
  }, [phase, tiles, units, cities, kingdoms, fogMap, exploredTiles, selectedTileKey, selectedUnitId, turn, isAiProcessing]);

  // Log helper
  const addLog = useCallback((text: string, type: GameLog['type'] = 'system') => {
    const newLog: GameLog = {
      id: `${Date.now()}-${Math.random()}`,
      turn: stateRef.current.turn,
      text,
      type,
      timestamp: Date.now(),
    };
    setGameLogs(prev => [newLog, ...prev]);
  }, []);

  // Update visual state across ThreeScene
  const syncSceneVisuals = useCallback(
    (
      newTiles: Map<string, HexTile>,
      newUnits: Map<string, Unit>,
      newCities: Map<string, City>,
      newFog: Map<string, FogState>,
      newKingdoms: Kingdom[]
    ) => {
      if (!sceneRef.current) return;
      sceneRef.current.hexManager.updateVisualState(newTiles, newFog, newKingdoms);
      sceneRef.current.unitManager.updateUnits(newUnits, newTiles, newFog, newKingdoms);
      sceneRef.current.cityManager.updateCities(newCities, newTiles, newFog, newKingdoms);
    },
    []
  );

  // Update reachable/attack highlights for selected unit
  const updateUnitHighlights = useCallback(
    (
      unit: Unit,
      tState: Map<string, HexTile>,
      uState: Map<string, Unit>,
      fState: Map<string, FogState>,
      playerTechs: TechId[] = []
    ) => {
      if (!sceneRef.current) return;
      if (unit.movesLeft <= 0) {
        sceneRef.current.hexManager.clearHighlights();
        return;
      }

      const reachable = getReachableTiles(
        { q: unit.q, r: unit.r },
        unit.movesLeft,
        tState,
        uState,
        unit,
        playerTechs
      );
      const attackCoords = getTilesInRange({ q: unit.q, r: unit.r }, unit.range);
      const attackTargets: HexTile[] = [];

      if (!unit.hasAttacked && !unit.isCivilian) {
        for (const ac of attackCoords) {
          const k = hexToKey(ac.q, ac.r);
          const t = tState.get(k);
          const fog = fState.get(k);
          if (t && fog === 'visible' && t.unitId) {
            const occ = uState.get(t.unitId);
            if (occ && occ.ownerId !== 'player') {
              attackTargets.push(t);
            }
          }
        }
      }

      sceneRef.current.hexManager.showReachableAndTargets(reachable, attackTargets, tState);
    },
    []
  );

  // Initialize a new match
  const startNewGame = useCallback((mapRadius: number = 7, factionCount: number = 3) => {
    const mapData = generateWorldMap(mapRadius, Math.floor(Math.random() * 50000), factionCount);

    const playerFaction = mapData.kingdoms.find(k => k.id === 'player');
    const initialExplored = new Set<string>();
    const { fogMap: initialFog, updatedExplored } = GameEngine.calculateFogOfWar(
      'player',
      mapData.tiles,
      mapData.units,
      mapData.cities,
      initialExplored,
      playerFaction?.researchedTechs || []
    );

    setTiles(mapData.tiles);
    setUnits(mapData.units);
    setCities(mapData.cities);
    setKingdoms(mapData.kingdoms);
    setFogMap(initialFog);
    setExploredTiles(updatedExplored);
    setTurn(1);
    setSelectedTileKey(null);
    setSelectedUnitId(null);
    setCombatPreview(null);
    setActiveModal(null);
    setPhase('playing');
    setGameLogs([
      {
        id: 'start-1',
        turn: 1,
        text: 'The realm awakens. Solaria Prime stands as the radiant heart of your domain.',
        type: 'system',
        timestamp: Date.now(),
      },
    ]);
    setStats({ unitsLost: 0, enemiesDefeated: 0 });

    if (sceneRef.current) {
      sceneRef.current.hexManager.buildMap(mapData.tiles, mapData.kingdoms);
      sceneRef.current.hexManager.updateVisualState(mapData.tiles, initialFog, mapData.kingdoms);
      sceneRef.current.unitManager.updateUnits(mapData.units, mapData.tiles, initialFog, mapData.kingdoms);
      sceneRef.current.cityManager.updateCities(mapData.cities, mapData.tiles, initialFog, mapData.kingdoms);

      // Focus camera on player's capital
      const playerCap = Array.from(mapData.cities.values()).find(c => c.ownerId === 'player');
      if (playerCap) {
        sceneRef.current.cameraController.focusOnTile(playerCap.q, playerCap.r);
      }
    }
  }, []);

  // Handle Tile Clicks from 3D Scene
  const handleTileClick = useCallback(
    (q: number, r: number) => {
      const {
        phase: currPhase,
        tiles: curTiles,
        units: curUnits,
        cities: curCities,
        kingdoms: curKingdoms,
        fogMap: curFog,
        selectedUnitId: currUnitId,
        isAiProcessing: aiBusy,
      } = stateRef.current;

      if (currPhase !== 'playing' || aiBusy) return;

      const clickKey = hexToKey(q, r);
      const clickedTile = curTiles.get(clickKey);
      if (!clickedTile) return;

      const player = curKingdoms.find(k => k.id === 'player')!;
      const selectedUnit = currUnitId ? curUnits.get(currUnitId) : null;

      // Case 1: Friendly Unit is selected and player clicks a target tile
      if (selectedUnit && selectedUnit.ownerId === 'player' && selectedUnit.movesLeft > 0) {
        const reachable = getReachableTiles(
          { q: selectedUnit.q, r: selectedUnit.r },
          selectedUnit.movesLeft,
          curTiles,
          curUnits,
          selectedUnit,
          player.researchedTechs
        );

        const isReachable = reachable.has(clickKey);
        const occupant = clickedTile.unitId ? curUnits.get(clickedTile.unitId) : null;
        const isEnemyOccupant = occupant && occupant.ownerId !== 'player';

        // Attack enemy unit
        const inAttackRange =
          isEnemyOccupant &&
          !selectedUnit.isCivilian &&
          hexDistance({ q: selectedUnit.q, r: selectedUnit.r }, { q, r }) <= selectedUnit.range;

        if (inAttackRange && !selectedUnit.hasAttacked) {
          sounds.playAttack(selectedUnit.range > 1);
          const defenderKingdom = curKingdoms.find(k => k.id === occupant.ownerId);
          const combat = GameEngine.resolveCombat(
            selectedUnit,
            occupant,
            clickedTile,
            curTiles.get(hexToKey(selectedUnit.q, selectedUnit.r))!,
            curTiles,
            curUnits,
            player.researchedTechs,
            defenderKingdom?.researchedTechs || []
          );

          if (sceneRef.current) {
            sceneRef.current.unitManager.triggerAttack(selectedUnit.id);
            sceneRef.current.vfxManager.spawnCombatImpact(clickedTile.x, 0.8, clickedTile.z);
          }

          addLog(combat.log, 'combat');
          setCombatPreview(null);

          const nextUnits = new Map(curUnits);
          const nextTiles = new Map(curTiles);
          const nextCities = new Map(curCities);

          occupant.hp = Math.max(0, occupant.hp - combat.defenderDamage);
          selectedUnit.hp = Math.max(0, selectedUnit.hp - combat.attackerDamage);
          selectedUnit.hasAttacked = true;
          selectedUnit.movesLeft = 0;
          selectedUnit.isFortified = false;

          if (occupant.hp <= 0) {
            nextUnits.delete(occupant.id);
            clickedTile.unitId = null;
            setStats(s => ({ ...s, enemiesDefeated: s.enemiesDefeated + 1 }));

            // Advance melee unit into conquered hex
            if (selectedUnit.range === 1 && selectedUnit.hp > 0 && !selectedUnit.isCivilian) {
              const oldTile = nextTiles.get(hexToKey(selectedUnit.q, selectedUnit.r));
              if (oldTile) oldTile.unitId = null;
              clickedTile.unitId = selectedUnit.id;
              selectedUnit.q = q;
              selectedUnit.r = r;

              if (clickedTile.cityId) {
                const c = nextCities.get(clickedTile.cityId);
                if (c && c.ownerId !== 'player') {
                  sounds.playCapture();
                  GameEngine.captureCity(c, 'player', nextTiles);
                  addLog(`Imperial forces conquered and annexed ${c.name}!`, 'conquest');
                }
              }
            }
          }

          if (selectedUnit.hp <= 0) {
            nextUnits.delete(selectedUnit.id);
            const oldTile = nextTiles.get(hexToKey(selectedUnit.q, selectedUnit.r));
            if (oldTile) oldTile.unitId = null;
            setSelectedUnitId(null);
            setStats(s => ({ ...s, unitsLost: s.unitsLost + 1 }));
          }

          const { fogMap: nextFog, updatedExplored } = GameEngine.calculateFogOfWar(
            'player',
            nextTiles,
            nextUnits,
            nextCities,
            stateRef.current.exploredTiles,
            player.researchedTechs
          );

          setUnits(nextUnits);
          setTiles(nextTiles);
          setCities(nextCities);
          setFogMap(nextFog);
          setExploredTiles(updatedExplored);
          setSelectedTileKey(clickKey);

          syncSceneVisuals(nextTiles, nextUnits, nextCities, nextFog, curKingdoms);
          sceneRef.current?.hexManager.clearHighlights();

          const outcome = GameEngine.checkEndConditions(curKingdoms, nextCities);
          if (outcome) {
            if (outcome === 'victory') sounds.playVictory();
            else sounds.playDefeat();
            setPhase(outcome);
          }
          return;
        }

        // Move unit to reachable empty hex
        if (isReachable && !clickedTile.unitId) {
          sounds.playMove();
          const nextUnits = new Map(curUnits);
          const nextTiles = new Map(curTiles);
          const nextCities = new Map(curCities);

          const oldTile = nextTiles.get(hexToKey(selectedUnit.q, selectedUnit.r));
          if (oldTile) oldTile.unitId = null;

          clickedTile.unitId = selectedUnit.id;
          selectedUnit.q = q;
          selectedUnit.r = r;
          selectedUnit.movesLeft = reachable.get(clickKey) || 0;
          selectedUnit.isFortified = false;

          // Check if capturing undefended enemy city
          if (clickedTile.cityId) {
            const c = nextCities.get(clickedTile.cityId);
            if (c && c.ownerId !== 'player') {
              sounds.playCapture();
              GameEngine.captureCity(c, 'player', nextTiles);
              addLog(`Imperial troops occupied and claimed undefended ${c.name}!`, 'conquest');
            }
          }

          const { fogMap: nextFog, updatedExplored } = GameEngine.calculateFogOfWar(
            'player',
            nextTiles,
            nextUnits,
            nextCities,
            stateRef.current.exploredTiles,
            player.researchedTechs
          );

          // Update authoritative stateRef synchronously
          stateRef.current.tiles = nextTiles;
          stateRef.current.units = nextUnits;
          stateRef.current.cities = nextCities;
          stateRef.current.fogMap = nextFog;
          stateRef.current.exploredTiles = updatedExplored;
          stateRef.current.selectedTileKey = clickKey;

          setUnits(nextUnits);
          setTiles(nextTiles);
          setCities(nextCities);
          setFogMap(nextFog);
          setExploredTiles(updatedExplored);
          setSelectedTileKey(clickKey);
          setCombatPreview(null);

          // Update selection highlight to follow the moved unit
          sceneRef.current?.hexManager.setSelection(clickedTile);
          syncSceneVisuals(nextTiles, nextUnits, nextCities, nextFog, curKingdoms);

          addLog(
            `${selectedUnit.name} advanced to ${TERRAIN_DATA[clickedTile.terrain]?.name || 'hex'} (${q}, ${r}). [${selectedUnit.movesLeft} MP left]`,
            'system'
          );

          if (selectedUnit.movesLeft > 0) {
            updateUnitHighlights(selectedUnit, nextTiles, nextUnits, nextFog, player.researchedTechs);
          } else {
            stateRef.current.selectedUnitId = null;
            setSelectedUnitId(null);
            sceneRef.current?.hexManager.clearHighlights();
          }

          const outcome = GameEngine.checkEndConditions(curKingdoms, nextCities);
          if (outcome) {
            if (outcome === 'victory') sounds.playVictory();
            else sounds.playDefeat();
            setPhase(outcome);
          }
          return;
        }
      }

      // Case 2: Standard tile/unit selection
      sounds.playSelect();
      setSelectedTileKey(clickKey);
      stateRef.current.selectedTileKey = clickKey;
      setCombatPreview(null);
      sceneRef.current?.hexManager.setSelection(clickedTile);

      const unitOnTile = clickedTile.unitId ? curUnits.get(clickedTile.unitId) : null;
      if (unitOnTile && unitOnTile.ownerId === 'player') {
        setSelectedUnitId(unitOnTile.id);
        stateRef.current.selectedUnitId = unitOnTile.id;
        updateUnitHighlights(unitOnTile, curTiles, curUnits, curFog, player.researchedTechs);
      } else {
        setSelectedUnitId(null);
        stateRef.current.selectedUnitId = null;
        sceneRef.current?.hexManager.clearHighlights();
      }
    },
    [addLog, syncSceneVisuals, updateUnitHighlights]
  );

  // End Turn Execution
  const handleEndTurn = useCallback(async () => {
    const {
      phase: currPhase,
      tiles: curTiles,
      units: curUnits,
      cities: curCities,
      kingdoms: curKingdoms,
      isAiProcessing: aiBusy,
      turn: curTurn,
    } = stateRef.current;

    if (currPhase !== 'playing' || aiBusy) return;

    setIsAiProcessing(true);
    setSelectedUnitId(null);
    setCombatPreview(null);
    sceneRef.current?.hexManager.clearHighlights();

    // 1. Process Player Economy & Reset Player Unit Movement
    const player = curKingdoms.find(k => k.id === 'player')!;
    const ledger = GameEngine.computeEconomicLedger(player, curTiles, curCities, curUnits);

    player.gold = Math.max(0, player.gold + ledger.netGold);
    player.food = Math.max(0, player.food + ledger.netFood);

    // Population growth if surplus food
    if (ledger.netFood > 8) {
      player.population += 1;
      player.food -= 8;
      addLog(`Agrarian abundance accelerated imperial population growth (+1 Population)!`, 'economy');
    } else if (player.food <= 0 && ledger.netFood < 0) {
      // Irrigation tech grants famine immunity
      if (player.researchedTechs.includes('irrigation')) {
        addLog('Canal Irrigation protected imperial population from starvation.', 'economy');
      } else {
        addLog('Grain granaries depleted! Famine threatens imperial provinces.', 'economy');
      }
    }

    const hasLogistics = player.researchedTechs.includes('logistics');
    for (const unit of curUnits.values()) {
      if (unit.ownerId === 'player') {
        unit.movesLeft = unit.maxMoves;
        unit.hasAttacked = false;
        // Fortified units heal 4 HP (or 6 HP if in city with Logistics)
        const inCity = curTiles.get(hexToKey(unit.q, unit.r))?.cityId !== null;
        const healAmt = inCity && hasLogistics ? 6 : unit.isFortified ? 4 : 0;
        if (healAmt > 0 && unit.hp < unit.maxHp) {
          unit.hp = Math.min(unit.maxHp, unit.hp + healAmt);
        }
      }
    }

    addLog(`Turn ${curTurn} concluded. Treasury balance: ${player.gold} Gold (${ledger.netGold >= 0 ? '+' : ''}${ledger.netGold}).`, 'economy');

    // 2. Sequential AI Opponent Turns
    const aiKingdoms = curKingdoms.filter(k => k.id !== 'player' && !k.isDefeated);

    for (const ai of aiKingdoms) {
      setAiProcessingName(`${ai.name}...`);
      await new Promise(r => setTimeout(r, 450));

      const aiLedger = GameEngine.computeEconomicLedger(ai, curTiles, curCities, curUnits);
      ai.gold = Math.max(0, ai.gold + aiLedger.netGold);
      ai.food = Math.max(0, ai.food + aiLedger.netFood);

      const aiLogs = AIEngine.processAITurn(ai, curTiles, curUnits, curCities, curKingdoms);
      aiLogs.forEach(l => {
        addLog(l.description, l.action === 'attack' ? 'combat' : l.action === 'capture' ? 'conquest' : 'diplomacy');
      });
    }

    // 3. Recalculate Player Fog of War
    const { fogMap: nextFog, updatedExplored } = GameEngine.calculateFogOfWar(
      'player',
      curTiles,
      curUnits,
      curCities,
      stateRef.current.exploredTiles,
      player.researchedTechs
    );

    const nextTurn = curTurn + 1;
    setTurn(nextTurn);
    setFogMap(nextFog);
    setExploredTiles(updatedExplored);

    syncSceneVisuals(curTiles, curUnits, curCities, nextFog, curKingdoms);

    // 4. Check End Conditions
    const outcome = GameEngine.checkEndConditions(curKingdoms, curCities);
    if (outcome) {
      if (outcome === 'victory') {
        sounds.playVictory();
        sceneRef.current?.vfxManager.spawnVictoryConfetti(0, 0);
      } else {
        sounds.playDefeat();
      }
      setPhase(outcome);
    }

    setIsAiProcessing(false);
    setAiProcessingName('');
  }, [addLog, syncSceneVisuals]);

  // Research Technology Handler
  const handleResearchTech = useCallback((techId: TechId) => {
    const player = kingdoms.find(k => k.id === 'player')!;
    const numCities = Array.from(cities.values()).filter(c => c.ownerId === 'player').length;
    const result = GameEngine.researchTechnology(player, techId, numCities);

    if (result.success) {
      setKingdoms([...kingdoms]);
      addLog(`Imperial breakthrough! Researched ${TECHNOLOGIES[techId]?.name} for ${result.cost} Gold.`, 'system');

      // Refresh highlights for selected unit
      if (selectedUnitId) {
        const u = units.get(selectedUnitId);
        if (u) {
          updateUnitHighlights(u, tiles, units, fogMap, player.researchedTechs);
        }
      }
    } else {
      addLog(result.error || 'Cannot research technology.', 'system');
    }
  }, [kingdoms, cities, selectedUnitId, units, tiles, fogMap, updateUnitHighlights, addLog]);

  // Settler Found Colony Handler
  const handleFoundCity = useCallback((unitId: string) => {
    const unit = units.get(unitId);
    const player = kingdoms.find(k => k.id === 'player')!;
    if (!unit || unit.ownerId !== 'player' || unit.type !== 'settler') return;

    const nextUnits = new Map(units);
    const nextTiles = new Map(tiles);
    const nextCities = new Map(cities);

    const result = GameEngine.foundNewCity(unit, player, nextTiles, nextCities, nextUnits);
    if (result.success && result.city) {
      const { fogMap: nextFog, updatedExplored } = GameEngine.calculateFogOfWar(
        'player',
        nextTiles,
        nextUnits,
        nextCities,
        exploredTiles,
        player.researchedTechs
      );

      setUnits(nextUnits);
      setTiles(nextTiles);
      setCities(nextCities);
      setFogMap(nextFog);
      setExploredTiles(updatedExplored);
      setSelectedUnitId(null);
      setCombatPreview(null);
      sceneRef.current?.hexManager.clearHighlights();

      syncSceneVisuals(nextTiles, nextUnits, nextCities, nextFog, kingdoms);
      addLog(`Founded new colony: ${result.city.name}! Expanded sovereign borders.`, 'conquest');
    } else {
      addLog(result.error || 'Cannot establish settlement here.', 'system');
    }
  }, [units, kingdoms, tiles, cities, exploredTiles, syncSceneVisuals, addLog]);

  // Unit Fortify Action
  const handleFortifyUnit = useCallback((unitId: string) => {
    const unit = units.get(unitId);
    if (!unit || unit.ownerId !== 'player') return;

    unit.isFortified = true;
    unit.movesLeft = 0;
    unit.hasAttacked = true;

    setUnits(new Map(units));
    sceneRef.current?.hexManager.clearHighlights();
    addLog(`${unit.name} fortified defenses in place (+25% / +40% Defense Bonus).`, 'system');
  }, [units, addLog]);

  // Unit Unfortify Action
  const handleUnfortifyUnit = useCallback((unitId: string) => {
    const unit = units.get(unitId);
    if (!unit || unit.ownerId !== 'player') return;

    unit.isFortified = false;
    setUnits(new Map(units));
    addLog(`${unit.name} broke defensive fortification and stands ready to maneuver.`, 'system');

    const player = kingdoms.find(k => k.id === 'player');
    if (selectedUnitId === unitId && unit.movesLeft > 0) {
      updateUnitHighlights(unit, tiles, units, fogMap, player?.researchedTechs || []);
    }
  }, [units, kingdoms, selectedUnitId, tiles, fogMap, updateUnitHighlights, addLog]);

  // Unit Disband Action
  const handleDisbandUnit = useCallback((unitId: string) => {
    const unit = units.get(unitId);
    if (!unit || unit.ownerId !== 'player') return;

    const uDef = UNIT_DEFINITIONS[unit.type];
    const refund = Math.floor(uDef.costGold * 0.4);

    const nextUnits = new Map(units);
    const nextTiles = new Map(tiles);

    const tile = nextTiles.get(hexToKey(unit.q, unit.r));
    if (tile) tile.unitId = null;
    nextUnits.delete(unitId);

    const player = kingdoms.find(k => k.id === 'player')!;
    player.gold += refund;

    setSelectedUnitId(null);
    setCombatPreview(null);
    sceneRef.current?.hexManager.clearHighlights();

    setUnits(nextUnits);
    setTiles(nextTiles);
    addLog(`Disbanded ${unit.name}, recovering ${refund} Gold into the treasury.`, 'economy');
  }, [units, tiles, kingdoms, addLog]);

  // Recruit Unit in City
  const handleRecruitUnit = useCallback((unitType: UnitType) => {
    if (!activeCityId) return;
    const city = cities.get(activeCityId);
    const player = kingdoms.find(k => k.id === 'player')!;
    const uDef = UNIT_DEFINITIONS[unitType];
    if (!city || !player || !uDef) return;

    const cityTile = tiles.get(hexToKey(city.q, city.r));
    if (!cityTile || cityTile.unitId !== null) return;

    if (player.gold < uDef.costGold || player.food < uDef.costFood || player.iron < uDef.costIron) {
      return;
    }

    player.gold -= uDef.costGold;
    player.food -= uDef.costFood;
    player.iron -= uDef.costIron;

    const newUnitId = `unit-player-${unitType}-${Date.now().toString(36)}`;
    const newUnit: Unit = {
      id: newUnitId,
      type: unitType,
      name: `Imperial ${uDef.name}`,
      ownerId: 'player',
      q: city.q,
      r: city.r,
      maxHp: uDef.maxHp,
      hp: uDef.maxHp,
      attack: uDef.attack,
      defense: uDef.defense,
      range: uDef.range,
      maxMoves: uDef.moves,
      movesLeft: 0,
      hasAttacked: true,
      visionRange: uDef.vision,
      veterancy: city.buildings.includes('barracks') ? 1 : 0,
      isFortified: true,
      isCivilian: uDef.isCivilian,
    };

    const nextUnits = new Map(units);
    const nextTiles = new Map(tiles);

    nextUnits.set(newUnitId, newUnit);
    cityTile.unitId = newUnitId;

    const { fogMap: nextFog, updatedExplored } = GameEngine.calculateFogOfWar(
      'player',
      nextTiles,
      nextUnits,
      cities,
      exploredTiles,
      player.researchedTechs
    );

    setUnits(nextUnits);
    setTiles(nextTiles);
    setFogMap(nextFog);
    setExploredTiles(updatedExplored);
    setActiveModal(null);

    syncSceneVisuals(nextTiles, nextUnits, cities, nextFog, kingdoms);
    addLog(`Recruited ${newUnit.name} at ${city.name}.`, 'system');
  }, [activeCityId, cities, kingdoms, tiles, units, exploredTiles, syncSceneVisuals, addLog]);

  // Construct City Building
  const handleBuildStructure = useCallback((bType: BuildingType) => {
    if (!activeCityId) return;
    const city = cities.get(activeCityId);
    const player = kingdoms.find(k => k.id === 'player')!;
    const bDef = BUILDING_DEFINITIONS[bType];
    if (!city || !player || !bDef) return;

    if (city.buildings.includes(bType) || player.gold < bDef.costGold) return;

    player.gold -= bDef.costGold;
    city.buildings.push(bType);

    if (bDef.defenseBonus > 0) {
      city.maxDefense += bDef.defenseBonus;
      city.defense += bDef.defenseBonus;
    }

    setCities(new Map(cities));
    setActiveModal(null);
    addLog(`Constructed ${bDef.name} in ${city.name}.`, 'economy');
  }, [activeCityId, cities, kingdoms, addLog]);

  // Set Fiscal Tax Policy
  const handleSetPolicy = useCallback((policy: Kingdom['taxPolicy']) => {
    const player = kingdoms.find(k => k.id === 'player')!;
    player.taxPolicy = policy;
    setKingdoms([...kingdoms]);
    addLog(`Imperial Decree enacted: ${policy.replace('_', ' ').toUpperCase()} established across the realm.`, 'economy');
  }, [kingdoms, addLog]);

  // Toggle Mute
  const handleToggleMute = useCallback(() => {
    const nextMuted = sounds.toggleMute();
    setIsMuted(nextMuted);
  }, []);

  // Pan Camera to World Location
  const handlePanToWorld = useCallback((x: number, z: number) => {
    if (sceneRef.current) {
      sceneRef.current.cameraController.target.set(x, 0, z);
    }
  }, []);

  // Initialize Three.js scene once on mount
  useEffect(() => {
    if (!containerRef.current) return;

    const scene = new ThreeScene(containerRef.current, {
      onTileClick: (q, r) => handleTileClick(q, r),
      onTileHover: (q, r) => {
        const key = hexToKey(q, r);
        const tile = stateRef.current.tiles.get(key);
        sceneRef.current?.hexManager.setHover(tile || null);

        // Calculate combat prediction preview if friendly unit selected
        const { selectedUnitId: sUnitId, units: uMap, tiles: tMap, fogMap: fMap, kingdoms: kList } = stateRef.current;
        if (sUnitId && tile && tile.unitId) {
          const sUnit = uMap.get(sUnitId);
          const tUnit = uMap.get(tile.unitId);
          const fState = fMap.get(key);
          if (
            sUnit &&
            sUnit.ownerId === 'player' &&
            !sUnit.hasAttacked &&
            !sUnit.isCivilian &&
            tUnit &&
            tUnit.ownerId !== 'player' &&
            fState === 'visible' &&
            hexDistance({ q: sUnit.q, r: sUnit.r }, { q: tUnit.q, r: tUnit.r }) <= sUnit.range
          ) {
            const playerK = kList.find(k => k.id === 'player')!;
            const defK = kList.find(k => k.id === tUnit.ownerId);
            const atkTile = tMap.get(hexToKey(sUnit.q, sUnit.r))!;
            const preview = GameEngine.calculateCombatPreview(
              sUnit,
              tUnit,
              tile,
              atkTile,
              tMap,
              uMap,
              playerK.researchedTechs,
              defK?.researchedTechs || []
            );
            setCombatPreview({
              attacker: sUnit,
              defender: tUnit,
              preview,
              tileName: TERRAIN_DATA[tile.terrain].name,
            });
            return;
          }
        }
        setCombatPreview(null);
      },
    });

    sceneRef.current = scene;
    startNewGame(7, 3);

    return () => {
      scene.destroy();
      sceneRef.current = null;
    };
  }, [handleTileClick, startNewGame]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (stateRef.current.phase !== 'playing') return;
      if (activeModal !== null) {
        if (e.code === 'Escape') setActiveModal(null);
        return;
      }

      if (e.code === 'Space') {
        e.preventDefault();
        handleEndTurn();
      } else if (e.code === 'Escape') {
        setSelectedUnitId(null);
        setSelectedTileKey(null);
        setCombatPreview(null);
        sceneRef.current?.hexManager.clearHighlights();
        sceneRef.current?.hexManager.setSelection(null);
      } else if (e.code === 'KeyT') {
        setActiveModal('techtree');
      } else if (e.code === 'KeyL') {
        setActiveModal('ledger');
      } else if (e.code === 'KeyH') {
        setActiveModal('help');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModal, handleEndTurn]);

  // Current selected objects
  const player = kingdoms.find(k => k.id === 'player') || kingdoms[0] || null;
  const selectedTile = selectedTileKey ? tiles.get(selectedTileKey) || null : null;
  const selectedUnit = selectedTile?.unitId ? units.get(selectedTile.unitId) || null : null;
  const selectedCity = selectedTile?.cityId ? cities.get(selectedTile.cityId) || null : null;
  const selectedFog = selectedTileKey ? fogMap.get(selectedTileKey) || 'unexplored' : 'unexplored';
  const playerCitiesCount = player ? Array.from(cities.values()).filter(c => c.ownerId === 'player').length : 1;

  const ledger = player
    ? GameEngine.computeEconomicLedger(player, tiles, cities, units)
    : {
        goldIncome: 0,
        goldExpenses: 0,
        netGold: 0,
        foodIncome: 0,
        foodExpenses: 0,
        netFood: 0,
        totalProduction: 0,
        incomeBreakdown: [],
        expenseBreakdown: [],
        workingPopulation: 0,
      };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 font-sans select-none">
      {/* Isolated Three.js WebGL Canvas Mount */}
      <div ref={containerRef} className="absolute inset-0 z-0 cursor-default" />

      {/* Title Screen Overlay */}
      {phase === 'title' && (
        <TitleScreen
          onStartGame={(rad, count) => startNewGame(rad, count)}
          onOpenHelp={() => setActiveModal('help')}
          isMuted={isMuted}
          onToggleMute={handleToggleMute}
        />
      )}

      {/* In-Game HUD Overlays */}
      {phase === 'playing' && player && (
        <>
          {/* Top Economic & Turn Bar */}
          <TopBar
            player={player}
            ledger={ledger}
            turn={turn}
            isAiProcessing={isAiProcessing}
            aiProcessingName={aiProcessingName}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
            onOpenLedger={() => setActiveModal('ledger')}
            onOpenTechTree={() => setActiveModal('techtree')}
            onOpenHelp={() => setActiveModal('help')}
            onEndTurn={handleEndTurn}
          />

          {/* Combat Log Chronicle on Top Left */}
          <CombatLogPanel logs={gameLogs} />

          {/* Tactical Combat Forecast Tooltip */}
          {combatPreview && (
            <CombatPreviewCard
              attacker={combatPreview.attacker}
              defender={combatPreview.defender}
              preview={combatPreview.preview}
              defenderTileName={combatPreview.tileName}
            />
          )}

          {/* Selected Tile / Unit / City Inspection Panel */}
          {selectedTile && (
            <TileInfoPanel
              tile={selectedTile}
              unit={selectedUnit}
              city={selectedCity}
              fogState={selectedFog}
              kingdoms={kingdoms}
              onFortifyUnit={handleFortifyUnit}
              onUnfortifyUnit={handleUnfortifyUnit}
              onDisbandUnit={handleDisbandUnit}
              onFoundCity={handleFoundCity}
              onOpenCityModal={(cId) => {
                setActiveCityId(cId);
                setActiveModal('city');
              }}
              onClose={() => {
                setSelectedTileKey(null);
                setSelectedUnitId(null);
                setCombatPreview(null);
                sceneRef.current?.hexManager.clearHighlights();
                sceneRef.current?.hexManager.setSelection(null);
              }}
              onFocusTile={(q, r) => sceneRef.current?.cameraController.focusOnTile(q, r)}
            />
          )}

          {/* Minimap Radar on Bottom Right */}
          <Minimap
            tiles={tiles}
            units={units}
            cities={cities}
            fogMap={fogMap}
            kingdoms={kingdoms}
            onPanToWorld={handlePanToWorld}
          />
        </>
      )}

      {/* Technology Tree Modal */}
      {activeModal === 'techtree' && player && (
        <TechTreeModal
          player={player}
          numCities={playerCitiesCount}
          onResearchTech={handleResearchTech}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* City Management Modal */}
      {activeModal === 'city' && activeCityId && cities.get(activeCityId) && player && (
        <CityManagementModal
          city={cities.get(activeCityId)!}
          cityTile={tiles.get(hexToKey(cities.get(activeCityId)!.q, cities.get(activeCityId)!.r))!}
          player={player}
          onRecruitUnit={handleRecruitUnit}
          onBuildStructure={handleBuildStructure}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Economic Ledger Modal */}
      {activeModal === 'ledger' && player && (
        <EconomyLedgerModal
          player={player}
          ledger={ledger}
          onSetPolicy={handleSetPolicy}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Codex / Help Modal */}
      {activeModal === 'help' && <HelpModal onClose={() => setActiveModal(null)} />}

      {/* Victory / Defeat Modal */}
      {(phase === 'victory' || phase === 'defeat') && (
        <GameOverModal
          status={phase}
          turn={turn}
          citiesControlled={Array.from(cities.values()).filter(c => c.ownerId === 'player').length}
          unitsLost={stats.unitsLost}
          enemiesDefeated={stats.enemiesDefeated}
          onRestart={() => setPhase('title')}
        />
      )}
    </div>
  );
}
