import * as THREE from 'three';

// 刀光轨迹点
interface TrailPoint {
  position: THREE.Vector3;
  time: number;
  velocity: number;
}

// 水果忍者风格刀光效果
export class FruitNinjaSlash {
  private points: TrailPoint[] = [];
  private mesh: THREE.Mesh | null = null;
  private glowMesh: THREE.Mesh | null = null;
  private sparkles: THREE.Points[] = [];
  private maxPoints = 30;
  private trailLifetime = 0.15; // 轨迹存活时间（秒）
  private lastPosition: THREE.Vector3 | null = null;
  private lastTime = 0;
  
  // 刀光颜色配置
  private coreColor = new THREE.Color(0xffffff);
  private glowColor = new THREE.Color(0x00ffff);
  private trailColor = new THREE.Color(0x0088ff);
  
  constructor() {}
  
  addPoint(position: THREE.Vector3, scene: THREE.Scene, currentTime: number) {
    // 计算速度
    let velocity = 0;
    if (this.lastPosition) {
      const delta = position.clone().sub(this.lastPosition);
      const timeDelta = Math.max(currentTime - this.lastTime, 0.001);
      velocity = delta.length() / timeDelta;
    }
    
    this.points.push({
      position: position.clone(),
      time: currentTime,
      velocity: Math.min(velocity, 50), // 限制最大速度
    });
    
    // 限制点数
    while (this.points.length > this.maxPoints) {
      this.points.shift();
    }
    
    this.lastPosition = position.clone();
    this.lastTime = currentTime;
    
    // 更新刀光网格
    this.updateMesh(scene, currentTime);
    
    // 添加火花效果
    if (velocity > 5 && Math.random() > 0.7) {
      this.createSparkle(position, scene);
    }
  }
  
  private updateMesh(scene: THREE.Scene, currentTime: number) {
    // 移除旧的网格
    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
    }
    if (this.glowMesh) {
      scene.remove(this.glowMesh);
      this.glowMesh.geometry.dispose();
      (this.glowMesh.material as THREE.Material).dispose();
    }
    
    // 过滤过期的点
    this.points = this.points.filter(p => currentTime - p.time < this.trailLifetime);
    
    if (this.points.length < 2) return;
    
    // 创建刀光几何体 - 使用三角带
    const vertices: number[] = [];
    const colors: number[] = [];
    const uvs: number[] = [];
    
    for (let i = 0; i < this.points.length; i++) {
      const point = this.points[i];
      const age = currentTime - point.time;
      const lifeRatio = 1 - age / this.trailLifetime;
      
      // 根据速度和生命周期计算宽度
      const baseWidth = 0.15;
      const velocityFactor = Math.min(point.velocity / 20, 1.5);
      const width = baseWidth * lifeRatio * (0.5 + velocityFactor * 0.5);
      
      // 计算法线方向（垂直于轨迹）
      let normal = new THREE.Vector3(0, 1, 0);
      if (i < this.points.length - 1) {
        const next = this.points[i + 1].position;
        const dir = next.clone().sub(point.position).normalize();
        normal = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
      } else if (i > 0) {
        const prev = this.points[i - 1].position;
        const dir = point.position.clone().sub(prev).normalize();
        normal = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
      }
      
      // 添加两个顶点（上下边）
      const top = point.position.clone().add(normal.clone().multiplyScalar(width));
      const bottom = point.position.clone().sub(normal.clone().multiplyScalar(width));
      
      vertices.push(top.x, top.y, top.z);
      vertices.push(bottom.x, bottom.y, bottom.z);
      
      // 颜色渐变 - 从核心白色到外围蓝色，并随时间变暗
      const intensity = lifeRatio * lifeRatio;
      colors.push(intensity, intensity, intensity); // 顶部白色
      colors.push(
        this.trailColor.r * intensity,
        this.trailColor.g * intensity,
        this.trailColor.b * intensity
      ); // 底部蓝色
      
      // UV坐标
      const u = i / (this.points.length - 1);
      uvs.push(u, 0);
      uvs.push(u, 1);
    }
    
