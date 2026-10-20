import { City, HexTile, Kingdom, KingdomId, TerrainType, Unit } from '../types/game';
import { INITIAL_FACTIONS, TERRAIN_DATA, UNIT_DEFINITIONS } from './constants';
import { getNeighbors, getTilesInRange, hexDistance, hexToKey, hexToWorld } from './hexUtils';

// Simple deterministic 2D Perlin-like pseudo-random noise generator
function pseudoNoise2D(x: number, y: number, seed: number): number {
  const n = Math.sin(x * 12.9898 + y * 78.233 + seed * 43758.5453) * 43758.5453;
  return n - Math.floor(n);
}

function smoothNoise(x: number, y: number, seed: number): number {
  const i = Math.floor(x);
  const j = Math.floor(y);
  const fx = x - i;
  const fy = y - j;

  // Smoothstep
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);

  const n00 = pseudoNoise2D(i, j, seed);
  const n10 = pseudoNoise2D(i + 1, j, seed);
  const n01 = pseudoNoise2D(i, j + 1, seed);
  const n11 = pseudoNoise2D(i + 1, j + 1, seed);

  const nx0 = n00 * (1 - sx) + n10 * sx;
  const nx1 = n01 * (1 - sx) + n11 * sx;

  return nx0 * (1 - sy) + nx1 * sy;
}

function fbm(x: number, y: number, octaves: number, seed: number): number {
  let val = 0;
  let freq = 1;
  let amp = 0.5;
  let max = 0;
  for (let o = 0; o < octaves; o++) {
    val += smoothNoise(x * freq, y * freq, seed + o * 17) * amp;
    max += amp;
    freq *= 2;
    amp *= 0.5;
  }
  return val / max;
}

export interface GeneratedMapData {
  tiles: Map<string, HexTile>;
  units: Map<string, Unit>;
  cities: Map<string, City>;
  kingdoms: Kingdom[];
}

