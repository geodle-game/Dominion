import React, { useRef, useEffect } from 'react';
import { City, FogState, HexTile, Kingdom, Unit } from '../types/game';
import { TERRAIN_DATA } from '../game/constants';
import { hexToWorld, worldToHex } from '../game/hexUtils';
import { MapPin, Compass } from 'lucide-react';
import { sounds } from '../audio/soundManager';

interface MinimapProps {
  tiles: Map<string, HexTile>;
  units: Map<string, Unit>;
  cities: Map<string, City>;
  fogMap: Map<string, FogState>;
  kingdoms: Kingdom[];
  onPanToWorld: (x: number, z: number) => void;
}

export const Minimap: React.FC<MinimapProps> = ({
  tiles,
  units,
  cities,
  fogMap,
  kingdoms,
  onPanToWorld,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const kingdomColorMap = new Map<string, string>();
  kingdoms.forEach(k => kingdomColorMap.set(k.id, k.color));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear
    ctx.fillStyle = '#060a12';
    ctx.fillRect(0, 0, width, height);

    // Compute bounding box
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const tile of tiles.values()) {
      if (tile.x < minX) minX = tile.x;
      if (tile.x > maxX) maxX = tile.x;
      if (tile.z < minZ) minZ = tile.z;
      if (tile.z > maxZ) maxZ = tile.z;
    }

    const rangeX = Math.max(1, maxX - minX);
    const rangeZ = Math.max(1, maxZ - minZ);
    const padding = 12;

    const toCanvasX = (worldX: number) => padding + ((worldX - minX) / rangeX) * (width - padding * 2);
    const toCanvasY = (worldZ: number) => padding + ((worldZ - minZ) / rangeZ) * (height - padding * 2);

    // Draw Hex Tiles
    for (const tile of tiles.values()) {
      const fog = fogMap.get(tile.id) || 'unexplored';
      const cx = toCanvasX(tile.x);
      const cy = toCanvasY(tile.z);

      if (fog === 'unexplored') {
        ctx.fillStyle = '#0f172a';
      } else if (tile.ownerId && fog === 'visible') {
        ctx.fillStyle = kingdomColorMap.get(tile.ownerId) || '#3b82f6';
      } else if (fog === 'explored') {
        ctx.fillStyle = '#1e293b';
      } else {
        const hexCol = `#${TERRAIN_DATA[tile.terrain].color.toString(16).padStart(6, '0')}`;
        ctx.fillStyle = hexCol;
      }

      ctx.beginPath();
      ctx.arc(cx, cy, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Cities
    for (const city of cities.values()) {
      const fog = fogMap.get(`${city.q},${city.r}`) || 'unexplored';
      if (fog === 'unexplored') continue;

      const pos = hexToWorld(city.q, city.r);
      const cx = toCanvasX(pos.x);
      const cy = toCanvasY(pos.z);

      ctx.fillStyle = city.ownerId === 'player' ? '#fbbf24' : '#ef4444';
      ctx.fillRect(cx - 3, cy - 3, 6, 6);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1;
      ctx.strokeRect(cx - 3, cy - 3, 6, 6);
    }

    // Draw Units
    for (const unit of units.values()) {
      const fog = fogMap.get(`${unit.q},${unit.r}`) || 'unexplored';
      if (unit.ownerId !== 'player' && fog !== 'visible') continue;

      const pos = hexToWorld(unit.q, unit.r);
      const cx = toCanvasX(pos.x);
      const cy = toCanvasY(pos.z);

      ctx.fillStyle = unit.ownerId === 'player' ? '#60a5fa' : '#f87171';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [tiles, units, cities, fogMap, kingdoms]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;

    for (const tile of tiles.values()) {
      if (tile.x < minX) minX = tile.x;
      if (tile.x > maxX) maxX = tile.x;
      if (tile.z < minZ) minZ = tile.z;
      if (tile.z > maxZ) maxZ = tile.z;
    }

    const rangeX = Math.max(1, maxX - minX);
    const rangeZ = Math.max(1, maxZ - minZ);
    const padding = 12;

    const normX = (clickX - padding) / (canvas.width - padding * 2);
    const normZ = (clickY - padding) / (canvas.height - padding * 2);

    const worldX = minX + normX * rangeX;
    const worldZ = minZ + normZ * rangeZ;

    sounds.playSelect();
    onPanToWorld(worldX, worldZ);
  };

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-20 rounded-xl border border-slate-700/80 bg-slate-900/90 p-2.5 shadow-2xl backdrop-blur-none select-none">
      <div className="flex items-center justify-between mb-1.5 px-1">
        <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1">
          <Compass className="h-3 w-3 text-amber-400" /> Strategic Chart
        </span>
        <span className="text-[10px] text-slate-400">Click to jump</span>
      </div>
      <canvas
        ref={canvasRef}
        width={140}
        height={140}
        onClick={handleCanvasClick}
        className="rounded-lg border border-slate-800 bg-slate-950 cursor-crosshair shadow-inner"
        title="Minimap: Click to navigate camera"
      />
    </div>
  );
};
