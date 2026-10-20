import * as THREE from 'three';
import { FogState, HexTile, Kingdom, Unit } from '../types/game';
import { TERRAIN_DATA } from '../game/constants';
import { hexToKey, hexToWorld } from '../game/hexUtils';

interface AnimatedUnitData {
  meshGroup: THREE.Group;
  currentPos: THREE.Vector3;
  targetPos: THREE.Vector3;
  isMoving: boolean;
  attackAnimTimer: number; // >0 if lunging
  hpBarMesh: THREE.Mesh;
}

export class UnitMeshManager {
  public group: THREE.Group;
  private unitMeshes: Map<string, AnimatedUnitData>;
  private materialsCache: Map<string, THREE.Material>;

  constructor() {
    this.group = new THREE.Group();
    this.unitMeshes = new Map();
    this.materialsCache = new Map();
  }

  private getMaterial(color: number, roughness: number = 0.6, metalness: number = 0.2): THREE.MeshStandardMaterial {
    const key = `${color}_${roughness}_${metalness}`;
    if (!this.materialsCache.has(key)) {
      this.materialsCache.set(
        key,
        new THREE.MeshStandardMaterial({
          color,
          roughness,
          metalness,
          flatShading: true,
        })
      );
    }
    return this.materialsCache.get(key) as THREE.MeshStandardMaterial;
  }

  /**
   * Syncs unit 3D representations with authoritative game state.
   */
  public updateUnits(
    units: Map<string, Unit>,
    tiles: Map<string, HexTile>,
    fogMap: Map<string, FogState>,
    kingdoms: Kingdom[]
  ): void {
    const currentUnitIds = new Set(units.keys());
    const kingdomColorMap = new Map<string, number>();
    kingdoms.forEach(k => kingdomColorMap.set(k.id, k.accentHex));

    // Remove units that no longer exist in state
    for (const [id, data] of this.unitMeshes.entries()) {
      if (!currentUnitIds.has(id)) {
        this.group.remove(data.meshGroup);
        this.unitMeshes.delete(id);
      }
    }

    // Add or update existing units
    for (const [id, unit] of units.entries()) {
      const tileKey = hexToKey(unit.q, unit.r);
      const tile = tiles.get(tileKey);
      if (!tile) continue;

      const fog = fogMap.get(tileKey) || 'unexplored';
      const isVisible = unit.ownerId === 'player' || fog === 'visible';

      const worldPos = hexToWorld(unit.q, unit.r);
      const groundY = (TERRAIN_DATA[tile.terrain]?.height || 0.2) + 0.6;

      let data = this.unitMeshes.get(id);
      if (!data) {
        // Create new multi-part 3D unit mesh
        const factionColor = kingdomColorMap.get(unit.ownerId) || 0x3b82f6;
        const meshGroup = this.createUnitModel(unit, factionColor);
        meshGroup.position.set(worldPos.x, groundY, worldPos.z);
        this.group.add(meshGroup);

        // Create billboard HP bar
        const hpBarMesh = this.createHpBar();
        meshGroup.add(hpBarMesh);

        data = {
          meshGroup,
          currentPos: new THREE.Vector3(worldPos.x, groundY, worldPos.z),
          targetPos: new THREE.Vector3(worldPos.x, groundY, worldPos.z),
          isMoving: false,
          attackAnimTimer: 0,
          hpBarMesh,
        };
        this.unitMeshes.set(id, data);
      }

      // Check if unit moved to a new tile
      if (Math.abs(data.targetPos.x - worldPos.x) > 0.05 || Math.abs(data.targetPos.z - worldPos.z) > 0.05) {
        data.targetPos.set(worldPos.x, groundY, worldPos.z);
        data.isMoving = true;
      }

      // Update visibility based on Fog of War
      data.meshGroup.visible = isVisible;

      // Update HP bar ratio and scale
      this.updateHpBar(data.hpBarMesh, unit.hp, unit.maxHp, unit.isFortified);
    }
  }

  /**
   * Triggers an attack lunge animation for a unit.
   */
  public triggerAttack(attackerId: string): void {
    const data = this.unitMeshes.get(attackerId);
    if (data) {
      data.attackAnimTimer = 0.35; // 350ms lunge
    }
  }

