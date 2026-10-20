import { City, HexTile, Kingdom, Unit, UnitType } from '../types/game';
import { UNIT_DEFINITIONS } from './constants';
import { GameEngine } from './gameEngine';
import { findPath, getNeighbors, getReachableTiles, getTilesInRange, hexDistance, hexToKey } from './hexUtils';

export interface AIActionLog {
  factionName: string;
  action: 'recruit' | 'move' | 'attack' | 'build' | 'capture';
  description: string;
}

export class AIEngine {
  /**
   * Processes an AI kingdom's complete turn.
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

    // 1. Economic & Recruitment Phase
    for (const city of aiCities) {
      const cityTile = tiles.get(hexToKey(city.q, city.r));
      if (!cityTile) continue;

      // Check if city hex is vacant of units
      const hasGarrison = cityTile.unitId !== null;

      // Decide what unit to recruit
      const canAffordInfantry = aiKingdom.gold >= UNIT_DEFINITIONS.infantry.costGold && aiKingdom.food >= UNIT_DEFINITIONS.infantry.costFood;
      const canAffordScout = aiKingdom.gold >= UNIT_DEFINITIONS.scout.costGold && aiKingdom.food >= UNIT_DEFINITIONS.scout.costFood;
      const canAffordArcher = aiKingdom.gold >= UNIT_DEFINITIONS.archer.costGold && aiKingdom.food >= UNIT_DEFINITIONS.archer.costFood;
      const canAffordCavalry = aiKingdom.gold >= UNIT_DEFINITIONS.cavalry.costGold && aiKingdom.food >= UNIT_DEFINITIONS.cavalry.costFood;

      if (!hasGarrison && (canAffordInfantry || canAffordScout)) {
        let recruitType: UnitType = 'infantry';
        if (canAffordCavalry && Math.random() < 0.3) {
          recruitType = 'cavalry';
        } else if (canAffordArcher && Math.random() < 0.4) {
          recruitType = 'archer';
        } else if (!canAffordInfantry && canAffordScout) {
          recruitType = 'scout';
        }

        const uDef = UNIT_DEFINITIONS[recruitType];
        aiKingdom.gold -= uDef.costGold;
        aiKingdom.food -= uDef.costFood;
        aiKingdom.iron = Math.max(0, aiKingdom.iron - uDef.costIron);

        const newUnitId = `unit-${aiKingdom.id}-${recruitType}-${Date.now().toString(36)}-${Math.floor(Math.random() * 999)}`;
        const newUnit: Unit = {
          id: newUnitId,
          type: recruitType,
          name: `${aiKingdom.name} ${uDef.name}`,
          ownerId: aiKingdom.id,
          q: city.q,
          r: city.r,
          maxHp: uDef.maxHp,
          hp: uDef.maxHp,
          attack: uDef.attack,
          defense: uDef.defense,
          range: uDef.range,
          maxMoves: uDef.moves,
          movesLeft: 0, // Recruited units cannot move on the same turn
          hasAttacked: true,
          visionRange: uDef.vision,
          veterancy: 0,
          isFortified: true,
        };

        units.set(newUnitId, newUnit);
        cityTile.unitId = newUnitId;

        logs.push({
          factionName: aiKingdom.name,
          action: 'recruit',
          description: `${aiKingdom.name} recruited a ${uDef.name} at ${city.name}.`,
        });
      }
    }

    // 2. Unit Maneuvers and Combat Phase
    for (const unit of aiUnits) {
      if (unit.hp <= 0 || !units.has(unit.id)) continue;
      unit.movesLeft = unit.maxMoves;
      unit.hasAttacked = false;

      const currentTile = tiles.get(hexToKey(unit.q, unit.r));
      if (!currentTile) continue;

      // Check if unit is in danger (low HP) and fortified on a city
      if (unit.hp < unit.maxHp * 0.4 && currentTile.cityId) {
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

      // If attack target found, engage!
      if (targetUnit && targetTile) {
        const combatResult = GameEngine.resolveCombat(unit, targetUnit, targetTile, currentTile);
        unit.hasAttacked = true;
        unit.movesLeft = 0;

        targetUnit.hp = Math.max(0, targetUnit.hp - combatResult.defenderDamage);
        unit.hp = Math.max(0, unit.hp - combatResult.attackerDamage);

        if (targetUnit.hp <= 0) {
          units.delete(targetUnit.id);
          targetTile.unitId = null;

          // If melee and defender dead, advance into tile
          if (unit.range === 1 && unit.hp > 0) {
            currentTile.unitId = null;
            targetTile.unitId = unit.id;
            unit.q = targetTile.q;
            unit.r = targetTile.r;

            // If tile has a city not owned by this AI, capture it!
            if (targetTile.cityId) {
              const city = cities.get(targetTile.cityId);
              if (city && city.ownerId !== aiKingdom.id) {
                GameEngine.captureCity(city, aiKingdom.id, tiles);
                logs.push({
                  factionName: aiKingdom.name,
                  action: 'capture',
                  description: `${aiKingdom.name} captured ${city.name}!`,
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

      // 3. Strategic Movement: Pathfind toward nearest enemy settlement or player unit
      let nearestTargetCoord: { q: number; r: number } | null = null;
      let minDist = Infinity;

      // Check all cities owned by rival kingdoms (especially player)
      for (const city of cities.values()) {
        if (city.ownerId !== aiKingdom.id) {
          const d = hexDistance({ q: unit.q, r: unit.r }, { q: city.q, r: city.r });
          // Prioritize player's capital
          const weight = city.ownerId === 'player' ? 0.8 : 1.0;
          if (d * weight < minDist) {
            minDist = d * weight;
            nearestTargetCoord = { q: city.q, r: city.r };
          }
        }
      }

      // If no city found, seek player units
      if (!nearestTargetCoord) {
        for (const otherUnit of units.values()) {
          if (otherUnit.ownerId !== aiKingdom.id) {
            const d = hexDistance({ q: unit.q, r: unit.r }, { q: otherUnit.q, r: otherUnit.r });
            if (d < minDist) {
              minDist = d;
              nearestTargetCoord = { q: otherUnit.q, r: otherUnit.r };
            }
          }
        }
      }

      if (nearestTargetCoord) {
        const path = findPath(
          { q: unit.q, r: unit.r },
          nearestTargetCoord,
          tiles,
          units,
          unit
        );

        if (path && path.length > 0) {
          // Move as far along the path as moves allow
          let movesRemaining = unit.movesLeft;
          let currentStep = { q: unit.q, r: unit.r };

          for (const step of path) {
            const stepKey = hexToKey(step.q, step.r);
            const stepTile = tiles.get(stepKey);
            if (!stepTile) break;

            const cost = stepTile.moveCost;
            if (cost > movesRemaining) break;

            // If tile has enemy unit, attack it if we have moves
            if (stepTile.unitId) {
              const enemy = units.get(stepTile.unitId);
              if (enemy && enemy.ownerId !== aiKingdom.id) {
                const combatResult = GameEngine.resolveCombat(unit, enemy, stepTile, tiles.get(hexToKey(currentStep.q, currentStep.r))!);
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
              // If occupied by friendly, cannot step
              break;
            }

            // Valid empty step
            movesRemaining -= cost;
            const oldTile = tiles.get(hexToKey(currentStep.q, currentStep.r));
            if (oldTile) oldTile.unitId = null;
            stepTile.unitId = unit.id;
            unit.q = step.q;
            unit.r = step.r;
            currentStep = step;

            // Check if captured an undefended enemy city!
            if (stepTile.cityId) {
              const c = cities.get(stepTile.cityId);
              if (c && c.ownerId !== aiKingdom.id) {
                GameEngine.captureCity(c, aiKingdom.id, tiles);
                logs.push({
                  factionName: aiKingdom.name,
                  action: 'capture',
                  description: `${aiKingdom.name} captured undefended ${c.name}!`,
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
}
