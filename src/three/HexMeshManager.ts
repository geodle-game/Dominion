import * as THREE from 'three';
import { FogState, HexTile, Kingdom } from '../types/game';
import { TERRAIN_DATA } from '../game/constants';
import { HEX_RADIUS } from '../game/hexUtils';

// Pre-allocated vectors for GC avoidance
const _v1 = new THREE.Vector3();
const _color = new THREE.Color();

export class HexMeshManager {
  public group: THREE.Group;
  public tileMeshes: Map<string, THREE.Group>;
  private hexGeometry: THREE.CylinderGeometry;
  private borderLineGeometry: THREE.BufferGeometry;
  private selectionMesh: THREE.Mesh;
  private hoverMesh: THREE.Mesh;
  private movePathGroup: THREE.Group;
  private attackTargetGroup: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
    this.tileMeshes = new Map();
    this.movePathGroup = new THREE.Group();
    this.attackTargetGroup = new THREE.Group();

    // Pointy-topped hexagon cylinder: 6 segments, rotated by 30 deg (Math.PI / 6)
    this.hexGeometry = new THREE.CylinderGeometry(
      HEX_RADIUS * 0.98,
      HEX_RADIUS * 0.98,
      0.6,
      6,
      1,
      false
    );
    this.hexGeometry.rotateY(Math.PI / 6);