  /**
   * Per-frame animation tick (movement lerping, idle bobbing, attack lunge).
   */
  public update(delta: number, cameraRotationY: number): void {
    for (const [, data] of this.unitMeshes.entries()) {
      if (!data.meshGroup.visible) continue;

      // Smooth movement interpolation
      if (data.isMoving) {
        data.currentPos.lerp(data.targetPos, Math.min(1.0, delta * 12));
        data.meshGroup.position.copy(data.currentPos);

        // Rotate toward target
        const dir = new THREE.Vector3().subVectors(data.targetPos, data.currentPos);
        if (dir.length() > 0.1) {
          data.meshGroup.rotation.y = Math.atan2(dir.x, dir.z);
        }

        if (data.currentPos.distanceTo(data.targetPos) < 0.05) {
          data.currentPos.copy(data.targetPos);
          data.meshGroup.position.copy(data.currentPos);
          data.isMoving = false;
        }
      }

      // Attack lunge animation
      if (data.attackAnimTimer > 0) {
        data.attackAnimTimer -= delta;
        const progress = Math.sin((1 - data.attackAnimTimer / 0.35) * Math.PI);
        data.meshGroup.position.y = data.currentPos.y + progress * 0.4;
        data.meshGroup.scale.set(1 + progress * 0.25, 1 - progress * 0.15, 1 + progress * 0.25);
      } else {
        // Idle breathing
        const time = performance.now() * 0.003;
        data.meshGroup.position.y = data.currentPos.y + Math.sin(time + data.currentPos.x) * 0.04;
        data.meshGroup.scale.set(1, 1, 1);
      }

      // Billboard HP bar to face camera
      if (data.hpBarMesh) {
        data.hpBarMesh.rotation.y = cameraRotationY;
      }
    }
  }

  /**
   * Creates 3-8 part procedural stylized unit models.
   */
  private createUnitModel(unit: Unit, factionColor: number): THREE.Group {
    const group = new THREE.Group();
    const steelMat = this.getMaterial(0xd1d5db, 0.3, 0.8);
    const goldMat = this.getMaterial(0xf59e0b, 0.25, 0.9);
    const leatherMat = this.getMaterial(0x78350f, 0.85, 0.05);
    const factionMat = this.getMaterial(factionColor, 0.5, 0.2);

    if (unit.type === 'infantry') {
      // 1. Torso / Breastplate
      const torso = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.25), steelMat);
      torso.position.y = 0.5;
      torso.castShadow = true;
      group.add(torso);

