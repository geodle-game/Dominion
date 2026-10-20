import * as THREE from 'three';
import { hexToWorld } from '../game/hexUtils';

export class CameraController {
  public camera: THREE.PerspectiveCamera;
  public target: THREE.Vector3;
  private currentTarget: THREE.Vector3;

  private distance: number = 26;
  private currentDistance: number = 26;
  private readonly minDistance: number = 10;
  private readonly maxDistance: number = 55;

  private angleY: number = -Math.PI / 4;
  private currentAngleY: number = -Math.PI / 4;
  private readonly pitch: number = 0.95; // ~54 degrees from vertical

  private keysHeld: Set<string> = new Set();
  private isDragging: boolean = false;
  private lastMouseX: number = 0;
  private lastMouseY: number = 0;

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.camera = camera;
    this.target = new THREE.Vector3(0, 0, 0);
    this.currentTarget = new THREE.Vector3(0, 0, 0);

    this.setupInputs(domElement);
    this.updateCameraInstant();
  }

  private setupInputs(domElement: HTMLElement): void {
    window.addEventListener('keydown', (e) => {
      // Don't capture inputs if active in an input field
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      this.keysHeld.add(e.code);

      if (e.code === 'KeyQ') {
        this.angleY += Math.PI / 6;
      } else if (e.code === 'KeyE') {
        this.angleY -= Math.PI / 6;
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keysHeld.delete(e.code);
    });

    window.addEventListener('blur', () => {
      this.keysHeld.clear();
      this.isDragging = false;
    });

    domElement.addEventListener('pointerdown', (e) => {
      // Right click or middle click for panning
      if (e.button === 2 || e.button === 1) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
      }
    });

    window.addEventListener('pointermove', (e) => {
      if (this.isDragging) {
        const dx = e.clientX - this.lastMouseX;
        const dy = e.clientY - this.lastMouseY;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;

        const panSpeed = 0.035 * (this.currentDistance / 24);
        const forward = new THREE.Vector3(-Math.sin(this.currentAngleY), 0, -Math.cos(this.currentAngleY));
        const right = new THREE.Vector3(Math.cos(this.currentAngleY), 0, -Math.sin(this.currentAngleY));

        this.target.addScaledVector(right, -dx * panSpeed);
        this.target.addScaledVector(forward, dy * panSpeed);
      }
    });

    window.addEventListener('pointerup', () => {
      this.isDragging = false;
    });

    domElement.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const zoomDelta = e.deltaY * 0.03;
        this.distance = THREE.MathUtils.clamp(
          this.distance + zoomDelta,
          this.minDistance,
          this.maxDistance
        );
      },
      { passive: false }
    );
  }

  public focusOnTile(q: number, r: number): void {
    const worldPos = hexToWorld(q, r);
    this.target.set(worldPos.x, 0, worldPos.z);
  }

  public zoomIn(): void {
    this.distance = Math.max(this.minDistance, this.distance - 5);
  }

  public zoomOut(): void {
    this.distance = Math.min(this.maxDistance, this.distance + 5);
  }

  public rotateLeft(): void {
    this.angleY += Math.PI / 4;
  }

  public rotateRight(): void {
    this.angleY -= Math.PI / 4;
  }

  public update(delta: number): void {
    // Continuous keyboard panning
    const panSpeed = 16 * (this.currentDistance / 24) * delta;
    const forward = new THREE.Vector3(-Math.sin(this.currentAngleY), 0, -Math.cos(this.currentAngleY));
    const right = new THREE.Vector3(Math.cos(this.currentAngleY), 0, -Math.sin(this.currentAngleY));

    if (this.keysHeld.has('KeyW') || this.keysHeld.has('ArrowUp')) {
      this.target.addScaledVector(forward, panSpeed);
    }
    if (this.keysHeld.has('KeyS') || this.keysHeld.has('ArrowDown')) {
      this.target.addScaledVector(forward, -panSpeed);
    }
    if (this.keysHeld.has('KeyA') || this.keysHeld.has('ArrowLeft')) {
      this.target.addScaledVector(right, -panSpeed);
    }
    if (this.keysHeld.has('KeyD') || this.keysHeld.has('ArrowRight')) {
      this.target.addScaledVector(right, panSpeed);
    }

    // Clamp map target boundaries
    this.target.x = THREE.MathUtils.clamp(this.target.x, -50, 50);
    this.target.z = THREE.MathUtils.clamp(this.target.z, -50, 50);

    // Smooth exponential damping
    this.currentTarget.x = THREE.MathUtils.damp(this.currentTarget.x, this.target.x, 8, delta);
    this.currentTarget.z = THREE.MathUtils.damp(this.currentTarget.z, this.target.z, 8, delta);
    this.currentDistance = THREE.MathUtils.damp(this.currentDistance, this.distance, 8, delta);
    this.currentAngleY = THREE.MathUtils.damp(this.currentAngleY, this.angleY, 8, delta);

    // Position camera using spherical coordinates
    const sinPitch = Math.sin(this.pitch);
    const cosPitch = Math.cos(this.pitch);

    const camX = this.currentTarget.x + this.currentDistance * sinPitch * Math.sin(this.currentAngleY);
    const camY = this.currentTarget.y + this.currentDistance * cosPitch;
    const camZ = this.currentTarget.z + this.currentDistance * sinPitch * Math.cos(this.currentAngleY);

    this.camera.position.set(camX, camY, camZ);
    this.camera.lookAt(this.currentTarget);
  }

  private updateCameraInstant(): void {
    this.currentTarget.copy(this.target);
    this.currentDistance = this.distance;
    this.currentAngleY = this.angleY;

    const sinPitch = Math.sin(this.pitch);
    const cosPitch = Math.cos(this.pitch);

    this.camera.position.set(
      this.currentTarget.x + this.currentDistance * sinPitch * Math.sin(this.currentAngleY),
      this.currentTarget.y + this.currentDistance * cosPitch,
      this.currentTarget.z + this.currentDistance * sinPitch * Math.cos(this.currentAngleY)
    );
    this.camera.lookAt(this.currentTarget);
  }

  public getAngleY(): number {
    return this.currentAngleY;
  }
}
