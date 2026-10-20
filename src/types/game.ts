export type TerrainType = 'grassland' | 'forest' | 'hills' | 'mountain' | 'water' | 'river';

export type UnitType = 'scout' | 'infantry' | 'archer' | 'cavalry' | 'catapult';

export type BuildingType = 'farm' | 'barracks' | 'market' | 'workshop' | 'walls';

export type FogState = 'unexplored' | 'explored' | 'visible';

export type KingdomId = 'player' | 'crimson' | 'verdant' | 'amethyst';

export interface Kingdom {
  id: KingdomId;
  name: string;
  leader: string;
  color: string;
  secondaryColor: string;
  accentHex: number; // for Three.js materials
  isAI: boolean;
  isDefeated: boolean;
  personality?: 'expansionist' | 'militant' | 'economic';
  gold: number;
  food: number;
  iron: number;
  production: number;
  population: number;
  taxPolicy: 'balanced' | 'war_economy' | 'free_trade';
}

export interface HexCoord {
  q: number; // axial q
  r: number; // axial r
}

export interface HexTile {
  id: string;
  q: number;
  r: number;
  x: number; // world x
  z: number; // world z
  elevation: number;
  terrain: TerrainType;
  resourceBonus?: 'wheat' | 'gold_ore' | 'iron_ore' | 'timber' | 'fish';
  ownerId: KingdomId | null;
  cityId: string | null;
  unitId: string | null;
  defenseBonus: number; // e.g. 0.25 for forest, 0.35 for hill
  moveCost: number;     // 1 for grass, 2 for forest/hill/river, 999 for mountain/deep water
}

export interface Unit {
  id: string;
  type: UnitType;
  name: string;
  ownerId: KingdomId;
  q: number;
  r: number;
  maxHp: number;
  hp: number;
  attack: number;
  defense: number;
  range: number; // 1 for melee, 2 for archer/catapult
  maxMoves: number;
  movesLeft: number;
  hasAttacked: boolean;
  visionRange: number;
  veterancy: number; // 0, 1, 2 (+10% strength per level)
  isFortified: boolean;
}

export interface City {
  id: string;
  name: string;
  ownerId: KingdomId;
  q: number;
  r: number;
  level: number;
  population: number;
  defense: number;
  maxDefense: number;
  buildings: BuildingType[];
  currentProductionItem: {
    type: 'unit' | 'building';
    itemId: UnitType | BuildingType;
    progress: number;
    required: number;
  } | null;
}

export interface EconomicLedger {
  goldIncome: number;
  goldExpenses: number;
  netGold: number;
  foodIncome: number;
  foodExpenses: number;
  netFood: number;
  totalProduction: number;
  incomeBreakdown: { source: string; amount: number }[];
  expenseBreakdown: { source: string; amount: number }[];
  workingPopulation: number;
}

export interface CombatResult {
  attackerId: string;
  defenderId: string;
  attackerDamage: number;
  defenderDamage: number;
  attackerDied: boolean;
  defenderDied: boolean;
  targetCaptured: boolean;
  attackerTile: HexCoord;
  defenderTile: HexCoord;
  isRanged: boolean;
  log: string;
}

export interface GameLog {
  id: string;
  turn: number;
  text: string;
  type: 'combat' | 'conquest' | 'economy' | 'diplomacy' | 'system';
  timestamp: number;
}

export interface UnitDefinition {
  type: UnitType;
  name: string;
  description: string;
  costGold: number;
  costFood: number;
  costIron: number;
  productionCost: number;
  attack: number;
  defense: number;
  maxHp: number;
  moves: number;
  range: number;
  vision: number;
  upkeep: number;
}

export interface BuildingDefinition {
  type: BuildingType;
  name: string;
  description: string;
  costGold: number;
  costProd: number;
  upkeep: number;
  goldYield: number;
  foodYield: number;
  prodYield: number;
  defenseBonus: number;
}

export type GamePhase = 'title' | 'playing' | 'paused' | 'victory' | 'defeat';
