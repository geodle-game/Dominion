import {
  BuildingType,
  City,
  CombatResult,
  EconomicLedger,
  FogState,
  HexCoord,
  HexTile,
  Kingdom,
  KingdomId,
  Unit,
  UnitType,
} from '../types/game';
import { BUILDING_DEFINITIONS, TERRAIN_DATA, UNIT_DEFINITIONS } from './constants';
import { getNeighbors, getTilesInRange, hexDistance, hexToKey } from './hexUtils';

export class GameEngine {
  /**
   * Recalculates fog of war visibility map for the active player.
   * Returns a map of tileKey -> FogState ('visible' | 'explored' | 'unexplored').
   */
  public static calculateFogOfWar(
    playerKingdomId: KingdomId,
    tiles: Map<string, HexTile>,
    units: Map<string, Unit>,
    cities: Map<string, City>,
    previousExplored: Set<string>
  ): { fogMap: Map<string, FogState>; updatedExplored: Set<string> } {
    const fogMap = new Map<string, FogState>();
    const currentVisible = new Set<string>();
    const updatedExplored = new Set<string>(previousExplored);

    // 1. Vision from player units
    for (const unit of units.values()) {
      if (unit.ownerId === playerKingdomId) {
        const visibleCoords = getTilesInRange({ q: unit.q, r: unit.r }, unit.visionRange);
        for (const c of visibleCoords) {
          const key = hexToKey(c.q, c.r);
          if (tiles.has(key)) {
            currentVisible.add(key);
            updatedExplored.add(key);
          }
        }
      }
    }

    // 2. Vision from player cities
    for (const city of cities.values()) {
      if (city.ownerId === playerKingdomId) {
        const visibleCoords = getTilesInRange({ q: city.q, r: city.r }, 2);
        for (const c of visibleCoords) {
          const key = hexToKey(c.q, c.r);
          if (tiles.has(key)) {
            currentVisible.add(key);
            updatedExplored.add(key);
          }
        }
      }
    }

    // 3. Vision from player territory (1 tile border)
    for (const tile of tiles.values()) {
      if (tile.ownerId === playerKingdomId) {
        const key = hexToKey(tile.q, tile.r);
        currentVisible.add(key);
        updatedExplored.add(key);
      }
    }

    // Assemble final fog state for all tiles
    for (const [key] of tiles.entries()) {
      if (currentVisible.has(key)) {
        fogMap.set(key, 'visible');
      } else if (updatedExplored.has(key)) {
        fogMap.set(key, 'explored');
      } else {
        fogMap.set(key, 'unexplored');
      }
    }

    return { fogMap, updatedExplored };
  }

