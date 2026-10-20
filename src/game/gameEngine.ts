import {
  BuildingType,
  City,
  CombatPreview,
  CombatResult,
  EconomicLedger,
  FogState,
  HexCoord,
  HexTile,
  Kingdom,
  KingdomId,
  TechId,
  Unit,
} from '../types/game';
import {
  BUILDING_DEFINITIONS,
  calculateTechCost,
  TECHNOLOGIES,
  TERRAIN_DATA,
  UNIT_DEFINITIONS,
} from './constants';
import {
  getNeighbors,
  getTilesInRange,
  hexDistance,
  hexToKey,
  isTargetFlanked,
} from './hexUtils';

export class GameEngine {
  /**
   * Recalculates fog of war visibility map for the active player.
   */
  public static calculateFogOfWar(
    playerKingdomId: KingdomId,
    tiles: Map<string, HexTile>,
    units: Map<string, Unit>,
    cities: Map<string, City>,
    previousExplored: Set<string>,
    playerTechs: TechId[] = []
  ): { fogMap: Map<string, FogState>; updatedExplored: Set<string> } {
    const fogMap = new Map<string, FogState>();
    const currentVisible = new Set<string>();
    const updatedExplored = new Set<string>(previousExplored);

    const hasScouting = playerTechs.includes('scouting');

    // 1. Vision from player units
    for (const unit of units.values()) {
      if (unit.ownerId === playerKingdomId) {
        const bonusVision = unit.type === 'scout' && hasScouting ? 1 : 0;
        const visibleCoords = getTilesInRange(
          { q: unit.q, r: unit.r },
          unit.visionRange + bonusVision
        );
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
   * Computes detailed economic ledger for a kingdom, factoring in technologies.
   */
  public static computeEconomicLedger(
    kingdom: Kingdom,
    tiles: Map<string, HexTile>,
    cities: Map<string, City>,
    units: Map<string, Unit>
  ): EconomicLedger {
    let baseGoldIncome = 12;
    let baseFoodIncome = 6;
    let baseProd = 6;

    const techs = kingdom.researchedTechs || [];
    const ownedCities = Array.from(cities.values()).filter(c => c.ownerId === kingdom.id);

    const incomeBreakdown: { source: string; amount: number }[] = [
      { source: 'Crown Baseline', amount: baseGoldIncome },
    ];
    const expenseBreakdown: { source: string; amount: number }[] = [];

    // Cities income & buildings
    let cityGold = 0;
    let cityFood = 0;
    let cityProd = 0;
    let buildingUpkeep = 0;

    for (const city of ownedCities) {
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

    if (cityGold > 0) {
      incomeBreakdown.push({ source: 'City Commerce & Population', amount: cityGold });
    }

    // Trade Tech bonus: +2 Gold per owned settlement from caravan routes
    if (techs.includes('trade') && ownedCities.length > 0) {
      const tradeRouteGold = ownedCities.length * 2;
      cityGold += tradeRouteGold;
      incomeBreakdown.push({ source: 'Mercantile Trade Routes', amount: tradeRouteGold });
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
          let foodYield = tData.food;
          let prodYield = tData.prod;

          // Farming Tech bonus: +1 Food on grassland
          if (techs.includes('farming') && tile.terrain === 'grassland') {
            foodYield += 1;
          }

          // Irrigation Tech bonus: +1 Food on river or water
          if (techs.includes('irrigation') && (tile.terrain === 'river' || tile.terrain === 'water')) {
            foodYield += 1;
          }

          // Construction Tech bonus: +1 Prod on hills and mountains
          if (techs.includes('construction') && (tile.terrain === 'hills' || tile.terrain === 'mountain')) {
            prodYield += 1;
          }

          tileFood += foodYield;
          tileProd += prodYield;
        }
        if (tile.resourceBonus === 'gold_ore') tileGold += 3;
        if (tile.resourceBonus === 'wheat') tileFood += 3;
        if (tile.resourceBonus === 'iron_ore') tileProd += 2;
        if (tile.resourceBonus === 'timber') tileProd += 2;
      }
    }

    if (tileGold > 0) incomeBreakdown.push({ source: 'Provincial Domain Yields', amount: tileGold });

    // Policy and Administration Multipliers
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

    // Administration Tech bonus: +15% total gross tax revenue
    if (techs.includes('administration')) {
      goldMultiplier += 0.15;
      incomeBreakdown.push({ source: 'Imperial Administration (+15%)', amount: Math.floor((baseGoldIncome + cityGold + tileGold) * 0.15) });
    }

    const totalGrossGold = Math.floor((baseGoldIncome + cityGold + tileGold) * goldMultiplier);
    const totalGrossFood = Math.floor((baseFoodIncome + cityFood + tileFood) * foodMultiplier);
    const totalProd = Math.floor((baseProd + cityProd + tileProd) * prodMultiplier);

    // Expenses: Units upkeep
    let unitUpkeepGold = 0;
    let unitFoodConsumption = 0;
    const hasLogistics = techs.includes('logistics');

    for (const unit of units.values()) {
      if (unit.ownerId === kingdom.id) {
        const uDef = UNIT_DEFINITIONS[unit.type];
        if (uDef) {
          // Logistics Tech: -1 Gold upkeep per unit (min 1)
          const effectiveUpkeep = hasLogistics ? Math.max(1, uDef.upkeep - 1) : uDef.upkeep;
          unitUpkeepGold += effectiveUpkeep;
          unitFoodConsumption += 1;
        }
      }
    }

    const popFoodConsumption = kingdom.population;

    if (unitUpkeepGold > 0) {
      expenseBreakdown.push({ source: hasLogistics ? 'Military Upkeep (Logistics -1g)' : 'Military Upkeep & Wages', amount: unitUpkeepGold });
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
   * Previews combat calculations before player commits to an attack.
   */
  public static calculateCombatPreview(
    attacker: Unit,
    defender: Unit,
    defenderTile: HexTile,
    attackerTile: HexTile,
    tilesMap: Map<string, HexTile>,
    unitsMap: Map<string, Unit>,
    attackerTechs: TechId[] = [],
    defenderTechs: TechId[] = []
  ): CombatPreview {
    const isRanged = attacker.range >= 2;

    // Tactical Modifiers
    const flankingBonus = attackerTechs.includes('tactics') && isTargetFlanked({ q: defender.q, r: defender.r }, attacker, tilesMap, unitsMap);
    const antiCavalryBonus = attacker.type === 'spearman' && defender.type === 'cavalry';
    const siegeBonus = attacker.type === 'catapult' && (defenderTile.cityId !== null || defender.isFortified);

    // Defense Modifiers
    let terrainDef = defenderTile.defenseBonus;
    const fortifyBonus = defenderTechs.includes('fortifications') ? 0.40 : 0.25;
    if (defender.isFortified) terrainDef += fortifyBonus;

    // Veterancy bonuses
    const attackerVetBonus = 1 + attacker.veterancy * 0.12;
    const defenderVetBonus = 1 + defender.veterancy * 0.12;

    // Attack upgrades
    let baseAtk = attacker.attack;
    if (attackerTechs.includes('improved_weapons') && (attacker.type === 'infantry' || attacker.type === 'spearman')) {
      baseAtk += 1;
    }

    let multiplier = 1.0;
    if (antiCavalryBonus) multiplier *= 1.5;
    if (siegeBonus) multiplier *= 2.0;
    if (flankingBonus) multiplier *= 1.25;

    const effectiveAtk = baseAtk * attackerVetBonus * multiplier * (attacker.hp / attacker.maxHp * 0.5 + 0.5);
    const effectiveDef = defender.defense * defenderVetBonus * (1 + terrainDef);

    const projectedAtkDamage = Math.max(3, Math.min(defender.hp, Math.round((effectiveAtk / Math.max(1, effectiveDef)) * 11)));
    const defenderRemainingHp = Math.max(0, defender.hp - projectedAtkDamage);

    let projectedDefDamage = 0;
    if (!isRanged && defenderRemainingHp > 0) {
      const counterAtk = defender.attack * defenderVetBonus * (defenderRemainingHp / defender.maxHp * 0.5 + 0.5);
      const counterDef = attacker.defense * attackerVetBonus * (1 + attackerTile.defenseBonus);
      projectedDefDamage = Math.max(1, Math.min(attacker.hp, Math.round((counterAtk / Math.max(1, counterDef)) * 7)));
    }

    return {
      attackerDamage: projectedAtkDamage,
      defenderDamage: projectedDefDamage,
      attackerRemainingHp: Math.max(0, attacker.hp - projectedDefDamage),
      defenderRemainingHp,
      isRanged,
      flankingBonus,
      antiCavalryBonus,
      siegeBonus,
      terrainDefenseBonus: terrainDef,
      isFortified: defender.isFortified,
    };
  }

  /**
   * Resolves combat with tactical flanking, anti-cavalry counters, and siege damage.
   */
  public static resolveCombat(
    attacker: Unit,
    defender: Unit,
    defenderTile: HexTile,
    attackerTile: HexTile,
    tilesMap: Map<string, HexTile>,
    unitsMap: Map<string, Unit>,
    attackerTechs: TechId[] = [],
    defenderTechs: TechId[] = []
  ): CombatResult {
    const preview = this.calculateCombatPreview(
      attacker,
      defender,
      defenderTile,
      attackerTile,
      tilesMap,
      unitsMap,
      attackerTechs,
      defenderTechs
    );

    // Apply minor variance (0.95 to 1.1) to calculated baseline
    const variance = 0.95 + Math.random() * 0.15;
    const finalDefenderDmg = Math.max(1, Math.min(defender.hp, Math.round(preview.attackerDamage * variance)));
    const defenderDied = defender.hp - finalDefenderDmg <= 0;

    let finalAttackerDmg = 0;
    let attackerDied = false;

    if (!preview.isRanged && !defenderDied) {
      const counterVariance = 0.95 + Math.random() * 0.15;
      finalAttackerDmg = Math.max(1, Math.min(attacker.hp, Math.round(preview.defenderDamage * counterVariance)));
      attackerDied = attacker.hp - finalAttackerDmg <= 0;
    }

    let targetCaptured = false;
    if (defenderDied && defenderTile.cityId) {
      targetCaptured = true;
    }

    // Compose informative battle log
    let tacticalTag = '';
    if (preview.antiCavalryBonus) tacticalTag += ' [ANTI-CAVALRY +50%]';
    if (preview.siegeBonus) tacticalTag += ' [SIEGE CRUSH +100%]';
    if (preview.flankingBonus) tacticalTag += ' [FLANKING +25%]';

    let log = '';
    if (preview.isRanged) {
      log = `${attacker.name} unleashed a ranged volley at ${defender.name}${tacticalTag}! (-${finalDefenderDmg} HP)`;
    } else {
      log = `${attacker.name} struck ${defender.name}${tacticalTag}! (-${finalDefenderDmg} def, -${finalAttackerDmg} atk)`;
    }
    if (defenderDied) log += ` ${defender.name} was vanquished!`;
    if (attackerDied) log += ` ${attacker.name} fell in combat!`;

    return {
      attackerId: attacker.id,
      defenderId: defender.id,
      attackerDamage: finalAttackerDmg,
      defenderDamage: finalDefenderDmg,
      attackerDied,
      defenderDied,
      targetCaptured,
      attackerTile: { q: attacker.q, r: attacker.r },
      defenderTile: { q: defender.q, r: defender.r },
      isRanged: preview.isRanged,
      flankingBonus: preview.flankingBonus,
      antiCavalryBonus: preview.antiCavalryBonus,
      siegeBonus: preview.siegeBonus,
      log,
    };
  }

  /**
   * Settler founds a new City on an unclaimed hex.
   */
  public static foundNewCity(
    settler: Unit,
    kingdom: Kingdom,
    tiles: Map<string, HexTile>,
    cities: Map<string, City>,
    units: Map<string, Unit>
  ): { success: boolean; city?: City; error?: string } {
    const tileKey = hexToKey(settler.q, settler.r);
    const tile = tiles.get(tileKey);
    if (!tile) return { success: false, error: 'Invalid tile location.' };

    if (tile.terrain === 'mountain' || tile.terrain === 'water') {
      return { success: false, error: 'Cannot found a city on mountains or water.' };
    }
    if (tile.cityId) {
      return { success: false, error: 'A settlement already exists on this location.' };
    }

    // Consume the settler
    units.delete(settler.id);
    tile.unitId = null;

    // Create new city
    const existingCount = Array.from(cities.values()).filter(c => c.ownerId === kingdom.id).length;
    const cityNumber = existingCount + 1;
    const newCityId = `city-${kingdom.id}-${Date.now().toString(36)}`;
    const cityName = `${kingdom.name} Colony ${cityNumber}`;

    const newCity: City = {
      id: newCityId,
      name: cityName,
      ownerId: kingdom.id,
      q: settler.q,
      r: settler.r,
      level: 1,
      population: 3,
      defense: 25,
      maxDefense: 25,
      buildings: [],
      currentProductionItem: null,
    };

    cities.set(newCityId, newCity);
    tile.cityId = newCityId;
    tile.ownerId = kingdom.id;

    // Claim 1-tile ring around new colony
    const ring = getTilesInRange({ q: settler.q, r: settler.r }, 1);
    for (const c of ring) {
      const k = hexToKey(c.q, c.r);
      const t = tiles.get(k);
      if (t && (t.ownerId === null || t.ownerId === kingdom.id)) {
        t.ownerId = kingdom.id;
      }
    }

    return { success: true, city: newCity };
  }

  /**
   * Researches a technology for a kingdom using the empire-size scaling formula.
   */
  public static researchTechnology(
    kingdom: Kingdom,
    techId: TechId,
    numCities: number
  ): { success: boolean; cost: number; error?: string } {
    const tech = TECHNOLOGIES[techId];
    if (!tech) return { success: false, cost: 0, error: 'Unknown technology.' };

    const researched = kingdom.researchedTechs || [];
    if (researched.includes(techId)) {
      return { success: false, cost: 0, error: 'Technology already researched.' };
    }

    // Check prerequisites
    for (const prereq of tech.prerequisites) {
      if (!researched.includes(prereq)) {
        const prereqName = TECHNOLOGIES[prereq]?.name || prereq;
        return {
          success: false,
          cost: 0,
          error: `Requires prerequisite technology: ${prereqName}`,
        };
      }
    }

    const cost = calculateTechCost(tech.tier, numCities);
    if (kingdom.gold < cost) {
      return {
        success: false,
        cost,
        error: `Insufficient treasury. Requires ${cost} Gold (Vault: ${kingdom.gold} Gold)`,
      };
    }

    kingdom.gold -= cost;
    kingdom.researchedTechs.push(techId);

    return { success: true, cost };
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
    city.defense = Math.floor(city.maxDefense * 0.5);

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

    let playerHasCity = false;
    for (const city of cities.values()) {
      if (city.ownerId === 'player') {
        playerHasCity = true;
        break;
      }
    }
    if (!playerHasCity) return 'defeat';

    let allRivalsDefeated = true;
    for (const k of kingdoms) {
      if (k.id !== 'player' && !k.isDefeated) {
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
