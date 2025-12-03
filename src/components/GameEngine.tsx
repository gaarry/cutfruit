import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { Fruit, FruitType, ParticleSystem, createStarfield, FRUIT_CONFIGS } from '../utils/gameObjects';
import { FruitNinjaSlash } from '../utils/slashEffect';
import { audioSystem } from '../utils/audioSystem';

interface GameEngineProps {
  fingerPosition: { x: number; y: number } | null;
  isTracking: boolean;
  fingerVelocity: number;
  gameState: 'waiting' | 'playing' | 'gameover';
  onGameStart: () => void;
  onScoreChange: (score: number) => void;
  onComboChange: (combo: number) => void;
  onLivesChange: (lives: number) => void;
  onGameOver: () => void;
}

export function GameEngine({
  fingerPosition,
  isTracking,
  fingerVelocity,
  gameState,
  onGameStart,
  onScoreChange,
  onComboChange,
  onLivesChange,
  onGameOver,
}: GameEngineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const fruitsRef = useRef<Fruit[]>([]);
  const slashEffectRef = useRef<FruitNinjaSlash | null>(null);
  const particleSystemRef = useRef<ParticleSystem | null>(null);
  const lastFingerPosRef = useRef<THREE.Vector3 | null>(null);
  const earthRef = useRef<Fruit | null>(null);
  const animationFrameRef = useRef<number>(0);
  const lastTimeRef = useRef<number>(0);
  const spawnTimerRef = useRef<number>(0);
  const comboTimerRef = useRef<number>(0);
  const [currentCombo, setCurrentCombo] = useState(0);
  const scoreRef = useRef<number>(0);
  const livesRef = useRef<number>(3);
  const gameStateRef = useRef(gameState);
  const difficultyRef = useRef(1);
  const gameTimeRef = useRef(0);

  useEffect(() => {
    gameStateRef.current = gameState;
    if (gameState === 'playing') {
      gameTimeRef.current = 0;
      difficultyRef.current = 1;
    }
  }, [gameState]);

  const screenToWorld = useCallback((x: number, y: number): THREE.Vector3 => {
    const camera = cameraRef.current;
    if (!camera) return new THREE.Vector3();

    const ndcX = x * 2 - 1;
    const ndcY = -(y * 2 - 1);

    const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
    vector.unproject(camera);
    
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    const worldPos = camera.position.clone().add(dir.multiplyScalar(distance));
    
    return worldPos;
  }, []);

  const spawnFruit = useCallback((type?: FruitType) => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (!type) {
      const rand = Math.random();
      const bombChance = 0.1 + difficultyRef.current * 0.02;
      const poopChance = 0.2;
      
      if (rand < 0.7 - bombChance) type = 'watermelon';
      else if (rand < 0.7 - bombChance + poopChance) type = 'poop';
      else type = 'bomb';
    }

    const x = (Math.random() - 0.5) * 14;
    const position = new THREE.Vector3(x, -9, 0);
    
    const fruit = new Fruit(type, position);
    
    // 根据难度调整速度
    const speedMultiplier = 1 + difficultyRef.current * 0.1;
    const targetX = (Math.random() - 0.5) * 8;
    const targetY = 2 + Math.random() * 4;
    
    fruit.velocity.set(
      (targetX - x) * 0.4 * speedMultiplier,
      (14 + Math.random() * 6) * speedMultiplier,
      0
    );
    
    fruitsRef.current.push(fruit);
    scene.add(fruit.mesh);
  }, []);

  const spawnEarth = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene || earthRef.current) return;

    const earth = new Fruit('earth', new THREE.Vector3(0, 0, 0));
    earth.rotationSpeed.set(0, 0.02, 0);
    
    earthRef.current = earth;
    scene.add(earth.mesh);
  }, []);

  const checkSlice = useCallback((currentPos: THREE.Vector3, velocity: number) => {
    const lastPos = lastFingerPosRef.current;
    if (!lastPos) return;

    const scene = sceneRef.current;
    if (!scene) return;

    // 计算滑动距离和速度
    const swipeDistance = currentPos.distanceTo(lastPos);
    const slashVelocity = slashEffectRef.current?.getRecentVelocity() || velocity;
    
    // 速度阈值 - 需要足够快的划动才能切割
    const minSliceVelocity = 3;
    const isSlicing = swipeDistance > 0.2 && slashVelocity > minSliceVelocity;
    
    if (!isSlicing) return;

    // 检测地球
    if (gameStateRef.current === 'waiting' && earthRef.current && !earthRef.current.isSliced) {
      const earthDist = currentPos.distanceTo(earthRef.current.mesh.position);
      if (earthDist < earthRef.current.boundingRadius + 0.5) {
        earthRef.current.slice(scene);
        slashEffectRef.current?.createSlashBurst(
          earthRef.current.mesh.position,
          scene,
          new THREE.Color(0x00aaff)
        );
        audioSystem.playStartSound();
        setTimeout(() => {
          if (earthRef.current) {
            earthRef.current.cleanup(scene);
            earthRef.current = null;
          }
        }, 500);
        onGameStart();
        return;
      }
    }

    // 游戏进行中检测水果
    if (gameStateRef.current === 'playing') {
      let slicedCount = 0;
      
      fruitsRef.current.forEach(fruit => {
        if (fruit.isSliced) return;
        
        // 使用线段与球体相交检测
        const dist = currentPos.distanceTo(fruit.mesh.position);
        const lineToFruit = fruit.mesh.position.clone().sub(lastPos);
        const lineDir = currentPos.clone().sub(lastPos).normalize();
        const projection = lineToFruit.dot(lineDir);
        const closestPoint = lastPos.clone().add(lineDir.multiplyScalar(Math.max(0, Math.min(projection, swipeDistance))));
        const closestDist = closestPoint.distanceTo(fruit.mesh.position);
        
        const hitRadius = fruit.boundingRadius + 0.4;
        
        if (closestDist < hitRadius || dist < hitRadius) {
          fruit.slice(scene);
          slicedCount++;
          
          const config = FRUIT_CONFIGS[fruit.type];
          
          // 刀光爆发效果
          slashEffectRef.current?.createSlashBurst(
            fruit.mesh.position,
            scene,
            config.color
          );
          
          // 粒子效果
          particleSystemRef.current?.createSliceEffect(
            fruit.mesh.position,
            config.color,
            scene
          );
          
          switch (fruit.type) {
            case 'watermelon':
              audioSystem.playWatermelonSlice();
              scoreRef.current += config.score;
              setCurrentCombo(prev => {
                const newCombo = prev + 1;
                comboTimerRef.current = 2;
                onComboChange(newCombo);
                if (newCombo > 1) {
                  audioSystem.playComboSound(newCombo);
                  scoreRef.current += newCombo * 5;
                }
                return newCombo;
              });
              break;
              
            case 'poop':
              audioSystem.playPoopSlice();
              scoreRef.current += config.score;
              setCurrentCombo(0);
              onComboChange(0);
              break;
              
            case 'bomb':
              audioSystem.playBombExplosion();
              livesRef.current -= 1;
              onLivesChange(livesRef.current);
              setCurrentCombo(0);
              onComboChange(0);
              
              // 屏幕震动效果
              if (cameraRef.current) {
                const originalPos = cameraRef.current.position.clone();
                let shakeTime = 0;
                const shake = () => {
                  shakeTime += 16;
                  if (shakeTime < 300 && cameraRef.current) {
                    cameraRef.current.position.x = originalPos.x + (Math.random() - 0.5) * 0.3;
                    cameraRef.current.position.y = originalPos.y + (Math.random() - 0.5) * 0.3;
                    requestAnimationFrame(shake);
                  } else if (cameraRef.current) {
                    cameraRef.current.position.copy(originalPos);
                  }
                };
                shake();
              }
              
              if (livesRef.current <= 0) {
                audioSystem.playGameOverSound();
                onGameOver();
              }
              break;
          }
          
          onScoreChange(Math.max(0, scoreRef.current));
        }
      });
      
      if (slicedCount > 0) {
        audioSystem.playSwipeSound();
        
        // 多重切割加分
        if (slicedCount >= 3) {
          scoreRef.current += slicedCount * 10;
          onScoreChange(scoreRef.current);
        }
      }
    }
  }, [onGameStart, onScoreChange, onComboChange, onLivesChange, onGameOver]);

  // 初始化 Three.js 场景
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 10;
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ 
      antialias: true,
      alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.sortObjects = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    // 点光源
    const pointLight1 = new THREE.PointLight(0x00ffff, 1, 100);
    pointLight1.position.set(10, 10, 10);
    scene.add(pointLight1);

    const pointLight2 = new THREE.PointLight(0xff00ff, 0.5, 100);
    pointLight2.position.set(-10, -10, 10);
    scene.add(pointLight2);

    // 背景星空
    createStarfield(scene);

    // 刀光效果
    slashEffectRef.current = new FruitNinjaSlash();

    // 粒子系统
    particleSystemRef.current = new ParticleSystem();

    // 初始化音频
    audioSystem.init();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameRef.current);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  // 游戏重置
  useEffect(() => {
    if (gameState === 'waiting') {
      scoreRef.current = 0;
      livesRef.current = 3;
      setCurrentCombo(0);
      difficultyRef.current = 1;
      
      const scene = sceneRef.current;
      if (scene) {
        fruitsRef.current.forEach(f => f.cleanup(scene));
        fruitsRef.current = [];
        slashEffectRef.current?.clear(scene);
        spawnEarth();
      }
    }
  }, [gameState, spawnEarth]);

  // 游戏循环
  useEffect(() => {
    const animate = (time: number) => {
      animationFrameRef.current = requestAnimationFrame(animate);

      const deltaTime = Math.min((time - lastTimeRef.current) / 1000, 0.1);
      lastTimeRef.current = time;
      const currentTime = time / 1000;

      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      
      if (!scene || !camera || !renderer) return;

      // 更新手指位置和刀光
      if (fingerPosition && isTracking) {
        const worldPos = screenToWorld(fingerPosition.x, fingerPosition.y);
        
        // 添加刀光轨迹点
        slashEffectRef.current?.addPoint(worldPos, scene, currentTime);
        
        // 检测切割
        checkSlice(worldPos, fingerVelocity);
        
        lastFingerPosRef.current = worldPos;
      } else {
        lastFingerPosRef.current = null;
      }

      // 更新刀光效果
      slashEffectRef.current?.update(scene, deltaTime, currentTime);

      // 游戏进行中的逻辑
      if (gameStateRef.current === 'playing') {
        gameTimeRef.current += deltaTime;
        
        // 逐渐增加难度
        difficultyRef.current = 1 + Math.floor(gameTimeRef.current / 30);
        
        // 生成水果 - 根据难度调整频率
        spawnTimerRef.current += deltaTime;
        const spawnInterval = Math.max(0.8, 1.5 - difficultyRef.current * 0.1);
        
        if (spawnTimerRef.current > spawnInterval) {
          spawnTimerRef.current = 0;
          const count = 1 + Math.floor(Math.random() * (1 + difficultyRef.current * 0.3));
          for (let i = 0; i < count; i++) {
            setTimeout(() => spawnFruit(), i * 150);
          }
        }

        // 连击计时器
        if (currentCombo > 0) {
          comboTimerRef.current -= deltaTime;
          if (comboTimerRef.current <= 0) {
            setCurrentCombo(0);
            onComboChange(0);
          }
        }
      }

      // 更新地球
      if (earthRef.current) {
        earthRef.current.update(deltaTime, 0);
        earthRef.current.mesh.position.y = Math.sin(time * 0.002) * 0.3;
        // 地球自转
        earthRef.current.mesh.rotation.y += 0.01;
      }

      // 更新水果
      fruitsRef.current.forEach(fruit => {
        fruit.update(deltaTime);
      });

      // 检测掉落的水果
      fruitsRef.current = fruitsRef.current.filter(fruit => {
        if (fruit.isOffScreen()) {
          if (!fruit.isSliced && gameStateRef.current === 'playing') {
            if (fruit.type === 'watermelon') {
              livesRef.current -= 1;
              onLivesChange(livesRef.current);
              audioSystem.playLoseLifeSound();
              
              // 重置连击
              setCurrentCombo(0);
              onComboChange(0);
              
              if (livesRef.current <= 0) {
                audioSystem.playGameOverSound();
                onGameOver();
              }
            }
          }
          fruit.cleanup(scene);
          return false;
        }
        return true;
      });

      // 更新粒子
      particleSystemRef.current?.update(deltaTime, scene);

      // 渲染
      renderer.render(scene, camera);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    
    return () => {
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [fingerPosition, isTracking, fingerVelocity, screenToWorld, checkSlice, spawnFruit, currentCombo, onComboChange, onLivesChange, onGameOver]);

  return <div ref={containerRef} className="three-canvas" />;
}
