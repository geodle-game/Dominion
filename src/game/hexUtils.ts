import { HexCoord, HexTile, Unit } from '../types/game';

export const HEX_RADIUS = 2.0;
export const HEX_WIDTH = Math.sqrt(3) * HEX_RADIUS; // ~3.464
export const HEX_HEIGHT = 2 * HEX_RADIUS;           // 4.0

export const AXIAL_DIRECTIONS: HexCoord[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
];

export function hexToKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function keyToHex(key: string): HexCoord {
  const [q, r] = key.split(',').map(Number);
  return { q, r };
}

export function hexDistance(a: HexCoord, b: HexCoord): number {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = -a.q - a.r - (-b.q - b.r);
  return (Math.abs(dq) + Math.abs(dr) + Math.abs(ds)) / 2;
}

export function hexToWorld(q: number, r: number, radius: number = HEX_RADIUS): { x: number; z: number } {
  const x = radius * Math.sqrt(3) * (q + r / 2);
  const z = radius * (3 / 2) * r;
  return { x, z };
}

export function worldToHex(x: number, z: number, radius: number = HEX_RADIUS): HexCoord {
  const q = ((Math.sqrt(3) / 3) * x - (1 / 3) * z) / radius;
  const r = ((2 / 3) * z) / radius;
  return cubeRound(q, r, -q - r);
}

function cubeRound(fracQ: number, fracR: number, fracS: number): HexCoord {
  let q = Math.round(fracQ);
  let r = Math.round(fracR);
  let s = Math.round(fracS);

  const qDiff = Math.abs(q - fracQ);
  const rDiff = Math.abs(r - fracR);
  const sDiff = Math.abs(s - fracS);

  if (qDiff > rDiff && qDiff > sDiff) {
    q = -r - s;
  } else if (rDiff > sDiff) {
    r = -q - s;
  }
  return { q, r };
}

export function getNeighbors(q: number, r: number): HexCoord[] {
  return AXIAL_DIRECTIONS.map(dir => ({
    q: q + dir.q,
    r: r + dir.r,
  }));
}

export function getTilesInRange(center: HexCoord, range: number): HexCoord[] {
  const results: HexCoord[] = [];
  for (let q = -range; q <= range; q++) {
    const r1 = Math.max(-range, -q - range);
    const r2 = Math.min(range, -q + range);
    for (let r = r1; r <= r2; r++) {
      results.push({ q: center.q + q, r: center.r + r });
    }
  }
  return results;
}

/**
 * Dijkstra / Breadth-first search to find all reachable tiles given remaining moves.
 * Returns map of tileKey -> remaining moves.
 */
export function getReachableTiles(
  start: HexCoord,
  movesLeft: number,
  tilesMap: Map<string, HexTile>,
  unitsMap: Map<string, Unit>,
  unit: Unit
): Map<string, number> {
  const reachable = new Map<string, number>();
  if (movesLeft <= 0) return reachable;

  const startKey = hexToKey(start.q, start.r);
  const queue: { coord: HexCoord; costSoFar: number }[] = [{ coord: start, costSoFar: 0 }];
  const bestCost = new Map<string, number>();
  bestCost.set(startKey, 0);

  while (queue.length > 0) {
    // Sort ascending by costSoFar
    queue.sort((a, b) => a.costSoFar - b.costSoFar);
    const current = queue.shift()!;

    const neighbors = getNeighbors(current.coord.q, current.coord.r);
    for (const n of neighbors) {
      const nKey = hexToKey(n.q, n.r);
      const tile = tilesMap.get(nKey);
      if (!tile) continue;

      // Impassable terrain: mountain or deep water
      if (tile.terrain === 'mountain' || tile.terrain === 'water') continue;

      let moveCost = tile.moveCost;
      // Cavalry bonus: moves on grassland cost only 1
      if (unit.type === 'cavalry' && tile.terrain === 'grassland') {
        moveCost = 1;
      }

      // Check occupied by unit
      const occupant = tile.unitId ? unitsMap.get(tile.unitId) : null;
      if (occupant && occupant.ownerId !== unit.ownerId) {
        // Can only move into enemy tile if melee attacking!
        if (unit.range === 1 && current.costSoFar + moveCost <= movesLeft) {
          reachable.set(nKey, movesLeft - (current.costSoFar + moveCost));
        }
        continue;
      }

      // If friendly unit is on tile, we can't end move there, but could path through if implemented,
      // or for simplicity in hex tactics: 1 unit per tile max
      if (occupant && occupant.id !== unit.id) {
        continue;
      }

      const totalCost = current.costSoFar + moveCost;
      if (totalCost <= movesLeft) {
        const prevBest = bestCost.get(nKey);
        if (prevBest === undefined || totalCost < prevBest) {
          bestCost.set(nKey, totalCost);
          reachable.set(nKey, movesLeft - totalCost);
          queue.push({ coord: n, costSoFar: totalCost });
        }
      }
    }
  }

  reachable.delete(startKey);
  return reachable;
}