    // Border line outline
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 6; i++) {
      const angle = (Math.PI / 3) * i + Math.PI / 6;
      pts.push(
        new THREE.Vector3(
          Math.cos(angle) * HEX_RADIUS * 0.98,
          0.32,
          Math.sin(angle) * HEX_RADIUS * 0.98
        )
      );
    }
    this.borderLineGeometry = new THREE.BufferGeometry().setFromPoints(pts);

    // Selection ring
    const selectGeo = new THREE.RingGeometry(HEX_RADIUS * 0.88, HEX_RADIUS * 0.97, 6);
    selectGeo.rotateX(-Math.PI / 2);
    selectGeo.rotateY(Math.PI / 6);
    const selectMat = new THREE.MeshBasicMaterial({
      color: 0xffe066,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9,
    });
    this.selectionMesh = new THREE.Mesh(selectGeo, selectMat);
    this.selectionMesh.position.y = 0.35;
    this.selectionMesh.visible = false;
    this.group.add(this.selectionMesh);

    // Hover ring
    const hoverGeo = new THREE.RingGeometry(HEX_RADIUS * 0.92, HEX_RADIUS * 0.97, 6);
    hoverGeo.rotateX(-Math.PI / 2);
    hoverGeo.rotateY(Math.PI / 6);
    const hoverMat = new THREE.MeshBasicMaterial({
      color: 0x93c5fd,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6,
    });
    this.hoverMesh = new THREE.Mesh(hoverGeo, hoverMat);
    this.hoverMesh.position.y = 0.34;
    this.hoverMesh.visible = false;
    this.group.add(this.hoverMesh);

    this.group.add(this.movePathGroup);
    this.group.add(this.attackTargetGroup);
  }

  /**
   * Builds the 3D hex terrain mesh for all tiles in the map.
   */
  public buildMap(tiles: Map<string, HexTile>, kingdoms: Kingdom[]): void {
    // Clear previous
    for (const [, meshGroup] of this.tileMeshes.entries()) {
      this.group.remove(meshGroup);
    }
    this.tileMeshes.clear();

    const kingdomColorMap = new Map<string, number>();
    kingdoms.forEach(k => kingdomColorMap.set(k.id, k.accentHex));

    for (const [key, tile] of tiles.entries()) {
      const tileGroup = new THREE.Group();
      tileGroup.position.set(tile.x, 0, tile.z);
      tileGroup.userData = { tileKey: key, q: tile.q, r: tile.r };

      const tData = TERRAIN_DATA[tile.terrain];

      // 1. Base Hex Tile Mesh
      const mat = new THREE.MeshStandardMaterial({
        color: tData.color,
        roughness: tile.terrain === 'water' ? 0.1 : 0.82,
        metalness: tile.terrain === 'water' ? 0.4 : 0.05,
        flatShading: true,
      });

      const hexMesh = new THREE.Mesh(this.hexGeometry, mat);
      hexMesh.receiveShadow = true;
      hexMesh.castShadow = tile.terrain !== 'water';

      // Height displacement based on terrain
      const scaleY = tile.terrain === 'mountain' ? 1.8 : tile.terrain === 'hills' ? 1.3 : tile.terrain === 'water' ? 0.5 : 1.0;
      hexMesh.scale.set(1, scaleY, 1);
      hexMesh.position.y = (scaleY * 0.6) / 2;
      tileGroup.add(hexMesh);

      // 2. Add procedural terrain props (trees for forest, peaks for mountain, rocks for hills)
      if (tile.terrain === 'forest') {
        this.addForestProps(tileGroup, hexMesh.position.y * 2);
      } else if (tile.terrain === 'mountain') {
        this.addMountainProps(tileGroup, hexMesh.position.y * 2);
      } else if (tile.terrain === 'hills') {
        this.addHillsProps(tileGroup, hexMesh.position.y * 2);
      } else if (tile.terrain === 'river') {
        this.addRiverDecal(tileGroup, hexMesh.position.y * 2);
      }

      // 3. Resource indicator if present
      if (tile.resourceBonus) {
        this.addResourceProp(tileGroup, tile.resourceBonus, hexMesh.position.y * 2);
      }

      // 4. Border outline line
      const borderMat = new THREE.LineBasicMaterial({
        color: 0x334155,
        transparent: true,
        opacity: 0.35,
      });
      const borderLine = new THREE.Line(this.borderLineGeometry, borderMat);
      borderLine.position.y = hexMesh.position.y * 2 + 0.02;
      borderLine.name = 'borderLine';
      tileGroup.add(borderLine);

      // 5. Territory owner glow ring
      const territoryRingGeo = new THREE.RingGeometry(HEX_RADIUS * 0.85, HEX_RADIUS * 0.96, 6);
      territoryRingGeo.rotateX(-Math.PI / 2);
      territoryRingGeo.rotateY(Math.PI / 6);
      const territoryMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.0, // hidden if unowned
        side: THREE.DoubleSide,
      });
      const territoryRing = new THREE.Mesh(territoryRingGeo, territoryMat);
      territoryRing.position.y = hexMesh.position.y * 2 + 0.03;
      territoryRing.name = 'territoryRing';
      tileGroup.add(territoryRing);

      this.group.add(tileGroup);
      this.tileMeshes.set(key, tileGroup);
    }
  }

  /**
   * Adds multi-part low poly trees (trunk + layered foliage cones)
   */
  private addForestProps(parent: THREE.Group, baseY: number) {
    const treeCount = 4 + Math.floor(Math.random() * 3);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5a3e28, roughness: 0.9 });
    const leafColors = [0x225e2a, 0x1b4d22, 0x2e7d32, 0x1e6826];

    for (let i = 0; i < treeCount; i++) {
      const angle = (i / treeCount) * Math.PI * 2 + Math.random() * 0.5;
      const dist = (0.2 + Math.random() * 0.55) * HEX_RADIUS;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      const scale = 0.7 + Math.random() * 0.5;

      const tree = new THREE.Group();
      tree.position.set(x, baseY, z);
      tree.scale.set(scale, scale, scale);

      // Trunk
      const trunkGeo = new THREE.CylinderGeometry(0.08, 0.12, 0.5, 5);
      const trunk = new THREE.Mesh(trunkGeo, trunkMat);
      trunk.position.y = 0.25;
      trunk.castShadow = true;
      tree.add(trunk);

      // Foliage cones (pine / spruce style)
      const foliageMat = new THREE.MeshStandardMaterial({
        color: leafColors[Math.floor(Math.random() * leafColors.length)],
        roughness: 0.8,
        flatShading: true,
      });

      const cone1 = new THREE.Mesh(new THREE.ConeGeometry(0.45, 0.65, 5), foliageMat);
      cone1.position.y = 0.6;
      cone1.castShadow = true;
      tree.add(cone1);

      const cone2 = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.55, 5), foliageMat);
      cone2.position.y = 0.95;
      cone2.castShadow = true;
      tree.add(cone2);

      parent.add(tree);
    }
  }

  /**
   * Adds multi-peak mountain meshes with snowcaps
   */
  private addMountainProps(parent: THREE.Group, baseY: number) {
    const peakGeo = new THREE.ConeGeometry(0.8, 1.6, 6);
    peakGeo.rotateY(Math.PI / 6);
    const mountainMat = new THREE.MeshStandardMaterial({
      color: 0x5a5f6e,
      roughness: 0.9,
      flatShading: true,
    });
    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xf1f5f9,
      roughness: 0.4,
      flatShading: true,
    });

    // Central high peak
    const mainPeak = new THREE.Mesh(peakGeo, mountainMat);
    mainPeak.position.set(0, baseY + 0.8, 0);
    mainPeak.castShadow = true;
    parent.add(mainPeak);

    // Snowcap on top
    const snowCap = new THREE.Mesh(new THREE.ConeGeometry(0.38, 0.65, 6), snowMat);
    snowCap.position.set(0, baseY + 1.35, 0);
    snowCap.castShadow = true;
    parent.add(snowCap);

    // Secondary smaller peak
    const sidePeak = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.1, 5), mountainMat);
    sidePeak.position.set(0.65, baseY + 0.55, -0.4);
    sidePeak.castShadow = true;
    parent.add(sidePeak);
  }

  /**
   * Adds rolling hill knolls and rock boulders
   */
  private addHillsProps(parent: THREE.Group, baseY: number) {
    const hillMat = new THREE.MeshStandardMaterial({
      color: 0x8a724b,
      roughness: 0.85,
      flatShading: true,
    });
    const rockMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.9,
      flatShading: true,
    });

    const knoll1 = new THREE.Mesh(new THREE.SphereGeometry(0.65, 6, 5), hillMat);
    knoll1.scale.set(1.2, 0.6, 1.1);
    knoll1.position.set(-0.3, baseY + 0.1, 0.2);
    knoll1.castShadow = true;
    parent.add(knoll1);

    const knoll2 = new THREE.Mesh(new THREE.SphereGeometry(0.5, 6, 5), hillMat);
    knoll2.scale.set(1.0, 0.55, 0.9);
    knoll2.position.set(0.4, baseY + 0.08, -0.3);
    knoll2.castShadow = true;
    parent.add(knoll2);

    // Boulder
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.25, 0), rockMat);
    rock.position.set(0.2, baseY + 0.2, 0.4);
    rock.castShadow = true;
    parent.add(rock);
  }

  /**
   * Adds procedural river water stream ribbon across tile
   */
  private addRiverDecal(parent: THREE.Group, baseY: number) {
    const riverMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      roughness: 0.15,
      metalness: 0.3,
      transparent: true,
      opacity: 0.85,
    });
    const riverPlane = new THREE.Mesh(new THREE.PlaneGeometry(HEX_RADIUS * 1.5, 0.5, 6, 1), riverMat);
    riverPlane.rotation.x = -Math.PI / 2;
    riverPlane.rotation.z = Math.PI / 4;
    riverPlane.position.y = baseY + 0.01;
    parent.add(riverPlane);
  }

  /**
   * Adds visual resource indicator (wheat sheaf, ore deposit, timber pile)
   */
  private addResourceProp(parent: THREE.Group, bonus: HexTile['resourceBonus'], baseY: number) {
    const propGroup = new THREE.Group();
    propGroup.position.set(-0.55, baseY + 0.1, -0.55);

    if (bonus === 'wheat') {
      const wheatMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.7 });
      for (let i = 0; i < 3; i++) {
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 4), wheatMat);
        stalk.position.set(i * 0.1 - 0.1, 0.2, 0);
        stalk.rotation.z = (i - 1) * 0.2;
        propGroup.add(stalk);
      }
    } else if (bonus === 'gold_ore' || bonus === 'iron_ore') {
      const oreColor = bonus === 'gold_ore' ? 0xf59e0b : 0x94a3b8;
      const oreMat = new THREE.MeshStandardMaterial({ color: oreColor, metalness: 0.8, roughness: 0.25 });
      const nugget = new THREE.Mesh(new THREE.DodecahedronGeometry(0.2, 0), oreMat);
      nugget.position.y = 0.15;
      propGroup.add(nugget);
    } else if (bonus === 'timber') {
      const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.9 });
      for (let i = 0; i < 2; i++) {
        const log = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.45, 5), woodMat);
        log.rotation.z = Math.PI / 2;
        log.position.set(0, 0.07 + i * 0.1, (i - 0.5) * 0.1);
        propGroup.add(log);
      }
    }

    parent.add(propGroup);
  }

  /**
   * Updates Fog of War visualization and territory coloring.
   */
  public updateVisualState(
    tiles: Map<string, HexTile>,
    fogMap: Map<string, FogState>,
    kingdoms: Kingdom[]
  ): void {
    const kingdomColorMap = new Map<string, number>();
    kingdoms.forEach(k => kingdomColorMap.set(k.id, k.accentHex));

    for (const [key, tileGroup] of this.tileMeshes.entries()) {
      const tile = tiles.get(key);
      const fog = fogMap.get(key) || 'unexplored';
      if (!tile) continue;

      // Update visibility of the entire tileGroup or darken meshes
      tileGroup.traverse(child => {
        if (child instanceof THREE.Mesh && child.material instanceof THREE.MeshStandardMaterial) {
          const origColor = TERRAIN_DATA[tile.terrain].color;

          if (fog === 'unexplored') {
            child.material.color.setHex(0x0a0f1d); // deeply shrouded in fog
            child.visible = true; // still rendered as dark shroud
          } else if (fog === 'explored') {
            // Explored but not in direct line of sight: darkened desaturated
            _color.setHex(origColor);
            _color.lerp(new THREE.Color(0x1e293b), 0.6);
            child.material.color.copy(_color);
            child.visible = true;
          } else {
            // Fully visible
            child.material.color.setHex(origColor);
            child.visible = true;
          }
        }
      });

      // Update territory ring
      const territoryRing = tileGroup.getObjectByName('territoryRing') as THREE.Mesh;
      if (territoryRing && territoryRing.material instanceof THREE.MeshBasicMaterial) {
        if (tile.ownerId && fog !== 'unexplored') {
          const ownerColor = kingdomColorMap.get(tile.ownerId) || 0x64748b;
          territoryRing.material.color.setHex(ownerColor);
          territoryRing.material.opacity = fog === 'visible' ? 0.65 : 0.35;
        } else {
          territoryRing.material.opacity = 0;
        }
      }
    }
  }

  public setSelection(tile: HexTile | null): void {
    if (!tile) {
      this.selectionMesh.visible = false;
      return;
    }
    const tData = TERRAIN_DATA[tile.terrain];
    this.selectionMesh.position.set(tile.x, tData.height + 0.62, tile.z);
    this.selectionMesh.visible = true;
  }

  public setHover(tile: HexTile | null): void {
    if (!tile) {
      this.hoverMesh.visible = false;
      return;
    }
    const tData = TERRAIN_DATA[tile.terrain];
    this.hoverMesh.position.set(tile.x, tData.height + 0.61, tile.z);
    this.hoverMesh.visible = true;
  }

  /**
   * Highlights reachable tiles and attack targets for selected unit.
   */
  public showReachableAndTargets(
    reachableTiles: Map<string, number>,
    attackTargets: HexTile[],
    tilesMap: Map<string, HexTile>
  ): void {
    // Clear previous
    while (this.movePathGroup.children.length > 0) {
      this.movePathGroup.remove(this.movePathGroup.children[0]);
    }
    while (this.attackTargetGroup.children.length > 0) {
      this.attackTargetGroup.remove(this.attackTargetGroup.children[0]);
    }

    // Move rings (emerald green glow)
    const moveRingGeo = new THREE.RingGeometry(HEX_RADIUS * 0.75, HEX_RADIUS * 0.92, 6);
    moveRingGeo.rotateX(-Math.PI / 2);
    moveRingGeo.rotateY(Math.PI / 6);
    const moveMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
    });

    for (const [key] of reachableTiles.entries()) {
      const tile = tilesMap.get(key);
      if (!tile) continue;
      const tData = TERRAIN_DATA[tile.terrain];
      const ring = new THREE.Mesh(moveRingGeo, moveMat);
      ring.position.set(tile.x, tData.height + 0.63, tile.z);
      this.movePathGroup.add(ring);
    }

    // Attack rings (pulsing red glow)
    const attackRingGeo = new THREE.RingGeometry(HEX_RADIUS * 0.72, HEX_RADIUS * 0.95, 6);
    attackRingGeo.rotateX(-Math.PI / 2);
    attackRingGeo.rotateY(Math.PI / 6);
    const attackMat = new THREE.MeshBasicMaterial({
      color: 0xef4444,
      transparent: true,
      opacity: 0.8,
      side: THREE.DoubleSide,
    });

    for (const tile of attackTargets) {
      const tData = TERRAIN_DATA[tile.terrain];
      const ring = new THREE.Mesh(attackRingGeo, attackMat);
      ring.position.set(tile.x, tData.height + 0.64, tile.z);
      this.attackTargetGroup.add(ring);
    }
  }

  public clearHighlights(): void {
    while (this.movePathGroup.children.length > 0) {
      this.movePathGroup.remove(this.movePathGroup.children[0]);
    }
    while (this.attackTargetGroup.children.length > 0) {
      this.attackTargetGroup.remove(this.attackTargetGroup.children[0]);
    }
  }
}
