import { calculateTechCost, TECHNOLOGIES, UNIT_DEFINITIONS } from '../constants';
import { GameEngine } from '../gameEngine';
import { getTileMoveCost, isTargetFlanked } from '../hexUtils';
import { City, HexTile, Kingdom, Unit } from '../../types/game';

// Minimal assertion framework for tsx runner
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName} ${details ? `(${details})` : ''}`);
    failedTests++;
  }
}

console.log('--- DOMINION STRATEGY & TECHNOLOGY SYSTEM TESTS ---\n');

// 1. Research Cost Scaling Formula
console.log('1. Testing Polytopia-Style Empire Research Cost Formula:');
// Tier 1: Base 40, Scale 12
assert(calculateTechCost(1, 1) === 40, 'Tier 1 tech cost for 1 city should be 40g');
assert(calculateTechCost(1, 2) === 52, 'Tier 1 tech cost for 2 cities should be 52g');
assert(calculateTechCost(1, 3) === 64, 'Tier 1 tech cost for 3 cities should be 64g');
// Tier 2: Base 70, Scale 20
assert(calculateTechCost(2, 1) === 70, 'Tier 2 tech cost for 1 city should be 70g');
assert(calculateTechCost(2, 3) === 110, 'Tier 2 tech cost for 3 cities should be 110g');
// Tier 3: Base 120, Scale 35
assert(calculateTechCost(3, 1) === 120, 'Tier 3 tech cost for 1 city should be 120g');
assert(calculateTechCost(3, 4) === 225, 'Tier 3 tech cost for 4 cities should be 225g');

// 2. Technology Prerequisites & Unlocks
console.log('\n2. Testing Technology Prerequisites & Purchase Validation:');
const dummyKingdom: Kingdom = {
  id: 'player',
  name: 'Test Empire',
  leader: 'Test Leader',
  color: '#3b82f6',
  secondaryColor: '#f59e0b',
  accentHex: 0x3b82f6,
  isAI: false,
  isDefeated: false,
  gold: 150,
  food: 50,
  iron: 20,
  production: 10,
  population: 5,
  taxPolicy: 'balanced',
  researchedTechs: ['farming'],
};

// Attempt to research Administration without Trade (prereq missing)
const failPrereq = GameEngine.researchTechnology(dummyKingdom, 'administration', 1);
assert(!failPrereq.success && Boolean(failPrereq.error?.includes('Requires prerequisite')), 'Cannot research Administration without Trade');

// Research Trade (has Farming)
const passTrade = GameEngine.researchTechnology(dummyKingdom, 'trade', 1);
assert(passTrade.success && dummyKingdom.researchedTechs.includes('trade'), 'Successfully researched Trade with Farming prerequisite');
assert(dummyKingdom.gold === 150 - 70, 'Treasury deducted correctly for Trade (70g)');

// Attempt to research with insufficient gold
dummyKingdom.gold = 10;
const failGold = GameEngine.researchTechnology(dummyKingdom, 'administration', 1);
assert(!failGold.success && Boolean(failGold.error?.includes('Insufficient treasury')), 'Cannot research when gold is insufficient');

// 3. Tactical Combat Modifiers & Counters
console.log('\n3. Testing Tactical Combat Calculations & Unit Counters:');

const plainTile: HexTile = {
  id: '0,0',
  q: 0,
  r: 0,
  x: 0,
  z: 0,
  elevation: 0.15,
  terrain: 'grassland',
  ownerId: 'player',
  cityId: null,
  unitId: null,
  defenseBonus: 0.0,
  moveCost: 1,
};

const forestTile: HexTile = {
  ...plainTile,
  id: '1,0',
  q: 1,
  r: 0,
  terrain: 'forest',
  defenseBonus: 0.25,
  moveCost: 2,
};

const spearman: Unit = {
  id: 'spear-1',
  type: 'spearman',
  name: 'Phalanx Spearman',
  ownerId: 'player',
  q: 0,
  r: 0,
  maxHp: 22,
  hp: 22,
  attack: 7,
  defense: 10,
  range: 1,
  maxMoves: 2,
  movesLeft: 2,
  hasAttacked: false,
  visionRange: 2,
  veterancy: 0,
  isFortified: false,
};

const knight: Unit = {
  id: 'knight-1',
  type: 'cavalry',
  name: 'Enemy Knight',
  ownerId: 'crimson',
  q: 1,
  r: 0,
  maxHp: 28,
  hp: 28,
  attack: 12,
  defense: 8,
  range: 1,
  maxMoves: 3,
  movesLeft: 3,
  hasAttacked: false,
  visionRange: 2,
  veterancy: 0,
  isFortified: false,
};

// Combat Preview: Spearman vs Knight
const spearVsKnight = GameEngine.calculateCombatPreview(
  spearman,
  knight,
  plainTile,
  plainTile,
  new Map(),
  new Map(),
  ['armour'],
  []
);
assert(spearVsKnight.antiCavalryBonus === true, 'Anti-Cavalry bonus is active for Spearman vs Knight');
assert(spearVsKnight.attackerDamage >= 13, `Spearman deals massive anti-cavalry damage (Projected: ${spearVsKnight.attackerDamage})`);

// Trebuchet vs City / Fortification
const catapult: Unit = {
  id: 'cat-1',
  type: 'catapult',
  name: 'Siege Trebuchet',
  ownerId: 'player',
  q: 0,
  r: 0,
  maxHp: 16,
  hp: 16,
  attack: 16,
  defense: 3,
  range: 2,
  maxMoves: 1,
  movesLeft: 1,
  hasAttacked: false,
  visionRange: 2,
  veterancy: 0,
  isFortified: false,
};

const cityGarrisonTile: HexTile = {
  ...plainTile,
  id: '2,0',
  q: 2,
  r: 0,
  cityId: 'city-crimson-1',
};

const catVsCity = GameEngine.calculateCombatPreview(
  catapult,
  knight,
  cityGarrisonTile,
  plainTile,
  new Map(),
  new Map(),
  ['siegecraft'],
  []
);
assert(catVsCity.siegeBonus === true, 'Siege bonus active for Trebuchet vs City');
assert(catVsCity.isRanged === true, 'Trebuchet fires ranged attack');
assert(catVsCity.defenderDamage === 0, 'No melee retaliation received by Trebuchet on ranged attack');

// 4. Movement Costs & Technology Modifiers
console.log('\n4. Testing Movement Engine & Navigation/Roads:');

const waterTile: HexTile = {
  id: '0,1',
  q: 0,
  r: 1,
  x: 0,
  z: 2,
  elevation: -0.2,
  terrain: 'water',
  ownerId: null,
  cityId: null,
  unitId: null,
  defenseBonus: -0.2,
  moveCost: 999,
};

// Water without navigation
const waterCostNoNav = getTileMoveCost(waterTile, spearman, []);
assert(waterCostNoNav === 999, 'Water is impassable without Navigation tech');

// Water with navigation
const waterCostWithNav = getTileMoveCost(waterTile, spearman, ['navigation']);
assert(waterCostWithNav === 2, 'Water is traversable (2 MP) with Navigation tech');

// Friendly territory with Roads
const roadTile: HexTile = {
  ...plainTile,
  ownerId: 'player',
};
const roadCostWithRoads = getTileMoveCost(roadTile, spearman, ['roads']);
assert(roadCostWithRoads === 0.5, 'Movement on friendly territory costs only 0.5 MP with Roads tech');

// 5. Economy & Upkeep Discounts
console.log('\n5. Testing Economic Ledger & Technology Multipliers:');
const testKingdomForEcon: Kingdom = {
  ...dummyKingdom,
  gold: 100,
  researchedTechs: ['farming', 'logistics', 'administration'],
};

const mockCity: City = {
  id: 'city-1',
  name: 'Capital',
  ownerId: 'player',
  q: 0,
  r: 0,
  level: 1,
  population: 6,
  defense: 35,
  maxDefense: 35,
  buildings: ['farm'],
  currentProductionItem: null,
};

const citiesMap = new Map<string, City>([['city-1', mockCity]]);
const tilesMap = new Map<string, HexTile>([
  ['0,0', { ...plainTile, cityId: 'city-1' }],
  ['1,0', forestTile],
]);
const unitsMap = new Map<string, Unit>([
  ['u1', spearman],
  ['u2', knight], // note knight owned by crimson, so no player upkeep
]);

const ledger = GameEngine.computeEconomicLedger(testKingdomForEcon, tilesMap, citiesMap, unitsMap);
const militaryItem = ledger.expenseBreakdown.find(e => e.source.includes('Military Upkeep'));
assert(militaryItem?.amount === 1, `Logistics reduces Spearman upkeep to 1 Gold (Actual: ${militaryItem?.amount}g)`);
assert(ledger.goldExpenses === 2, `Total expenses include 1g unit + 1g farm upkeep = 2g (Actual: ${ledger.goldExpenses}g)`);
assert(ledger.goldIncome > 15, `Administration increases gross tax income (Income: ${ledger.goldIncome}g)`);

// 6. Settler City Founding
console.log('\n6. Testing Frontier Settler City Founding:');
const settler: Unit = {
  id: 'settler-1',
  type: 'settler',
  name: 'Frontier Settler',
  ownerId: 'player',
  q: 4,
  r: 4,
  maxHp: 12,
  hp: 12,
  attack: 0,
  defense: 4,
  range: 1,
  maxMoves: 2,
  movesLeft: 2,
  hasAttacked: false,
  visionRange: 2,
  veterancy: 0,
  isFortified: false,
  isCivilian: true,
};

const settleTile: HexTile = {
  ...plainTile,
  id: '4,4',
  q: 4,
  r: 4,
  ownerId: null,
  cityId: null,
};

const sUnitsMap = new Map<string, Unit>([['settler-1', settler]]);
const sTilesMap = new Map<string, HexTile>([['4,4', settleTile]]);
const sCitiesMap = new Map<string, City>();

const settleResult = GameEngine.foundNewCity(settler, testKingdomForEcon, sTilesMap, sCitiesMap, sUnitsMap);
assert(settleResult.success === true, 'Settler successfully establishes colony on unclaimed fertile land');
assert(!sUnitsMap.has('settler-1'), 'Settler unit is consumed when founding city');
assert(sCitiesMap.size === 1, 'New city added to cities registry');
assert(settleTile.ownerId === 'player', 'Tile ownership claimed by founding kingdom');

console.log('\n---------------------------------------------------');
console.log(`TEST SUMMARY: ${passedTests} passed, ${failedTests} failed.`);

if (failedTests > 0) {
  process.exit(1);
} else {
  console.log('ALL DOMINION STRATEGY & TECHNOLOGY TESTS PASSED SUCCESSFULLY! ✓\n');
}
