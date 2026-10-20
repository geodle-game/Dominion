import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { CameraController } from './CameraController';
import { CityMeshManager } from './CityMeshManager';
import { HexMeshManager } from './HexMeshManager';
import { UnitMeshManager } from './UnitMeshManager';
import { VfxManager } from './VfxManager';
import { HEX_RADIUS, worldToHex } from '../game/hexUtils';

export interface SceneCallbacks {
  onTileClick: (q: number, r: number) => void;
  onTileHover?: (q: number, r: number) => void;
}

export class ThreeScene {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public cameraController: CameraController;

  public hexManager: HexMeshManager;
  public unitManager: UnitMeshManager;
  public cityManager: CityMeshManager;
  public vfxManager: VfxManager;

  private raycaster: THREE.Raycaster;
  private pointer: THREE.Vector2;
  private animFrameId: number | null = null;
  private lastTime: number = performance.now();
  private callbacks: SceneCallbacks;
  private container: HTMLElement;
  private isDestroyed: boolean = false;

  private hoveredKey: string | null = null;

  constructor(container: HTMLElement, callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;

    // 1. Scene & Horizon Fog
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0a0f1d);
    this.scene.fog = new THREE.FogExp2(0x0a0f1d, 0.016);

    // 2. Camera
    const aspect = container.clientWidth / container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.5, 200);

    // 3. Renderer with Studio Standards
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 4. Studio Environment Reflection (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    const envTexture = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environment = envTexture;
    pmremGenerator.dispose();

    // 5. 3-Point Studio Lighting Rig
    this.setupLighting();

    // 6. Camera Controller
    this.cameraController = new CameraController(this.camera, this.renderer.domElement);

    // 7. Managers
    this.hexManager = new HexMeshManager();
    this.unitManager = new UnitMeshManager();
    this.cityManager = new CityMeshManager();
    this.vfxManager = new VfxManager();

    this.scene.add(this.hexManager.group);
    this.scene.add(this.unitManager.group);
    this.scene.add(this.cityManager.group);
    this.scene.add(this.vfxManager.group);

    // 8. Raycasting & Pointer Events
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(-999, -999);

    this.setupPointerEvents();
    window.addEventListener('resize', this.onResize);

    // 9. Start Render Loop
    this.animate();
  }

  private setupLighting(): void {
    // Warm Key Directional Light
    const keyLight = new THREE.DirectionalLight(0xfff7ed, 2.2);
    keyLight.position.set(25, 45, 20);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 120;
    const d = 35;
    keyLight.shadow.camera.left = -d;
    keyLight.shadow.camera.right = d;
    keyLight.shadow.camera.top = d;
    keyLight.shadow.camera.bottom = -d;
    keyLight.shadow.bias = -0.0004;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    // Cool Hemisphere Fill Light
    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x1e293b, 1.1);
    this.scene.add(hemiLight);

    // Subtle Cyan/Gold Rim Light
    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.8);
    rimLight.position.set(-30, 20, -30);
    this.scene.add(rimLight);
  }

  private setupPointerEvents(): void {
    const el = this.renderer.domElement;

    let downPos = { x: 0, y: 0 };
    el.addEventListener('pointerdown', (e) => {
      downPos = { x: e.clientX, y: e.clientY };
    });

    el.addEventListener('pointerup', (e) => {
      // Trigger click if not dragging camera (allow 14px threshold for natural mouse/touchpad clicks)
      const dist = Math.hypot(e.clientX - downPos.x, e.clientY - downPos.y);
      if (dist < 14 && e.button === 0) {
        this.handleClick(e.clientX, e.clientY);
      }
    });

    el.addEventListener('pointermove', (e) => {
      const rect = el.getBoundingClientRect();
      this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    });
  }

  private handleClick(clientX: number, clientY: number): void {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );

    this.raycaster.setFromCamera(mouse, this.camera);

    // Raycast against Units, Cities, and Hex Terrain (including move & attack indicator overlays)
    const interactiveGroups = [
      this.unitManager.group,
      this.cityManager.group,
      this.hexManager.group,
    ];
    const intersects = this.raycaster.intersectObjects(interactiveGroups, true);

    for (const hit of intersects) {
      let curr: THREE.Object3D | null = hit.object;
      while (curr && curr.parent) {
        if (curr.userData && curr.userData.tileKey !== undefined && curr.userData.q !== undefined && curr.userData.r !== undefined) {
          const { q, r } = curr.userData;
          this.callbacks.onTileClick(q, r);
          return;
        }
        curr = curr.parent;
      }
    }

    // Mathematical ground plane fallback if clicked slightly between hex edges
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const target = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(plane, target)) {
      const hex = worldToHex(target.x, target.z);
      this.callbacks.onTileClick(hex.q, hex.r);
    }
  }

  private onResize = (): void => {
    if (!this.container || this.isDestroyed) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  };

  private animate = (): void => {
    if (this.isDestroyed) return;

    this.animFrameId = requestAnimationFrame(this.animate);
    const now = performance.now();
    const rawDelta = (now - this.lastTime) / 1000;
    this.lastTime = now;
    const delta = Math.min(rawDelta, 0.05);

    // Update camera
    this.cameraController.update(delta);
    const camAngleY = this.cameraController.getAngleY();

    // Update unit animations
    this.unitManager.update(delta, camAngleY);
    this.cityManager.update(delta, camAngleY);
    this.vfxManager.update(delta);

    // Hover raycast
    if (this.pointer.x > -2 && this.pointer.y > -2) {
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const interactiveGroups = [
        this.unitManager.group,
        this.cityManager.group,
        this.hexManager.group,
      ];
      const intersects = this.raycaster.intersectObjects(interactiveGroups, true);
      let hitKey: string | null = null;
      let hitQ: number = 0;
      let hitR: number = 0;

      for (const hit of intersects) {
        let curr: THREE.Object3D | null = hit.object;
        while (curr && curr.parent) {
          if (curr.userData && curr.userData.tileKey !== undefined && curr.userData.q !== undefined && curr.userData.r !== undefined) {
            hitKey = curr.userData.tileKey;
            hitQ = curr.userData.q;
            hitR = curr.userData.r;
            break;
          }
          curr = curr.parent;
        }
        if (hitKey) break;
      }

      if (this.container) {
        this.container.style.cursor = hitKey ? 'pointer' : 'default';
      }

      if (hitKey !== this.hoveredKey) {
        this.hoveredKey = hitKey;
        if (this.callbacks.onTileHover) {
          if (hitKey) {
            this.callbacks.onTileHover(hitQ, hitR);
          } else {
            this.callbacks.onTileHover(-999, -999);
          }
        }
      }
    }

    this.renderer.render(this.scene, this.camera);
  };

  public destroy(): void {
    this.isDestroyed = true;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
    }
    window.removeEventListener('resize', this.onResize);
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement) {
      this.renderer.domElement.parentElement.removeChild(this.renderer.domElement);
    }
  }
}