  /**
   * Computes detailed economic ledger for a kingdom.
   */
  public static computeEconomicLedger(
    kingdom: Kingdom,
    tiles: Map<string, HexTile>,
    cities: Map<string, City>,
    units: Map<string, Unit>
  ): EconomicLedger {
    let baseGoldIncome = 10;
    let baseFoodIncome = 5;
    let baseProd = 6;

    const incomeBreakdown: { source: string; amount: number }[] = [
      { source: 'Crown Demesne Baseline', amount: baseGoldIncome },
    ];
    const expenseBreakdown: { source: string; amount: number }[] = [];

    // Cities income & buildings
    let cityGold = 0;
    let cityFood = 0;
    let cityProd = 0;
    let buildingUpkeep = 0;

    for (const city of cities.values()) {
      if (city.ownerId === kingdom.id) {
        const popIncome = Math.floor(city.population * 1.5);
        cityGold += popIncome;

        for (const bType of city.buildings) {
          const bDef = BUILDING_DEFINITIONS[bType];
          if (bDef) {
            cityGold += bDef.goldYield;
            cityFood += bDef.foodYield;
            cityProd += bDef.prodYield;
            buildingUpkeep += bDef.upkeep;
          }
        }
      }
    }

    if (cityGold > 0) {
      incomeBreakdown.push({ source: 'City Commerce & Population', amount: cityGold });
    }

    // Territory tile yields
    let tileGold = 0;
    let tileFood = 0;
    let tileProd = 0;

    for (const tile of tiles.values()) {
      if (tile.ownerId === kingdom.id) {
        const tData = TERRAIN_DATA[tile.terrain];
        if (tData) {
          tileGold += tData.gold;
          tileFood += tData.food;
          tileProd += tData.prod;
        }
        if (tile.resourceBonus === 'gold_ore') tileGold += 3;
        if (tile.resourceBonus === 'wheat') tileFood += 3;
        if (tile.resourceBonus === 'iron_ore') tileProd += 2;
        if (tile.resourceBonus === 'timber') tileProd += 2;
      }
    }

    if (tileGold > 0) incomeBreakdown.push({ source: 'Provincial Domain Yields', amount: tileGold });

    // Policy multipliers
    let goldMultiplier = 1.0;
    let foodMultiplier = 1.0;
    let prodMultiplier = 1.0;

    if (kingdom.taxPolicy === 'war_economy') {
      goldMultiplier = 1.3;
      prodMultiplier = 1.35;
      foodMultiplier = 0.75;
    } else if (kingdom.taxPolicy === 'free_trade') {
      goldMultiplier = 1.45;
      foodMultiplier = 1.15;
      prodMultiplier = 0.85;
    }

    const totalGrossGold = Math.floor((baseGoldIncome + cityGold + tileGold) * goldMultiplier);
    const totalGrossFood = Math.floor((baseFoodIncome + cityFood + tileFood) * foodMultiplier);
    const totalProd = Math.floor((baseProd + cityProd + tileProd) * prodMultiplier);

    // Expenses: Units upkeep
    let unitUpkeepGold = 0;
    let unitFoodConsumption = 0;
    for (const unit of units.values()) {
      if (unit.ownerId === kingdom.id) {
        const uDef = UNIT_DEFINITIONS[unit.type];
        if (uDef) {
          unitUpkeepGold += uDef.upkeep;
          unitFoodConsumption += 1;
        }
      }
    }

    // Population food consumption: 1 food per pop
    const popFoodConsumption = kingdom.population;

    if (unitUpkeepGold > 0) {
      expenseBreakdown.push({ source: 'Military Upkeep & Wages', amount: unitUpkeepGold });
    }
    if (buildingUpkeep > 0) {
      expenseBreakdown.push({ source: 'Civic Building Maintenance', amount: buildingUpkeep });
    }

    const totalGoldExpenses = unitUpkeepGold + buildingUpkeep;
    const totalFoodExpenses = popFoodConsumption + unitFoodConsumption;

    return {
      goldIncome: totalGrossGold,
      goldExpenses: totalGoldExpenses,
      netGold: totalGrossGold - totalGoldExpenses,
      foodIncome: totalGrossFood,
      foodExpenses: totalFoodExpenses,
      netFood: totalGrossFood - totalFoodExpenses,
      totalProduction: totalProd,
      incomeBreakdown,
      expenseBreakdown,
      workingPopulation: kingdom.population,
    };
  }

