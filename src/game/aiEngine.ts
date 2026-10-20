import { City, HexTile, Kingdom, TechId, Unit, UnitType } from '../types/game';
import { calculateTechCost, TECHNOLOGIES, UNIT_DEFINITIONS } from './constants';
import { GameEngine } from './gameEngine';
import { findPath, getNeighbors, getReachableTiles, getTilesInRange, hexDistance, hexToKey } from './hexUtils';

export interface AIActionLog {
  factionName: string;
  action: 'recruit' | 'move' | 'attack' | 'build' | 'capture' | 'research' | 'settle';
  description: string;
}

export class AIEngine {
  /**
   * Processes an AI kingdom's complete turn: research, economic decisions, recruitment, and military moves.
   */
  public static processAITurn(
    aiKingdom: Kingdom,
    tiles: Map<string, HexTile>,
    units: Map<string, Unit>,
    cities: Map<string, City>,
    allKingdoms: Kingdom[]
  ): AIActionLog[] {
    const logs: AIActionLog[] = [];
    if (aiKingdom.isDefeated) return logs;

    const aiCities = Array.from(cities.values()).filter(c => c.ownerId === aiKingdom.id);
    const aiUnits = Array.from(units.values()).filter(u => u.ownerId === aiKingdom.id);
    const researched = aiKingdom.researchedTechs || [];

    // 1. Technology Research Phase
    this.processAIResearch(aiKingdom, aiCities.length, logs);

    // 2. Recruitment & Colonisation Phase
    for (const city of aiCities) {
      const cityTile = tiles.get(hexToKey(city.q, city.r));
      if (!cityTile) continue;

      const hasGarrison = cityTile.unitId !== null;

      // Detect if there are nearby cavalry to counter
      const nearbyEnemies = Array.from(units.values()).filter(u => {
        if (u.ownerId === aiKingdom.id) return false;
        return hexDistance({ q: city.q, r: city.r }, { q: u.q, r: u.r }) <= 4;
      });
      const hasCavalryThreat = nearbyEnemies.some(u => u.type === 'cavalry');

      // Decide what unit to recruit based on unlocks and strategy
      let desiredUnit: UnitType | null = null;

      if (!hasGarrison) {
        if (hasCavalryThreat && researched.includes('armour')) {
          desiredUnit = 'spearman';
        } else if (researched.includes('tactics') && Math.random() < 0.35) {
          desiredUnit = 'archer';
        } else if (researched.includes('improved_weapons')) {
          desiredUnit = 'infantry';
        } else {
          desiredUnit = 'scout';
        }
      } else if (aiUnits.length < aiCities.length * 2 + 1) {
        // City already has a garrison, check if we can recruit a settler to expand or a catapult to siege
        const hasUnclaimedNearby = Array.from(tiles.values()).some(t => {
          if (t.ownerId !== null || t.terrain === 'mountain' || t.terrain === 'water') return false;
          return hexDistance({ q: city.q, r: city.r }, { q: t.q, r: t.r }) <= 5;
        });

        if (hasUnclaimedNearby && researched.includes('settlements') && aiCities.length < 3 && Math.random() < 0.4) {
          // Check if adjacent hex is clear to spawn settler
          const neighbors = getNeighbors(city.q, city.r);
          const clearNeighbor = neighbors.find(n => {
            const t = tiles.get(hexToKey(n.q, n.r));
            return t && t.terrain !== 'mountain' && t.terrain !== 'water' && !t.unitId;
          });
          if (clearNeighbor) {
            desiredUnit = 'settler';
          }
        } else if (researched.includes('siegecraft') && Math.random() < 0.3) {
          desiredUnit = 'catapult';
        }
      }

      if (desiredUnit) {
        const uDef = UNIT_DEFINITIONS[desiredUnit];
        if (
          uDef &&
          aiKingdom.gold >= uDef.costGold &&
          aiKingdom.food >= uDef.costFood &&
          aiKingdom.iron >= uDef.costIron
        ) {
          // Find spawn tile (city tile if empty, or adjacent empty tile)
          let spawnCoord = { q: city.q, r: city.r };
          let spawnTile = cityTile;

          if (hasGarrison) {
            const neighbors = getNeighbors(city.q, city.r);
            const clearNeighbor = neighbors.find(n => {
              const t = tiles.get(hexToKey(n.q, n.r));
              return t && t.terrain !== 'mountain' && t.terrain !== 'water' && !t.unitId;
            });
            if (clearNeighbor) {
              spawnCoord = clearNeighbor;
              spawnTile = tiles.get(hexToKey(clearNeighbor.q, clearNeighbor.r))!;
            } else {
              continue; // No clear tile
            }
          }

          aiKingdom.gold -= uDef.costGold;
          aiKingdom.food -= uDef.costFood;
          aiKingdom.iron = Math.max(0, aiKingdom.iron - uDef.costIron);

          const newUnitId = `unit-${aiKingdom.id}-${desiredUnit}-${Date.now().toString(36)}-${Math.floor(Math.random() * 999)}`;
          const newUnit: Unit = {
            id: newUnitId,
            type: desiredUnit,
            name: `${aiKingdom.name} ${uDef.name}`,
            ownerId: aiKingdom.id,
            q: spawnCoord.q,
            r: spawnCoord.r,
            maxHp: uDef.maxHp,
            hp: uDef.maxHp,
            attack: uDef.attack,
            defense: uDef.defense,
            range: uDef.range,
            maxMoves: uDef.moves,
            movesLeft: 0,
            hasAttacked: true,
            visionRange: uDef.vision,
            veterancy: 0,
            isFortified: !hasGarrison,
            isCivilian: uDef.isCivilian,
          };

          units.set(newUnitId, newUnit);
          spawnTile.unitId = newUnitId;

          logs.push({
            factionName: aiKingdom.name,
            action: 'recruit',
            description: `${aiKingdom.name} recruited a ${uDef.name} at ${city.name}.`,
          });
        }
      }
    }

    // 3. Unit Maneuvers and Tactical Combat Phase
    for (const unit of aiUnits) {
      if (unit.hp <= 0 || !units.has(unit.id)) continue;
      unit.movesLeft = unit.maxMoves;
      unit.hasAttacked = false;

      const currentTile = tiles.get(hexToKey(unit.q, unit.r));
      if (!currentTile) continue;

      // Special Settler AI: Migrate to unclaimed fertile land and found city
      if (unit.type === 'settler') {
        this.processAISettler(unit, aiKingdom, tiles, units, cities, logs);
        continue;
      }

      // Wounded defender: heal in city if fortified
      if (unit.hp < unit.maxHp * 0.45 && currentTile.cityId) {
        unit.isFortified = true;
        unit.movesLeft = 0;
        continue;
      }

      // Check for targets within attack range
      let targetUnit: Unit | null = null;
      let targetTile: HexTile | null = null;

      const attackTargets = getTilesInRange({ q: unit.q, r: unit.r }, unit.range);
      for (const tCoord of attackTargets) {
        const tKey = hexToKey(tCoord.q, tCoord.r);
        const candidateTile = tiles.get(tKey);
        if (candidateTile && candidateTile.unitId) {
          const occ = units.get(candidateTile.unitId);
          if (occ && occ.ownerId !== aiKingdom.id) {
            targetUnit = occ;
            targetTile = candidateTile;
            break;
          }
        }
      }

      // If attack target found, engage with tactical rules!
      if (targetUnit && targetTile) {
        const targetOwner = allKingdoms.find(k => k.id === targetUnit!.ownerId);
        const combatResult = GameEngine.resolveCombat(
          unit,
          targetUnit,
          targetTile,
          currentTile,
          tiles,
          units,
          aiKingdom.researchedTechs,
          targetOwner?.researchedTechs || []
        );

        unit.hasAttacked = true;
        unit.movesLeft = 0;

        targetUnit.hp = Math.max(0, targetUnit.hp - combatResult.defenderDamage);
        unit.hp = Math.max(0, unit.hp - combatResult.attackerDamage);

        if (targetUnit.hp <= 0) {
          units.delete(targetUnit.id);
          targetTile.unitId = null;

          if (unit.range === 1 && unit.hp > 0 && !unit.isCivilian) {
            currentTile.unitId = null;
            targetTile.unitId = unit.id;
            unit.q = targetTile.q;
            unit.r = targetTile.r;

            if (targetTile.cityId) {
              const city = cities.get(targetTile.cityId);
              if (city && city.ownerId !== aiKingdom.id) {
                GameEngine.captureCity(city, aiKingdom.id, tiles);
                logs.push({
                  factionName: aiKingdom.name,
                  action: 'capture',
                  description: `${aiKingdom.name} conquered ${city.name}!`,
                });
              }
            }
          }
        }

        if (unit.hp <= 0) {
          units.delete(unit.id);
          currentTile.unitId = null;
        }

        logs.push({
          factionName: aiKingdom.name,
          action: 'attack',
          description: combatResult.log,
        });

        continue;
      }

      // Strategic Movement: Pathfind toward nearest enemy settlement or player unit
      let nearestTargetCoord: { q: number; r: number } | null = null;
      let minDist = Infinity;

      for (const city of cities.values()) {
        if (city.ownerId !== aiKingdom.id) {
          const d = hexDistance({ q: unit.q, r: unit.r }, { q: city.q, r: city.r });
          const weight = city.ownerId === 'player' ? 0.75 : 1.0;
          if (d * weight < minDist) {
            minDist = d * weight;
            nearestTargetCoord = { q: city.q, r: city.r };
          }
        }
      }

      if (nearestTargetCoord) {
        const path = findPath(
          { q: unit.q, r: unit.r },
          nearestTargetCoord,
          tiles,
          units,
          unit,
          aiKingdom.researchedTechs
        );

        if (path && path.length > 0) {
          let movesRemaining = unit.movesLeft;
          let currentStep = { q: unit.q, r: unit.r };

          for (const step of path) {
            const stepKey = hexToKey(step.q, step.r);
            const stepTile = tiles.get(stepKey);
            if (!stepTile) break;

            const cost = stepTile.terrain === 'water' && aiKingdom.researchedTechs.includes('navigation') ? 2 : stepTile.moveCost;
            if (cost > movesRemaining) break;

            if (stepTile.unitId) {
              const enemy = units.get(stepTile.unitId);
              if (enemy && enemy.ownerId !== aiKingdom.id) {
                const targetOwner = allKingdoms.find(k => k.id === enemy.ownerId);
                const combatResult = GameEngine.resolveCombat(
                  unit,
                  enemy,
                  stepTile,
                  tiles.get(hexToKey(currentStep.q, currentStep.r))!,
                  tiles,
                  units,
                  aiKingdom.researchedTechs,
                  targetOwner?.researchedTechs || []
                );

                enemy.hp = Math.max(0, enemy.hp - combatResult.defenderDamage);
                unit.hp = Math.max(0, unit.hp - combatResult.attackerDamage);

                if (enemy.hp <= 0) {
                  units.delete(enemy.id);
                  stepTile.unitId = null;
                  if (unit.hp > 0 && unit.range === 1) {
                    const oldTile = tiles.get(hexToKey(currentStep.q, currentStep.r));
                    if (oldTile) oldTile.unitId = null;
                    stepTile.unitId = unit.id;
                    unit.q = step.q;
                    unit.r = step.r;
                    if (stepTile.cityId) {
                      const capturedCity = cities.get(stepTile.cityId);
                      if (capturedCity && capturedCity.ownerId !== aiKingdom.id) {
                        GameEngine.captureCity(capturedCity, aiKingdom.id, tiles);
                      }
                    }
                  }
                }
                if (unit.hp <= 0) {
                  units.delete(unit.id);
                  const oldTile = tiles.get(hexToKey(currentStep.q, currentStep.r));
                  if (oldTile) oldTile.unitId = null;
                }
                break;
              }
              break;
            }

            // Normal step
            movesRemaining -= cost;
            const oldTile = tiles.get(hexToKey(currentStep.q, currentStep.r));
            if (oldTile) oldTile.unitId = null;
            stepTile.unitId = unit.id;
            unit.q = step.q;
            unit.r = step.r;
            currentStep = step;

            if (stepTile.cityId) {
              const c = cities.get(stepTile.cityId);
              if (c && c.ownerId !== aiKingdom.id) {
                GameEngine.captureCity(c, aiKingdom.id, tiles);
                logs.push({
                  factionName: aiKingdom.name,
                  action: 'capture',
                  description: `${aiKingdom.name} occupied ${c.name}!`,
                });
              }
            }
          }

          unit.movesLeft = movesRemaining;
        }
      }
    }

    return logs;
  }