      // 2. Faction Tabard over torso
      const tabard = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.46, 0.27), factionMat);
      tabard.position.y = 0.5;
      group.add(tabard);

      // 3. Greathelm with Visor
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 6), steelMat);
      head.position.y = 0.85;
      head.castShadow = true;
      group.add(head);

      // 4. Helm Crest / Plume
      const plume = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.18, 0.25), factionMat);
      plume.position.set(0, 1.05, 0);
      group.add(plume);

      // 5. Heater Shield with Faction Sigil
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.35), factionMat);
      shield.position.set(-0.3, 0.5, 0.08);
      shield.rotation.y = 0.2;
      shield.castShadow = true;
      group.add(shield);

      // Shield rim
      const shieldRim = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.52, 0.04), goldMat);
      shieldRim.position.set(-0.3, 0.5, 0.08);
      group.add(shieldRim);

      // 6. Broadsword
      const sword = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.7, 0.1), steelMat);
      sword.position.set(0.3, 0.55, 0.15);
      sword.rotation.x = 0.3;
      sword.castShadow = true;
      group.add(sword);

      // Crossguard & pommel
      const guard = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.05, 0.22), goldMat);
      guard.position.set(0.3, 0.35, 0.15);
      group.add(guard);
    } else if (unit.type === 'scout') {
      // Light steed runner + rider
      // Mount body
      const mount = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.35, 0.7), leatherMat);
      mount.position.y = 0.4;
      mount.castShadow = true;
      group.add(mount);

      // Mount neck/head
      const mHead = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.4, 0.3), leatherMat);
      mHead.position.set(0, 0.65, 0.35);
      group.add(mHead);

      // Rider
      const rider = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.38, 0.25), factionMat);
      rider.position.set(0, 0.75, -0.05);
      group.add(rider);

      // Rider hood
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.3, 5), leatherMat);
      hood.position.set(0, 1.05, -0.05);
      group.add(hood);

      // Long Spear / Lance
      const spear = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 5), steelMat);
      spear.position.set(0.28, 0.8, 0.15);
      spear.rotation.x = -0.4;
      spear.castShadow = true;
      group.add(spear);

      // Small pennant banner
      const pennant = new THREE.Mesh(new THREE.BufferGeometry(), factionMat);
      const pGeo = new THREE.ConeGeometry(0.15, 0.3, 3);
      pGeo.rotateZ(Math.PI / 2);
      const pMesh = new THREE.Mesh(pGeo, factionMat);
      pMesh.position.set(0.28, 1.25, -0.15);
      group.add(pMesh);
    } else if (unit.type === 'archer') {
      // Body
      const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.5, 6), leatherMat);
      body.position.y = 0.45;
      group.add(body);

      // Hood
      const hood = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.32, 6), factionMat);
      hood.position.y = 0.82;
      group.add(hood);

      // Recurve Bow (torus arc)
      const bowGeo = new THREE.TorusGeometry(0.35, 0.03, 5, 12, Math.PI);
      bowGeo.rotateZ(Math.PI / 2);
      const bow = new THREE.Mesh(bowGeo, leatherMat);
      bow.position.set(0.28, 0.55, 0.1);
      group.add(bow);

      // Quiver with arrows on back
      const quiver = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.4, 5), factionMat);
      quiver.position.set(-0.1, 0.6, -0.18);
      quiver.rotation.z = -0.3;
      group.add(quiver);
    } else if (unit.type === 'cavalry') {
      // Armored Warhorse
      const horse = new THREE.Mesh(new THREE.BoxGeometry(0.48, 0.45, 0.9), leatherMat);
      horse.position.y = 0.45;
      horse.castShadow = true;
      group.add(horse);

      // Horse barding (faction armor)
      const barding = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.35, 0.7), factionMat);
      barding.position.y = 0.45;
      group.add(barding);

      // Knight rider in steel
      const knight = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.45, 0.3), steelMat);
      knight.position.set(0, 0.9, -0.05);
      group.add(knight);

      const knightHelm = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 6), steelMat);
      knightHelm.position.set(0, 1.2, -0.05);
      group.add(knightHelm);

      // Heavy Lance
      const lance = new THREE.Mesh(new THREE.ConeGeometry(0.08, 1.4, 6), steelMat);
      lance.position.set(0.35, 0.9, 0.4);
      lance.rotation.x = Math.PI / 2;
      lance.castShadow = true;
      group.add(lance);
    } else if (unit.type === 'spearman') {
      // Phalanx Spearman
      // 1. Torso / Cuirass
      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 0.45, 6), steelMat);
      torso.position.y = 0.5;
      torso.castShadow = true;
      group.add(torso);

      // 2. Faction Sash
      const sash = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.46, 0.26), factionMat);
      sash.position.y = 0.5;
      group.add(sash);

      // 3. Corinthian / Phalanx Crested Helm
      const helm = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 6), goldMat);
      helm.position.y = 0.85;
      helm.castShadow = true;
      group.add(helm);

      const crest = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.25, 0.3), factionMat);
      crest.position.set(0, 1.05, 0);
      group.add(crest);

      // 4. Large Round Hoplon Shield
      const shieldGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.06, 12);
      shieldGeo.rotateZ(Math.PI / 2);
      const shield = new THREE.Mesh(shieldGeo, factionMat);
      shield.position.set(-0.32, 0.52, 0.05);
      shield.castShadow = true;
      group.add(shield);

      const shieldBoss = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), goldMat);
      shieldBoss.position.set(-0.35, 0.52, 0.05);
      group.add(shieldBoss);

      // 5. Long Thrusting Pike / Spear
      const pike = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 5), leatherMat);
      pike.position.set(0.28, 0.9, 0.1);
      pike.rotation.x = -0.2;
      pike.castShadow = true;
      group.add(pike);

      const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.28, 5), steelMat);
      spearTip.position.set(0.28, 1.7, 0.26);
      spearTip.rotation.x = -0.2;
      spearTip.castShadow = true;
      group.add(spearTip);
    } else if (unit.type === 'settler') {
      // Pioneer Covered Wagon & Settlers
      // 1. Wagon Box
      const wagon = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.22, 0.8), leatherMat);
      wagon.position.y = 0.26;
      wagon.castShadow = true;
      group.add(wagon);

      // 2. White Arched Canvas Canopy
      const canvasMat = this.getMaterial(0xf1f5f9, 0.8, 0.05);
      const canopyGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.75, 8, 1, false, 0, Math.PI);
      canopyGeo.rotateX(Math.PI / 2);
      canopyGeo.rotateZ(Math.PI / 2);
      const canopy = new THREE.Mesh(canopyGeo, canvasMat);
      canopy.position.set(0, 0.42, 0);
      canopy.castShadow = true;
      group.add(canopy);

      // 3. Faction Banner on Wagon Rear
      const flagSpire = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 4), leatherMat);
      flagSpire.position.set(-0.25, 0.65, -0.38);
      group.add(flagSpire);

      const flag = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.18), factionMat);
      flag.position.set(-0.12, 0.88, -0.38);
      group.add(flag);

      // 4. Four Wooden Wagon Wheels
      const wWheelMat = this.getMaterial(0x451a03, 0.9, 0.1);
      const wheelGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.06, 8);
      wheelGeo.rotateZ(Math.PI / 2);
      [
        [-0.32, 0.16, -0.28],
        [0.32, 0.16, -0.28],
        [-0.32, 0.16, 0.28],
        [0.32, 0.16, 0.28],
      ].forEach(([x, y, z]) => {
        const w = new THREE.Mesh(wheelGeo, wWheelMat);
        w.position.set(x, y, z);
        group.add(w);
      });
    } else {
      // Catapult / Trebuchet
      const carriage = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.25, 0.9), leatherMat);
      carriage.position.y = 0.25;
      carriage.castShadow = true;
      group.add(carriage);

      // 4 Wheels
      const wheelMat = this.getMaterial(0x451a03, 0.9, 0.1);
      const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.08, 8);
      wheelGeo.rotateZ(Math.PI / 2);
      [
        [-0.38, 0.18, -0.35],
        [0.38, 0.18, -0.35],
        [-0.38, 0.18, 0.35],
        [0.38, 0.18, 0.35],
      ].forEach(([x, y, z]) => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.position.set(x, y, z);
        group.add(w);
      });

      // Beam arm
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.9, 0.1), leatherMat);
      arm.position.set(0, 0.6, -0.1);
      arm.rotation.x = -0.6;
      group.add(arm);

      // Counterweight bucket (faction colored)
      const bucket = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.3, 0.28), factionMat);
      bucket.position.set(0, 0.4, -0.4);
      group.add(bucket);
    }

    return group;
  }

  private createHpBar(): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 24;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(0, 0, 128, 24);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const planeGeo = new THREE.PlaneGeometry(0.9, 0.16);
    const planeMat = new THREE.MeshBasicMaterial({
      map: texture,
      transparent: true,
      depthTest: false,
    });
    const mesh = new THREE.Mesh(planeGeo, planeMat);
    mesh.position.y = 1.6;
    mesh.renderOrder = 99;
    return mesh;
  }

  private updateHpBar(barMesh: THREE.Mesh, hp: number, maxHp: number, isFortified: boolean) {
    const mat = barMesh.material as THREE.MeshBasicMaterial;
    if (!mat || !mat.map) return;
    const canvas = (mat.map.image as HTMLCanvasElement);
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const ratio = Math.max(0, Math.min(1, hp / maxHp));

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 128, 24);

    // HP Bar Fill (green -> yellow -> red)
    ctx.fillStyle = ratio > 0.5 ? '#22c55e' : ratio > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillRect(2, 2, Math.floor((128 - 4) * ratio), 20);

    // Fortify shield indicator
    if (isFortified) {
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(114, 4, 10, 16);
    }

    mat.map.needsUpdate = true;
  }
}