  /**
   * Resolves combat between an attacking unit and a defending unit or city.
   */
  public static resolveCombat(
    attacker: Unit,
    defender: Unit,
    defenderTile: HexTile,
    attackerTile: HexTile
  ): CombatResult {
    const isRanged = attacker.range >= 2 && hexDistance({ q: attacker.q, r: attacker.r }, { q: defender.q, r: defender.r }) > 1;

    // Terrain defense modifier
    let terrainDef = defenderTile.defenseBonus;
    if (defender.isFortified) terrainDef += 0.25;

    // Veterancy bonuses (+10% strength per level)
    const attackerVetBonus = 1 + attacker.veterancy * 0.12;
    const defenderVetBonus = 1 + defender.veterancy * 0.12;

    // Attack vs Defense calculation
    const effectiveAtk = attacker.attack * attackerVetBonus * (attacker.hp / attacker.maxHp * 0.5 + 0.5);
    const effectiveDef = defender.defense * defenderVetBonus * (1 + terrainDef);

    // Variance 0.9 to 1.15
    const variance = 0.9 + Math.random() * 0.25;
    const baseDamage = Math.max(3, Math.round((effectiveAtk / Math.max(1, effectiveDef)) * 10 * variance));

    const defenderDamage = Math.min(defender.hp, baseDamage);
    const defenderNewHp = Math.max(0, defender.hp - defenderDamage);
    const defenderDied = defenderNewHp <= 0;

    let attackerDamage = 0;
    let attackerDied = false;

    // Melee counter-attack if defender survived and can retaliate
    if (!isRanged && !defenderDied) {
      const counterAtk = defender.attack * defenderVetBonus * (defenderNewHp / defender.maxHp * 0.5 + 0.5);
      const counterDef = attacker.defense * attackerVetBonus * (1 + attackerTile.defenseBonus);
      const counterVariance = 0.85 + Math.random() * 0.3;
      attackerDamage = Math.max(1, Math.round((counterAtk / Math.max(1, counterDef)) * 7 * counterVariance));
      attackerDamage = Math.min(attacker.hp, attackerDamage);
      attackerDied = attacker.hp - attackerDamage <= 0;
    }

    let targetCaptured = false;
    if (defenderDied && defenderTile.cityId) {
      targetCaptured = true;
    }

    let log = '';
    if (isRanged) {
      log = `${attacker.name} fired upon ${defender.name} from range, dealing ${defenderDamage} dmg!`;
    } else {
      log = `${attacker.name} engaged ${defender.name} in melee combat! (-${defenderDamage} def, -${attackerDamage} atk)`;
    }
    if (defenderDied) {
      log += ` ${defender.name} was destroyed!`;
    }
    if (attackerDied) {
      log += ` ${attacker.name} fell in combat!`;
    }

    return {
      attackerId: attacker.id,
      defenderId: defender.id,
      attackerDamage,
      defenderDamage,
      attackerDied,
      defenderDied,
      targetCaptured,
      attackerTile: { q: attacker.q, r: attacker.r },
      defenderTile: { q: defender.q, r: defender.r },
      isRanged,
      log,
    };
  }

  /**
   * Captures a city and transfers territory ownership to conquering kingdom.
   */
  public static captureCity(
    city: City,
    conquerorId: KingdomId,
    tiles: Map<string, HexTile>
  ): void {
    const oldOwner = city.ownerId;
    city.ownerId = conquerorId;
    city.defense = Math.floor(city.maxDefense * 0.5); // reduced defense on capture

    // Transfer immediate ring of tiles
    const ring = getTilesInRange({ q: city.q, r: city.r }, 1);
    for (const c of ring) {
      const key = hexToKey(c.q, c.r);
      const tile = tiles.get(key);
      if (tile && (tile.ownerId === oldOwner || tile.ownerId === null)) {
        tile.ownerId = conquerorId;
      }
    }
  }

  /**
   * Check victory/defeat conditions.
   */
  public static checkEndConditions(
    kingdoms: Kingdom[],
    cities: Map<string, City>
  ): 'victory' | 'defeat' | null {
    const player = kingdoms.find(k => k.id === 'player');
    if (!player || player.isDefeated) return 'defeat';

    // Check if player has lost all cities
    let playerHasCity = false;
    for (const city of cities.values()) {
      if (city.ownerId === 'player') {
        playerHasCity = true;
        break;
      }
    }
    if (!playerHasCity) return 'defeat';

    // Check if all AI rival kingdoms are defeated or have lost all their cities
    let allRivalsDefeated = true;
    for (const k of kingdoms) {
      if (k.id !== 'player' && !k.isDefeated) {
        // Does this rival still have at least 1 city?
        let rivalHasCity = false;
        for (const city of cities.values()) {
          if (city.ownerId === k.id) {
            rivalHasCity = true;
            break;
          }
        }
        if (rivalHasCity) {
          allRivalsDefeated = false;
          break;
        }
      }
    }

    if (allRivalsDefeated) return 'victory';
    return null;
  }
}