export function generateWorldMap(
  mapRadius: number = 7,
  seed: number = Math.floor(Math.random() * 10000),
  activeFactionCount: number = 3
): GeneratedMapData {
  const tiles = new Map<string, HexTile>();
  const units = new Map<string, Unit>();
  const cities = new Map<string, City>();

  const hexCoords = getTilesInRange({ q: 0, r: 0 }, mapRadius);

  // 1. Generate terrain based on multi-octave elevation and moisture noise
  hexCoords.forEach(coord => {
    const { q, r } = coord;
    const worldPos = hexToWorld(q, r);

    // Coordinate normalization for noise
    const nx = worldPos.x * 0.07;
    const ny = worldPos.z * 0.07;

    // Island / radial falloff so boundaries feel like natural shores / continents
    const distFromCenter = Math.sqrt(worldPos.x * worldPos.x + worldPos.z * worldPos.z);
    const maxRadiusWorld = mapRadius * 3.2;
    const falloff = Math.max(0, 1 - Math.pow(distFromCenter / maxRadiusWorld, 2.5));

    const rawElev = fbm(nx, ny, 3, seed);
    const elevation = rawElev * 0.7 + falloff * 0.45;
    const moisture = fbm(nx + 31.4, ny + 72.1, 3, seed + 101);

    let terrain: TerrainType = 'grassland';
    let resourceBonus: HexTile['resourceBonus'] = undefined;

    if (elevation < 0.35) {
      terrain = 'water';
      if (Math.random() < 0.2) resourceBonus = 'fish';
    } else if (elevation > 0.82) {
      terrain = 'mountain';
      if (Math.random() < 0.25) resourceBonus = 'iron_ore';
    } else if (elevation > 0.65) {
      terrain = 'hills';
      if (Math.random() < 0.25) resourceBonus = 'gold_ore';
    } else if (moisture > 0.6) {
      terrain = 'forest';
      if (Math.random() < 0.2) resourceBonus = 'timber';
    } else if (moisture < 0.38 && elevation < 0.45) {
      terrain = 'river';
      if (Math.random() < 0.2) resourceBonus = 'fish';
    } else {
      terrain = 'grassland';
      if (Math.random() < 0.25) resourceBonus = 'wheat';
    }

    const tData = TERRAIN_DATA[terrain];
    const key = hexToKey(q, r);

    tiles.set(key, {
      id: key,
      q,
      r,
      x: worldPos.x,
      z: worldPos.z,
      elevation: tData.height,
      terrain,
      resourceBonus,
      ownerId: null,
      cityId: null,
      unitId: null,
      defenseBonus: tData.defense,
      moveCost: tData.moveCost,
    });
  });

  // 2. Identify candidate land tiles for faction capitals
  const landTiles: HexTile[] = Array.from(tiles.values()).filter(
    t => t.terrain === 'grassland' || t.terrain === 'forest' || t.terrain === 'hills'
  );

  const factions = INITIAL_FACTIONS.slice(0, activeFactionCount).map(f => ({ ...f }));

  // Pick balanced starting spawn points for each faction with good distance separation
  const capitalCoords: { q: number; r: number }[] = [];
  const minCapitalDistance = Math.floor(mapRadius * 0.85);

  for (let f = 0; f < factions.length; f++) {
    // Find candidate furthest from existing capitals
    let bestCandidate: HexTile | null = null;
    let maxMinDist = -1;

    for (const tile of landTiles) {
      // Must not be near edge
      if (hexDistance({ q: 0, r: 0 }, { q: tile.q, r: tile.r }) > mapRadius - 2) continue;

      if (capitalCoords.length === 0) {
        // Player capital: bias toward south-west or center-left
        if (tile.q < 0 && tile.r >= 0) {
          bestCandidate = tile;
          break;
        }
      } else {
        const distToExisting = Math.min(
          ...capitalCoords.map(c => hexDistance(c, { q: tile.q, r: tile.r }))
        );
        if (distToExisting >= minCapitalDistance && distToExisting > maxMinDist) {
          maxMinDist = distToExisting;
          bestCandidate = tile;
        }
      }
    }

    if (!bestCandidate) {
      // Fallback to any valid land tile
      bestCandidate = landTiles[Math.floor(Math.random() * landTiles.length)];
    }

    capitalCoords.push({ q: bestCandidate.q, r: bestCandidate.r });
  }

  // 3. Establish capitals, initial armies, and starting territory
  const capitalNames = [
    'Solaria Prime',
    'Fortress Ironfang',
    'Verdant Heart',
    'Aethelgard',
  ];

  factions.forEach((faction, idx) => {
    const capCoord = capitalCoords[idx];
    const capKey = hexToKey(capCoord.q, capCoord.r);
    const capTile = tiles.get(capKey)!;

    // Ensure capital tile is hospitable grassland
    capTile.terrain = 'grassland';
    capTile.elevation = TERRAIN_DATA.grassland.height;
    capTile.moveCost = TERRAIN_DATA.grassland.moveCost;
    capTile.defenseBonus = 0.35; // City base defense bonus

    const cityId = `city-${faction.id}-capital`;
    const cityName = capitalNames[idx] || `${faction.name} Citadel`;

    const city: City = {
      id: cityId,
      name: cityName,
      ownerId: faction.id,
      q: capCoord.q,
      r: capCoord.r,
      level: 1,
      population: faction.population,
      defense: 35,
      maxDefense: 35,
      buildings: ['farm', 'barracks'],
      currentProductionItem: null,
    };
    cities.set(cityId, city);
    capTile.cityId = cityId;

    // Grant 1 ring of territory around the capital
    const initialTerritory = getTilesInRange(capCoord, 1);
    initialTerritory.forEach(tCoord => {
      const tKey = hexToKey(tCoord.q, tCoord.r);
      const t = tiles.get(tKey);
      if (t) {
        t.ownerId = faction.id;
        // make sure at least one adjacent tile is fertile for agriculture
        if (t.terrain === 'water') {
          t.resourceBonus = 'fish';
        }
      }
    });

    // Spawn starting army: 1 Swordsman inside capital, 1 Scout in adjacent open tile
    const swordsmanDef = UNIT_DEFINITIONS.infantry;
    const swordsmanId = `unit-${faction.id}-infantry-1`;
    const swordsman: Unit = {
      id: swordsmanId,
      type: 'infantry',
      name: `${faction.name} Guard`,
      ownerId: faction.id,
      q: capCoord.q,
      r: capCoord.r,
      maxHp: swordsmanDef.maxHp,
      hp: swordsmanDef.maxHp,
      attack: swordsmanDef.attack,
      defense: swordsmanDef.defense,
      range: swordsmanDef.range,
      maxMoves: swordsmanDef.moves,
      movesLeft: swordsmanDef.moves,
      hasAttacked: false,
      visionRange: swordsmanDef.vision,
      veterancy: 0,
      isFortified: false,
    };
    units.set(swordsmanId, swordsman);
    capTile.unitId = swordsmanId;

    // Scout on neighbor tile
    const neighbors = getNeighbors(capCoord.q, capCoord.r);
    const scoutCoord = neighbors.find(n => {
      const t = tiles.get(hexToKey(n.q, n.r));
      return t && t.terrain !== 'water' && t.terrain !== 'mountain' && !t.unitId;
    }) || capCoord;

    if (scoutCoord !== capCoord) {
      const scoutDef = UNIT_DEFINITIONS.scout;
      const scoutId = `unit-${faction.id}-scout-1`;
      const scoutTile = tiles.get(hexToKey(scoutCoord.q, scoutCoord.r))!;
      const scout: Unit = {
        id: scoutId,
        type: 'scout',
        name: `${faction.name} Scout`,
        ownerId: faction.id,
        q: scoutCoord.q,
        r: scoutCoord.r,
        maxHp: scoutDef.maxHp,
        hp: scoutDef.maxHp,
        attack: scoutDef.attack,
        defense: scoutDef.defense,
        range: scoutDef.range,
        maxMoves: scoutDef.moves,
        movesLeft: scoutDef.moves,
        hasAttacked: false,
        visionRange: scoutDef.vision,
        veterancy: 0,
        isFortified: false,
      };
      units.set(scoutId, scout);
      scoutTile.unitId = scoutId;
    }
  });

  // 4. Place 1-2 neutral settlements / independent sanctuaries
  const neutralCandidates = landTiles.filter(t => {
    if (t.cityId || t.ownerId) return false;
    const distToAnyCap = Math.min(
      ...capitalCoords.map(c => hexDistance(c, { q: t.q, r: t.r }))
    );
    return distToAnyCap >= 3 && distToAnyCap <= mapRadius - 2;
  });

  const neutralCount = Math.min(3, Math.max(1, Math.floor(mapRadius / 3)));
  for (let i = 0; i < neutralCount && i < neutralCandidates.length; i++) {
    const candidate = neutralCandidates[Math.floor(Math.random() * neutralCandidates.length)];
    if (!candidate.cityId) {
      const sanctuaryId = `city-neutral-${i + 1}`;
      const sanctuaryNames = ['Oakhaven Sanctuary', 'Ironforge Outpost', 'Rivergate Post'];
      const neutralCity: City = {
        id: sanctuaryId,
        name: sanctuaryNames[i] || `Sanctuary ${i + 1}`,
        ownerId: null as unknown as KingdomId, // neutral
        q: candidate.q,
        r: candidate.r,
        level: 1,
        population: 3,
        defense: 20,
        maxDefense: 20,
        buildings: ['market'],
        currentProductionItem: null,
      };
      cities.set(sanctuaryId, neutralCity);
      candidate.cityId = sanctuaryId;
      candidate.terrain = 'grassland';
      candidate.elevation = TERRAIN_DATA.grassland.height;

      // Small barbarian/neutral defender
      const defenderDef = UNIT_DEFINITIONS.archer;
      const defUnitId = `unit-neutral-guard-${i + 1}`;
      const guard: Unit = {
        id: defUnitId,
        type: 'archer',
        name: 'Sanctuary Watch',
        ownerId: null as unknown as KingdomId,
        q: candidate.q,
        r: candidate.r,
        maxHp: defenderDef.maxHp,
        hp: defenderDef.maxHp,
        attack: defenderDef.attack - 1,
        defense: defenderDef.defense,
        range: defenderDef.range,
        maxMoves: 0,
        movesLeft: 0,
        hasAttacked: false,
        visionRange: 2,
        veterancy: 0,
        isFortified: true,
      };
      units.set(defUnitId, guard);
      candidate.unitId = defUnitId;
    }
  }

  return { tiles, units, cities, kingdoms: factions };
}
