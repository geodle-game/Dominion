import * as THREE from 'three';

interface ActiveParticle {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  size: number;
  life: number;
  maxLife: number;
}

export class VfxManager {
  public group: THREE.Group;
  private particles: ActiveParticle[];
  private pointsMesh: THREE.Points;
  private geometry: THREE.BufferGeometry;
  private positions: Float32Array;
  private colors: Float32Array;
  private sizes: Float32Array;
  private readonly maxParticles: number = 300;

  constructor() {
    this.group = new THREE.Group();
    this.particles = [];

    this.positions = new Float32Array(this.maxParticles * 3);
    this.colors = new Float32Array(this.maxParticles * 3);
    this.sizes = new Float32Array(this.maxParticles);

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 3));
    this.geometry.setAttribute('size', new THREE.BufferAttribute(this.sizes, 1));

    const material = new THREE.PointsMaterial({
      size: 0.35,
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
    });

    this.pointsMesh = new THREE.Points(this.geometry, material);
    this.group.add(this.pointsMesh);
  }

  public spawnCombatImpact(x: number, y: number, z: number, colorHex: number = 0xf59e0b): void {
    const burstCount = 18;
    const baseColor = new THREE.Color(colorHex);

    for (let i = 0; i < burstCount; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }

      const angle = Math.random() * Math.PI * 2;
      const elev = Math.random() * Math.PI * 0.5;
      const speed = 2 + Math.random() * 4;

      this.particles.push({
        pos: new THREE.Vector3(x, y + 0.3, z),
        vel: new THREE.Vector3(
          Math.cos(angle) * Math.cos(elev) * speed,
          Math.sin(elev) * speed + 2,
          Math.sin(angle) * Math.cos(elev) * speed
        ),
        color: baseColor.clone(),
        size: 0.2 + Math.random() * 0.3,
        life: 0,
        maxLife: 0.4 + Math.random() * 0.3,
      });
    }
  }

  public spawnVictoryConfetti(centerX: number, centerZ: number): void {
    const colors = [0x3b82f6, 0xf59e0b, 0x10b981, 0xef4444, 0x8b5cf6];
    for (let i = 0; i < 60; i++) {
      if (this.particles.length >= this.maxParticles) {
        this.particles.shift();
      }

      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 6;
      const col = new THREE.Color(colors[Math.floor(Math.random() * colors.length)]);

      this.particles.push({
        pos: new THREE.Vector3(centerX + (Math.random() - 0.5) * 6, 1, centerZ + (Math.random() - 0.5) * 6),
        vel: new THREE.Vector3(
          Math.cos(angle) * speed,
          8 + Math.random() * 6,
          Math.sin(angle) * speed
        ),
        color: col,
        size: 0.35 + Math.random() * 0.2,
        life: 0,
        maxLife: 1.5 + Math.random() * 1.0,
      });
    }
  }

  public update(delta: number): void {
    const gravity = -14;

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += delta;
      if (p.life >= p.maxLife) {
        this.particles.splice(i, 1);
        continue;
      }

      p.vel.y += gravity * delta;
      p.pos.addScaledVector(p.vel, delta);
    }

    // Update buffer attributes
    let activeIdx = 0;
    for (let i = 0; i < this.particles.length; i++) {
      const p = this.particles[i];
      const i3 = activeIdx * 3;

      this.positions[i3] = p.pos.x;
      this.positions[i3 + 1] = p.pos.y;
      this.positions[i3 + 2] = p.pos.z;

      this.colors[i3] = p.color.r;
      this.colors[i3 + 1] = p.color.g;
      this.colors[i3 + 2] = p.color.b;

      const fade = 1 - p.life / p.maxLife;
      this.sizes[activeIdx] = p.size * fade;

      activeIdx++;
    }

    // Zero out unused
    for (let i = activeIdx; i < this.maxParticles; i++) {
      this.sizes[i] = 0;
    }

    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.color.needsUpdate = true;
    this.geometry.attributes.size.needsUpdate = true;
  }
}
