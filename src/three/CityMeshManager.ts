import * as THREE from 'three';
import { City, FogState, HexTile, Kingdom } from '../types/game';
import { TERRAIN_DATA } from '../game/constants';
import { hexToKey, hexToWorld } from '../game/hexUtils';

export class CityMeshManager {
  public group: THREE.Group;
  private cityMeshes: Map<string, THREE.Group>;

  constructor() {
    this.group = new THREE.Group();
    this.cityMeshes = new Map();
  }

  public updateCities(
    cities: Map<string, City>,
    tiles: Map<string, HexTile>,
    fogMap: Map<string, FogState>,
    kingdoms: Kingdom[]
  ): void {
    const kingdomColorMap = new Map<string, number>();
    kingdoms.forEach(k => kingdomColorMap.set(k.id, k.accentHex));

    // Remove deleted cities
    const currentCityIds = new Set(cities.keys());
    for (const [id, meshGroup] of this.cityMeshes.entries()) {
      if (!currentCityIds.has(id)) {
        this.group.remove(meshGroup);
        this.cityMeshes.delete(id);
      }
    }

    // Add or update cities
    for (const [id, city] of cities.entries()) {
      const tileKey = hexToKey(city.q, city.r);
      const tile = tiles.get(tileKey);
      if (!tile) continue;

      const fog = fogMap.get(tileKey) || 'unexplored';
      const isVisible = fog !== 'unexplored';

      const worldPos = hexToWorld(city.q, city.r);
      const groundY = (TERRAIN_DATA[tile.terrain]?.height || 0.2) + 0.6;

      let cityGroup = this.cityMeshes.get(id);
      const factionColor = kingdomColorMap.get(city.ownerId) || 0x64748b;

      if (!cityGroup) {
        cityGroup = this.createCityModel(city, factionColor);
        cityGroup.position.set(worldPos.x, groundY, worldPos.z);
        this.group.add(cityGroup);
        this.cityMeshes.set(id, cityGroup);
      }

      // Synchronize userData on city group and all tower/keep children
      const cityUserData = { tileKey, q: city.q, r: city.r, cityId: city.id, type: 'city' };
      cityGroup.userData = cityUserData;
      cityGroup.traverse((child) => {
        child.userData = cityUserData;
      });

      cityGroup.visible = isVisible;
    }
  }

  private createCityModel(city: City, factionColor: number): THREE.Group {
    const group = new THREE.Group();

    const stoneMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.9,
      metalness: 0.1,
      flatShading: true,
    });
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c, // dark terracotta roof
      roughness: 0.7,
      flatShading: true,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.9,
    });
    const bannerMat = new THREE.MeshStandardMaterial({
      color: factionColor,
      roughness: 0.5,
      side: THREE.DoubleSide,
    });

    // 1. Central Keep
    const keep = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.0, 0.8), stoneMat);
    keep.position.y = 0.5;
    keep.castShadow = true;
    group.add(keep);

    // Keep Roof
    const keepRoof = new THREE.Mesh(new THREE.ConeGeometry(0.65, 0.6, 4), roofMat);
    keepRoof.rotation.y = Math.PI / 4;
    keepRoof.position.y = 1.3;
    keepRoof.castShadow = true;
    group.add(keepRoof);

    // 2. Central Flag Spire
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), woodMat);
    spire.position.y = 1.9;
    group.add(spire);

    // Faction Banner
    const bannerGeo = new THREE.PlaneGeometry(0.4, 0.25);
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0.2, 2.2, 0);
    banner.name = 'cityBanner';
    group.add(banner);

    // 3. Four Corner Watchtowers
    const towerGeo = new THREE.CylinderGeometry(0.2, 0.22, 0.8, 6);
    const towerRoofGeo = new THREE.ConeGeometry(0.26, 0.45, 6);

    const towerOffsets = [
      [-0.6, -0.6],
      [0.6, -0.6],
      [-0.6, 0.6],
      [0.6, 0.6],
    ];

    towerOffsets.forEach(([ox, oz]) => {
      const tower = new THREE.Mesh(towerGeo, stoneMat);
      tower.position.set(ox, 0.4, oz);
      tower.castShadow = true;
      group.add(tower);

      const roof = new THREE.Mesh(towerRoofGeo, roofMat);
      roof.position.set(ox, 0.95, oz);
      roof.castShadow = true;
      group.add(roof);
    });

    // 4. Perimeter Rampart Walls
    const wallZ = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.15), stoneMat);
    wallZ.position.set(0, 0.22, -0.6);
    group.add(wallZ);

    const wallZ2 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.15), stoneMat);
    wallZ2.position.set(0, 0.22, 0.6);
    group.add(wallZ2);

    const wallX = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.45, 1.2), stoneMat);
    wallX.position.set(-0.6, 0.22, 0);
    group.add(wallX);

    const wallX2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.45, 1.2), stoneMat);
    wallX2.position.set(0.6, 0.22, 0);
    group.add(wallX2);

    // 5. Surrounding Cottages
    const cottageGeo = new THREE.BoxGeometry(0.3, 0.25, 0.35);
    const cottage = new THREE.Mesh(cottageGeo, stoneMat);
    cottage.position.set(0.85, 0.12, 0.1);
    group.add(cottage);

    const cRoof = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.22, 4), roofMat);
    cRoof.rotation.y = Math.PI / 4;
    cRoof.position.set(0.85, 0.32, 0.1);
    group.add(cRoof);

    // City Name Billboard
    const nameMesh = this.createNameBillboard(city.name);
    nameMesh.position.y = 2.65;
    nameMesh.name = 'cityBillboard';
    group.add(nameMesh);

    return group;
  }

  private createNameBillboard(text: string): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Rounded background pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.roundRect ? ctx.roundRect(8, 8, 240, 48, 12) : ctx.fillRect(8, 8, 240, 48);
    ctx.fill();

    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const planeMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), planeMat);
    mesh.renderOrder = 95;
    return mesh;
  }

  public update(delta: number, cameraRotationY: number): void {
    // Face billboards to camera and animate flags
    const time = performance.now() * 0.005;
    for (const [, group] of this.cityMeshes.entries()) {
      if (!group.visible) continue;

      const billboard = group.getObjectByName('cityBillboard');
      if (billboard) {
        billboard.rotation.y = cameraRotationY;
      }

      const banner = group.getObjectByName('cityBanner');
      if (banner) {
        banner.rotation.y = Math.sin(time + group.position.x) * 0.2;
      }
    }
  }
}