/**
 * A* Pathfinding from start to goal.
 */
export function findPath(
  start: HexCoord,
  goal: HexCoord,
  tilesMap: Map<string, HexTile>,
  unitsMap: Map<string, Unit>,
  unit: Unit
): HexCoord[] | null {
  const startKey = hexToKey(start.q, start.r);
  const goalKey = hexToKey(goal.q, goal.r);
  if (startKey === goalKey) return [];

  interface PathNode {
    coord: HexCoord;
    gCost: number;
    fCost: number;
    parentKey: string | null;
  }

  const openSet = new Map<string, PathNode>();
  const closedSet = new Set<string>();
  const allNodes = new Map<string, PathNode>();

  const startNode: PathNode = {
    coord: start,
    gCost: 0,
    fCost: hexDistance(start, goal),
    parentKey: null,
  };
  openSet.set(startKey, startNode);
  allNodes.set(startKey, startNode);

  while (openSet.size > 0) {
    let currentKey: string | null = null;
    let lowestF = Infinity;

    for (const [key, node] of openSet.entries()) {
      if (node.fCost < lowestF) {
        lowestF = node.fCost;
        currentKey = key;
      }
    }

    if (!currentKey) break;
    const currentNode = openSet.get(currentKey)!;

    if (currentKey === goalKey) {
      // Reconstruct path
      const path: HexCoord[] = [];
      let traceKey: string | null = currentKey;
      while (traceKey && traceKey !== startKey) {
        const pNode: PathNode | undefined = allNodes.get(traceKey);
        if (!pNode) break;
        path.unshift(pNode.coord);
        traceKey = pNode.parentKey;
      }
      return path;
    }

    openSet.delete(currentKey);
    closedSet.add(currentKey);

    const neighbors = getNeighbors(currentNode.coord.q, currentNode.coord.r);
    for (const n of neighbors) {
      const nKey = hexToKey(n.q, n.r);
      if (closedSet.has(nKey)) continue;

      const tile = tilesMap.get(nKey);
      if (!tile) continue;
      if (tile.terrain === 'mountain' || tile.terrain === 'water') continue;

      // Allow stepping into goal even if enemy unit is there (for attack)
      const occupant = tile.unitId ? unitsMap.get(tile.unitId) : null;
      if (occupant && occupant.id !== unit.id && nKey !== goalKey) {
        continue;
      }

      const tentativeG = currentNode.gCost + tile.moveCost;
      const existing = openSet.get(nKey);

      if (!existing || tentativeG < existing.gCost) {
        const h = hexDistance(n, goal);
        const newNode: PathNode = {
          coord: n,
          gCost: tentativeG,
          fCost: tentativeG + h,
          parentKey: currentKey,
        };
        openSet.set(nKey, newNode);
        allNodes.set(nKey, newNode);
      }
    }
  }

  return null;
}