  /**
   * AI Technology selection driven by personality priority lists.
   */
  private static processAIResearch(aiKingdom: Kingdom, numCities: number, logs: AIActionLog[]): void {
    const researched = aiKingdom.researchedTechs || [];

    // Personality prioritised trees
    const priorityMap: Record<string, TechId[]> = {
      militant: ['improved_weapons', 'armour', 'tactics', 'siegecraft', 'fortifications', 'roads'],
      expansionist: ['scouting', 'settlements', 'roads', 'farming', 'navigation', 'irrigation'],
      economic: ['construction', 'farming', 'trade', 'administration', 'logistics', 'fortifications'],
    };

    const priorities = priorityMap[aiKingdom.personality || 'militant'] || priorityMap.militant;

    // Find first unresearched tech with prerequisites met
    for (const techId of priorities) {
      if (researched.includes(techId)) continue;
      const tech = TECHNOLOGIES[techId];
      if (!tech) continue;

      const hasPrereqs = tech.prerequisites.every(p => researched.includes(p));
      if (!hasPrereqs) continue;

      const cost = calculateTechCost(tech.tier, numCities);
      // AI maintains a reserve of 40 gold for army sustainment
      if (aiKingdom.gold >= cost + 30) {
        const res = GameEngine.researchTechnology(aiKingdom, techId, numCities);
        if (res.success) {
          logs.push({
            factionName: aiKingdom.name,
            action: 'research',
            description: `${aiKingdom.name} researched ${tech.name} (${cost} Gold).`,
          });
          break; // 1 tech per turn max
        }
      }
    }
  }