    // 创建索引
    const indices: number[] = [];
    for (let i = 0; i < this.points.length - 1; i++) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
    
    // 创建几何体
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    
    // 核心材质
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.9,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.renderOrder = 100;
    scene.add(this.mesh);
    
    // 发光层
    this.createGlowLayer(scene, currentTime);
  }
  
  private createGlowLayer(scene: THREE.Scene, currentTime: number) {
    if (this.points.length < 2) return;
    
    const vertices: number[] = [];
    const colors: number[] = [];
    
    for (let i = 0; i < this.points.length; i++) {
      const point = this.points[i];
      const age = currentTime - point.time;
      const lifeRatio = 1 - age / this.trailLifetime;
      
      // 发光层更宽
      const baseWidth = 0.4;
      const velocityFactor = Math.min(point.velocity / 20, 1.5);
      const width = baseWidth * lifeRatio * (0.5 + velocityFactor * 0.5);
      
      let normal = new THREE.Vector3(0, 1, 0);
      if (i < this.points.length - 1) {
        const next = this.points[i + 1].position;
        const dir = next.clone().sub(point.position).normalize();
        normal = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
      } else if (i > 0) {
        const prev = this.points[i - 1].position;
        const dir = point.position.clone().sub(prev).normalize();
        normal = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
      }
      
      const top = point.position.clone().add(normal.clone().multiplyScalar(width));
      const bottom = point.position.clone().sub(normal.clone().multiplyScalar(width));
      
      vertices.push(top.x, top.y, top.z - 0.1);
      vertices.push(bottom.x, bottom.y, bottom.z - 0.1);
      
      const intensity = lifeRatio * 0.4;
      colors.push(
        this.glowColor.r * intensity,
        this.glowColor.g * intensity,
        this.glowColor.b * intensity
      );
      colors.push(
        this.glowColor.r * intensity,
        this.glowColor.g * intensity,
        this.glowColor.b * intensity
      );
    }
    
    const indices: number[] = [];
    for (let i = 0; i < this.points.length - 1; i++) {
      const base = i * 2;
      indices.push(base, base + 1, base + 2);
      indices.push(base + 1, base + 3, base + 2);
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setIndex(indices);
    
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.5,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
    });
    
    this.glowMesh = new THREE.Mesh(geometry, material);
    this.glowMesh.renderOrder = 99;
    scene.add(this.glowMesh);
  }
  
  private createSparkle(position: THREE.Vector3, scene: THREE.Scene) {
    const count = 5 + Math.floor(Math.random() * 5);
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const velocities: THREE.Vector3[] = [];
    
    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      
      // 随机颜色 - 白色到青色
      const t = Math.random();
      colors[i * 3] = 1;
      colors[i * 3 + 1] = 1;
      colors[i * 3 + 2] = 0.8 + t * 0.2;
      
      velocities.push(new THREE.Vector3(
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 8,
        (Math.random() - 0.5) * 4
      ));
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
      size: 0.08,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });
    
    const points = new THREE.Points(geometry, material);
    (points as any).velocities = velocities;
    (points as any).life = 0.3;
    (points as any).createdAt = performance.now() / 1000;
    
    scene.add(points);
    this.sparkles.push(points);
  }
  
  update(scene: THREE.Scene, deltaTime: number, currentTime: number) {
    // 如果没有新的点添加，更新现有的网格
    if (this.points.length > 0) {
      this.updateMesh(scene, currentTime);
    }
    
    // 更新火花
    this.sparkles = this.sparkles.filter(sparkle => {
      const velocities = (sparkle as any).velocities as THREE.Vector3[];
      const positions = sparkle.geometry.attributes.position.array as Float32Array;
      
      for (let i = 0; i < velocities.length; i++) {
        positions[i * 3] += velocities[i].x * deltaTime;
        positions[i * 3 + 1] += velocities[i].y * deltaTime;
        positions[i * 3 + 2] += velocities[i].z * deltaTime;
        velocities[i].multiplyScalar(0.95);
      }
      
      sparkle.geometry.attributes.position.needsUpdate = true;
      
      (sparkle as any).life -= deltaTime;
      (sparkle.material as THREE.PointsMaterial).opacity = Math.max(0, (sparkle as any).life / 0.3);
      
      if ((sparkle as any).life <= 0) {
        scene.remove(sparkle);
        sparkle.geometry.dispose();
        (sparkle.material as THREE.Material).dispose();
        return false;
      }
      return true;
    });
  }
  
  clear(scene: THREE.Scene) {
    if (this.mesh) {
      scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      (this.mesh.material as THREE.Material).dispose();
      this.mesh = null;
    }
    if (this.glowMesh) {
      scene.remove(this.glowMesh);
      this.glowMesh.geometry.dispose();
      (this.glowMesh.material as THREE.Material).dispose();
      this.glowMesh = null;
    }
    this.sparkles.forEach(s => {
      scene.remove(s);
      s.geometry.dispose();
      (s.material as THREE.Material).dispose();
    });
    this.sparkles = [];
    this.points = [];
    this.lastPosition = null;
  }
  
  // 切割时的爆发效果
  createSlashBurst(position: THREE.Vector3, scene: THREE.Scene, color: THREE.Color) {
    // 创建环形爆发
    const ringCount = 20;
    const positions = new Float32Array(ringCount * 3);
    const colors = new Float32Array(ringCount * 3);
    const velocities: THREE.Vector3[] = [];
    
    for (let i = 0; i < ringCount; i++) {
      const angle = (i / ringCount) * Math.PI * 2;
      positions[i * 3] = position.x;
      positions[i * 3 + 1] = position.y;
      positions[i * 3 + 2] = position.z;
      
      colors[i * 3] = color.r;
      colors[i * 3 + 1] = color.g;
      colors[i * 3 + 2] = color.b;
      
      const speed = 8 + Math.random() * 4;
      velocities.push(new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        (Math.random() - 0.5) * 4
      ));
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    const material = new THREE.PointsMaterial({
      size: 0.15,
      vertexColors: true,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
    });
    
    const points = new THREE.Points(geometry, material);
    (points as any).velocities = velocities;
    (points as any).life = 0.5;
    
    scene.add(points);
    this.sparkles.push(points);
    
    // 添加中心闪光
    this.createCenterFlash(position, scene, color);
  }
  
  private createCenterFlash(position: THREE.Vector3, scene: THREE.Scene, color: THREE.Color) {
    const geometry = new THREE.CircleGeometry(0.3, 16);
    const material = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 1,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    
    const flash = new THREE.Mesh(geometry, material);
    flash.position.copy(position);
    flash.position.z += 0.1;
    (flash as any).life = 0.15;
    (flash as any).isFlash = true;
    
    scene.add(flash);
    
    // 使用 sparkles 数组来管理（虽然不是 Points，但逻辑相似）
    const update = () => {
      (flash as any).life -= 0.016;
      const scale = 1 + (0.15 - (flash as any).life) * 10;
      flash.scale.set(scale, scale, 1);
      material.opacity = Math.max(0, (flash as any).life / 0.15);
      
      if ((flash as any).life <= 0) {
        scene.remove(flash);
        geometry.dispose();
        material.dispose();
      } else {
        requestAnimationFrame(update);
      }
    };
    requestAnimationFrame(update);
  }
  
  getRecentVelocity(): number {
    if (this.points.length < 2) return 0;
    const recent = this.points.slice(-5);
    const avgVelocity = recent.reduce((sum, p) => sum + p.velocity, 0) / recent.length;
    return avgVelocity;
  }
}

