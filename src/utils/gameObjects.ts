import * as THREE from 'three';

// Emoji 纹理生成器
export function createEmojiTexture(emoji: string, size: number = 256): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  
  ctx.clearRect(0, 0, size, size);
  ctx.font = `${size * 0.8}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoji, size / 2, size / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

// 游戏物体类型
export type FruitType = 'watermelon' | 'poop' | 'bomb' | 'earth';

export interface FruitConfig {
  emoji: string;
  score: number;
  color: THREE.Color;
}

export const FRUIT_CONFIGS: Record<FruitType, FruitConfig> = {
  watermelon: { emoji: '🍉', score: 10, color: new THREE.Color(0x00ff00) },
  poop: { emoji: '💩', score: -5, color: new THREE.Color(0x8b4513) },
  bomb: { emoji: '💣', score: -100, color: new THREE.Color(0xff0000) },
  earth: { emoji: '🌍', score: 0, color: new THREE.Color(0x0088ff) },
};

// 游戏物体类
export class Fruit {
  mesh: THREE.Mesh;
  type: FruitType;
  velocity: THREE.Vector3;
  rotationSpeed: THREE.Vector3;
  isSliced: boolean = false;
  slicePieces: THREE.Mesh[] = [];
  boundingRadius: number;
  
  constructor(type: FruitType, position: THREE.Vector3) {
    this.type = type;
    this.velocity = new THREE.Vector3();
    this.rotationSpeed = new THREE.Vector3(
      (Math.random() - 0.5) * 0.1,
      (Math.random() - 0.5) * 0.1,
      (Math.random() - 0.5) * 0.1
    );
    
    const config = FRUIT_CONFIGS[type];
    const texture = createEmojiTexture(config.emoji);
    
    // 创建精灵材质
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
    });
    
    // 使用 Sprite 以确保始终面向摄像机
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(1.5, 1.5, 1);
    sprite.position.copy(position);
    
    // 地球更大一些
    if (type === 'earth') {
      sprite.scale.set(2.5, 2.5, 1);
    }
    
    this.mesh = sprite as unknown as THREE.Mesh;
    this.boundingRadius = type === 'earth' ? 1.2 : 0.7;
  }
  
  update(deltaTime: number, gravity: number = 9.8) {
    if (this.isSliced) {
      // 更新切片碎片
      this.slicePieces.forEach((piece, index) => {
        const direction = index === 0 ? -1 : 1;
        piece.position.x += direction * deltaTime * 3;
        piece.position.y -= deltaTime * gravity * 0.5;
        piece.rotation.z += direction * deltaTime * 5;
        (piece.material as THREE.SpriteMaterial).opacity -= deltaTime * 0.5;
      });
    } else {
      // 应用重力和速度
      this.velocity.y -= gravity * deltaTime;
      this.mesh.position.add(this.velocity.clone().multiplyScalar(deltaTime));
      
      // 旋转
      this.mesh.rotation.x += this.rotationSpeed.x;
      this.mesh.rotation.y += this.rotationSpeed.y;
      this.mesh.rotation.z += this.rotationSpeed.z;
    }
  }
  
  slice(scene: THREE.Scene) {
    if (this.isSliced) return;
    this.isSliced = true;
    
    const config = FRUIT_CONFIGS[this.type];
    const texture = createEmojiTexture(config.emoji, 128);
    
    // 创建两个半边碎片
    for (let i = 0; i < 2; i++) {
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        opacity: 1,
      });
      
      const piece = new THREE.Sprite(material);
      piece.scale.set(0.8, 0.8, 1);
      piece.position.copy(this.mesh.position);
      piece.position.x += (i === 0 ? -0.2 : 0.2);
      
      this.slicePieces.push(piece as unknown as THREE.Mesh);
      scene.add(piece);
    }
    
    // 隐藏原始物体
    this.mesh.visible = false;
  }
  
  isOffScreen(): boolean {
    return this.mesh.position.y < -10 || 
           Math.abs(this.mesh.position.x) > 15 ||
           (this.isSliced && this.slicePieces.every(p => (p.material as THREE.SpriteMaterial).opacity <= 0));
  }
  
  cleanup(scene: THREE.Scene) {
    scene.remove(this.mesh);
    this.slicePieces.forEach(piece => scene.remove(piece));
  }
}

// 刀光轨迹
export class SlashTrail {
  points: THREE.Vector3[] = [];
  line: THREE.Line | null = null;
  material: THREE.LineBasicMaterial;
  maxPoints: number = 20;
  fadeSpeed: number = 0.15;
  
  constructor() {
    this.material = new THREE.LineBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
      linewidth: 3,
    });
  }
  
  addPoint(point: THREE.Vector3, scene: THREE.Scene) {
    this.points.push(point.clone());
    
    if (this.points.length > this.maxPoints) {
      this.points.shift();
    }
    
    this.updateLine(scene);
  }
  
  updateLine(scene: THREE.Scene) {
    if (this.line) {
      scene.remove(this.line);
    }
    
    if (this.points.length < 2) return;
    
    const geometry = new THREE.BufferGeometry().setFromPoints(this.points);
    this.line = new THREE.Line(geometry, this.material);
    scene.add(this.line);
  }
  
  update(scene: THREE.Scene) {
    // 渐隐效果
    if (this.points.length > 0) {
      this.points.shift();
      this.updateLine(scene);
    }
    
    if (this.line) {
      this.material.opacity = Math.max(0, this.material.opacity - this.fadeSpeed * 0.5);
      if (this.material.opacity <= 0) {
        this.clear(scene);
      }
    }
  }
  
  clear(scene: THREE.Scene) {
    if (this.line) {
      scene.remove(this.line);
      this.line = null;
    }
    this.points = [];
    this.material.opacity = 0.8;
  }
  
  resetOpacity() {
    this.material.opacity = 0.8;
  }
}

// 粒子效果
export class ParticleSystem {
  particles: THREE.Points[] = [];
  
  createSliceEffect(position: THREE.Vector3, color: THREE.Color, scene: THREE.Scene) {
    const particleCount = 30;
    const positions = new Float32Array(particleCount * 3);
    const velocities: THREE.Vector3[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 5
      ));
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    const material = new THREE.PointsMaterial({
      color: color,
      size: 0.2,
      transparent: true,
      opacity: 1,
    });
    
    const points = new THREE.Points(geometry, material);
    (points as any).velocities = velocities;
    (points as any).life = 1;
    
    scene.add(points);
    this.particles.push(points);
  }
  
  update(deltaTime: number, scene: THREE.Scene) {
    this.particles = this.particles.filter(points => {
      const velocities = (points as any).velocities as THREE.Vector3[];
      const positions = points.geometry.attributes.position.array as Float32Array;
      
      for (let i = 0; i < velocities.length; i++) {
        positions[i * 3] += velocities[i].x * deltaTime;
        positions[i * 3 + 1] += velocities[i].y * deltaTime - 9.8 * deltaTime * deltaTime;
        positions[i * 3 + 2] += velocities[i].z * deltaTime;
        velocities[i].multiplyScalar(0.98);
      }
      
      points.geometry.attributes.position.needsUpdate = true;
      (points as any).life -= deltaTime;
      (points.material as THREE.PointsMaterial).opacity = (points as any).life;
      
      if ((points as any).life <= 0) {
        scene.remove(points);
        points.geometry.dispose();
        (points.material as THREE.Material).dispose();
        return false;
      }
      return true;
    });
  }
}

// 背景星空
export function createStarfield(scene: THREE.Scene) {
  const starCount = 500;
  const positions = new Float32Array(starCount * 3);
  
  for (let i = 0; i < starCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 100;
    positions[i * 3 + 1] = (Math.random() - 0.5) * 100;
    positions[i * 3 + 2] = -50 + Math.random() * 30;
  }
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  const material = new THREE.PointsMaterial({
    color: 0xffffff,
    size: 0.1,
    transparent: true,
    opacity: 0.8,
  });
  
  const stars = new THREE.Points(geometry, material);
  scene.add(stars);
  return stars;
}

