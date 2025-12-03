import { useEffect, useRef, useCallback, useState } from 'react';
import * as THREE from 'three';
import { Fruit, FruitType, SlashTrail, ParticleSystem, createStarfield, FRUIT_CONFIGS } from '../utils/gameObjects';
import { audioSystem } from '../utils/audioSystem';

interface GameEngineProps {
  fingerPosition: { x: number; y: number } | null;
  isTracking: boolean;
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
  const slashTrailRef = useRef<SlashTrail | null>(null);
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

  // 同步 gameState
  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  // 将屏幕坐标转换为 3D 世界坐标
  const screenToWorld = useCallback((x: number, y: number): THREE.Vector3 => {
    const camera = cameraRef.current;
    if (!camera) return new THREE.Vector3();

    // 转换为 NDC 坐标 (-1 to 1)
    const ndcX = x * 2 - 1;
    const ndcY = -(y * 2 - 1);

    const vector = new THREE.Vector3(ndcX, ndcY, 0.5);
    vector.unproject(camera);
    
    const dir = vector.sub(camera.position).normalize();
    const distance = -camera.position.z / dir.z;
    const worldPos = camera.position.clone().add(dir.multiplyScalar(distance));
    
    return worldPos;
  }, []);

  // 生成随机水果
  const spawnFruit = useCallback((type?: FruitType) => {
    const scene = sceneRef.current;
    if (!scene) return;

    // 随机类型 (如果没有指定)
    if (!type) {
      const rand = Math.random();
      if (rand < 0.6) type = 'watermelon';
      else if (rand < 0.85) type = 'poop';
      else type = 'bomb';
    }

    // 随机位置 (从底部飞出)
    const x = (Math.random() - 0.5) * 12;
    const position = new THREE.Vector3(x, -8, 0);
    
    const fruit = new Fruit(type, position);
    
    // 设置向上的初速度
    const targetX = (Math.random() - 0.5) * 6;
    const targetY = 2 + Math.random() * 3;
    
    fruit.velocity.set(
      (targetX - x) * 0.5,
      15 + Math.random() * 5,
      0
    );
    
    fruitsRef.current.push(fruit);
    scene.add(fruit.mesh);
  }, []);

  // 生成起始地球
  const spawnEarth = useCallback(() => {
    const scene = sceneRef.current;
    if (!scene || earthRef.current) return;

    const earth = new Fruit('earth', new THREE.Vector3(0, 0, 0));
    earth.rotationSpeed.set(0, 0.02, 0);
    
    earthRef.current = earth;
    scene.add(earth.mesh);
  }, []);

  // 检测切割
  const checkSlice = useCallback((currentPos: THREE.Vector3) => {
    const lastPos = lastFingerPosRef.current;
    if (!lastPos) return;

    const scene = sceneRef.current;
    if (!scene) return;

    // 计算滑动速度
    const swipeDistance = currentPos.distanceTo(lastPos);
    if (swipeDistance < 0.3) return; // 太慢不算切割

    // 检测地球
    if (gameStateRef.current === 'waiting' && earthRef.current && !earthRef.current.isSliced) {
      const earthDist = currentPos.distanceTo(earthRef.current.mesh.position);
      if (earthDist < earthRef.current.boundingRadius + 0.5) {
        earthRef.current.slice(scene);
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
      let slicedAny = false;
      
      fruitsRef.current.forEach(fruit => {
        if (fruit.isSliced) return;
        
        const dist = currentPos.distanceTo(fruit.mesh.position);
        if (dist < fruit.boundingRadius + 0.3) {
          fruit.slice(scene);
          slicedAny = true;
          
          const config = FRUIT_CONFIGS[fruit.type];
          
          // 粒子效果
          particleSystemRef.current?.createSliceEffect(
            fruit.mesh.position,
            config.color,
            scene
          );
          
          // 根据类型处理
          switch (fruit.type) {
            case 'watermelon':
              audioSystem.playWatermelonSlice();
              scoreRef.current += config.score;
              setCurrentCombo(prev => {
                const newCombo = prev + 1;
                comboTimerRef.current = 1.5; // 重置连击计时器
                onComboChange(newCombo);
                if (newCombo > 1) {
                  audioSystem.playComboSound(newCombo);
                  scoreRef.current += newCombo * 5; // 连击加分
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
              
              if (livesRef.current <= 0) {
                audioSystem.playGameOverSound();
                onGameOver();
              }
              break;
          }
          
          onScoreChange(Math.max(0, scoreRef.current));
        }
      });
      
      if (slicedAny) {
        audioSystem.playSwipeSound();
      }
    }
  }, [onGameStart, onScoreChange, onComboChange, onLivesChange, onGameOver]);

  // 初始化 Three.js 场景
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 创建场景
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a1a);
    sceneRef.current = scene;

    // 创建相机
    const camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.z = 10;
    cameraRef.current = camera;

    // 创建渲染器
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 添加环境光
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambientLight);

    // 添加点光源
    const pointLight = new THREE.PointLight(0x00ffff, 1, 100);
    pointLight.position.set(5, 5, 10);
    scene.add(pointLight);

    // 创建背景星空
    createStarfield(scene);

    // 创建刀光轨迹
    slashTrailRef.current = new SlashTrail();

    // 创建粒子系统
    particleSystemRef.current = new ParticleSystem();

    // 初始化音频
    audioSystem.init();

    // 窗口大小调整
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // 清理
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
      
      // 清除所有水果
      const scene = sceneRef.current;
      if (scene) {
        fruitsRef.current.forEach(f => f.cleanup(scene));
        fruitsRef.current = [];
        
        // 生成新的地球
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

      const scene = sceneRef.current;
      const camera = cameraRef.current;
      const renderer = rendererRef.current;
      
      if (!scene || !camera || !renderer) return;

      // 更新手指位置和刀光
      if (fingerPosition && isTracking) {
        const worldPos = screenToWorld(fingerPosition.x, fingerPosition.y);
        
        // 添加刀光轨迹点
        slashTrailRef.current?.addPoint(worldPos, scene);
        slashTrailRef.current?.resetOpacity();
        
        // 检测切割
        checkSlice(worldPos);
        
        lastFingerPosRef.current = worldPos;
      } else {
        // 刀光渐隐
        slashTrailRef.current?.update(scene);
        lastFingerPosRef.current = null;
      }

      // 游戏进行中的逻辑
      if (gameStateRef.current === 'playing') {
        // 生成水果
        spawnTimerRef.current += deltaTime;
        if (spawnTimerRef.current > 1.5) {
          spawnTimerRef.current = 0;
          const count = 1 + Math.floor(Math.random() * 2);
          for (let i = 0; i < count; i++) {
            setTimeout(() => spawnFruit(), i * 200);
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
        // 地球悬浮动画
        earthRef.current.mesh.position.y = Math.sin(time * 0.002) * 0.3;
      }

      // 更新水果
      fruitsRef.current.forEach(fruit => {
        fruit.update(deltaTime);
      });

      // 检测掉落的水果
      fruitsRef.current = fruitsRef.current.filter(fruit => {
        if (fruit.isOffScreen()) {
          // 未切割的水果掉落扣分/扣命
          if (!fruit.isSliced && gameStateRef.current === 'playing') {
            if (fruit.type === 'watermelon') {
              // 漏掉水果扣命
              livesRef.current -= 1;
              onLivesChange(livesRef.current);
              audioSystem.playLoseLifeSound();
              
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
  }, [fingerPosition, isTracking, screenToWorld, checkSlice, spawnFruit, currentCombo, onComboChange, onLivesChange, onGameOver]);

  return <div ref={containerRef} className="three-canvas" />;
}