  /**
   * Special AI routine for settler units.
   */
  private static processAISettler(
    settler: Unit,
    aiKingdom: Kingdom,
    tiles: Map<string, HexTile>,
    units: Map<string, Unit>,
    cities: Map<string, City>,
    logs: AIActionLog[]
  ): void {
    const currentTile = tiles.get(hexToKey(settler.q, settler.r));
    if (!currentTile) return;

    // If current tile is fertile, unclaimed, and not too close to another city -> Found city immediately!
    const citiesNear = Array.from(cities.values()).some(c => hexDistance({ q: settler.q, r: settler.r }, { q: c.q, r: c.r }) < 3);

    if (!citiesNear && currentTile.ownerId === null && currentTile.terrain !== 'mountain' && currentTile.terrain !== 'water') {
      const res = GameEngine.foundNewCity(settler, aiKingdom, tiles, cities, units);
      if (res.success && res.city) {
        logs.push({
          factionName: aiKingdom.name,
          action: 'settle',
          description: `${aiKingdom.name} established a new colony at ${res.city.name}!`,
        });
      }
      return;
    }

    // Otherwise, move toward nearest unclaimed fertile land
    const fertileUnclaimed = Array.from(tiles.values()).filter(t => {
      if (t.ownerId !== null || t.terrain === 'mountain' || t.terrain === 'water') return false;
      const distToExisting = Math.min(...Array.from(cities.values()).map(c => hexDistance({ q: t.q, r: t.r }, { q: c.q, r: c.r })));
      return distToExisting >= 3;
    });

    if (fertileUnclaimed.length > 0) {
      // Pick closest
      let closestTile: HexTile | null = null;
      let closestDist = Infinity;
      for (const t of fertileUnclaimed) {
        const d = hexDistance({ q: settler.q, r: settler.r }, { q: t.q, r: t.r });
        if (d < closestDist) {
          closestDist = d;
          closestTile = t;
        }
      }

      if (closestTile) {
        const path = findPath(
          { q: settler.q, r: settler.r },
          { q: closestTile.q, r: closestTile.r },
          tiles,
          units,
          settler,
          aiKingdom.researchedTechs
        );
        if (path && path.length > 0) {
          const nextStep = path[0];
          const nextTile = tiles.get(hexToKey(nextStep.q, nextStep.r));
          if (nextTile && !nextTile.unitId && nextTile.moveCost <= settler.movesLeft) {
            currentTile.unitId = null;
            nextTile.unitId = settler.id;
            settler.q = nextStep.q;
            settler.r = nextStep.r;
            settler.movesLeft = 0;
          }
        }
      }
    }
  }
}
