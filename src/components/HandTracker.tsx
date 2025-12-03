import { useEffect, useRef, useCallback } from 'react';
import { Hands, Results, HAND_CONNECTIONS } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

interface HandTrackerProps {
  onHandMove: (x: number, y: number, isTracking: boolean, velocity: number) => void;
}

// 平滑滤波器 - 减少抖动
class SmoothingFilter {
  private history: { x: number; y: number; time: number }[] = [];
  private maxHistory = 5;
  private lastOutput = { x: 0, y: 0 };
  
  add(x: number, y: number): { x: number; y: number; velocity: number } {
    const now = performance.now();
    this.history.push({ x, y, time: now });
    
    // 保持历史记录在限制内
    while (this.history.length > this.maxHistory) {
      this.history.shift();
    }
    
    // 计算加权平均（最新的权重更大）
    let totalWeight = 0;
    let smoothX = 0;
    let smoothY = 0;
    
    this.history.forEach((point, index) => {
      const weight = index + 1; // 线性权重
      smoothX += point.x * weight;
      smoothY += point.y * weight;
      totalWeight += weight;
    });
    
    smoothX /= totalWeight;
    smoothY /= totalWeight;
    
    // 计算速度
    let velocity = 0;
    if (this.history.length >= 2) {
      const curr = this.history[this.history.length - 1];
      const prev = this.history[this.history.length - 2];
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      const dt = Math.max(curr.time - prev.time, 1) / 1000;
      velocity = Math.sqrt(dx * dx + dy * dy) / dt;
    }
    
    // 应用低通滤波
    const smoothingFactor = 0.6;
    smoothX = this.lastOutput.x + smoothingFactor * (smoothX - this.lastOutput.x);
    smoothY = this.lastOutput.y + smoothingFactor * (smoothY - this.lastOutput.y);
    
    this.lastOutput = { x: smoothX, y: smoothY };
    
    return { x: smoothX, y: smoothY, velocity };
  }
  
  reset() {
    this.history = [];
    this.lastOutput = { x: 0, y: 0 };
  }
}

export function HandTracker({ onHandMove }: HandTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<Hands | null>(null);
  const cameraRef = useRef<Camera | null>(null);
  const smoothingFilterRef = useRef(new SmoothingFilter());
  const trailPointsRef = useRef<{ x: number; y: number; time: number }[]>([]);

  const onResults = useCallback((results: Results) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const hand = results.multiHandLandmarks[0];
      
      // 绘制发光骨骼连线
      ctx.shadowColor = '#00ffff';
      ctx.shadowBlur = 15;
      drawConnectors(ctx, hand, HAND_CONNECTIONS, {
        color: '#00ffff',
        lineWidth: 2,
      });
      ctx.shadowBlur = 0;
      
      // 绘制关键点 - 渐变色
      hand.forEach((landmark, index) => {
        const x = landmark.x * canvas.width;
        const y = landmark.y * canvas.height;
        
        // 指尖用特殊颜色
        const isTip = [4, 8, 12, 16, 20].includes(index);
        const radius = isTip ? 6 : 4;
        const color = isTip ? '#ff00ff' : '#00ffff';
        
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.shadowColor = color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
      });

      // 食指指尖 (index 8) - 主要追踪点
      const indexTip = hand[8];
      const tipX = indexTip.x * canvas.width;
      const tipY = indexTip.y * canvas.height;
      
      // 添加轨迹点
      const now = performance.now();
      trailPointsRef.current.push({ x: tipX, y: tipY, time: now });
      
      // 清理旧轨迹点
      trailPointsRef.current = trailPointsRef.current.filter(p => now - p.time < 200);
      
      // 绘制刀光轨迹
      if (trailPointsRef.current.length > 1) {
        ctx.beginPath();
        ctx.moveTo(trailPointsRef.current[0].x, trailPointsRef.current[0].y);
        
        for (let i = 1; i < trailPointsRef.current.length; i++) {
          const point = trailPointsRef.current[i];
          const age = now - point.time;
          const alpha = 1 - age / 200;
          
          // 使用二次贝塞尔曲线平滑
          if (i < trailPointsRef.current.length - 1) {
            const next = trailPointsRef.current[i + 1];
            const cpX = point.x;
            const cpY = point.y;
            const endX = (point.x + next.x) / 2;
            const endY = (point.y + next.y) / 2;
            ctx.quadraticCurveTo(cpX, cpY, endX, endY);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        }
        
        // 发光刀光效果
        const gradient = ctx.createLinearGradient(
          trailPointsRef.current[0].x,
          trailPointsRef.current[0].y,
          tipX,
          tipY
        );
        gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
        gradient.addColorStop(0.5, 'rgba(0, 255, 255, 0.5)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 1)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.shadowColor = '#00ffff';
        ctx.shadowBlur = 20;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 高亮食指指尖
      // 外圈发光
      ctx.beginPath();
      ctx.arc(tipX, tipY, 20, 0, Math.PI * 2);
      const glowGradient = ctx.createRadialGradient(tipX, tipY, 0, tipX, tipY, 20);
      glowGradient.addColorStop(0, 'rgba(255, 255, 0, 0.8)');
      glowGradient.addColorStop(0.5, 'rgba(255, 255, 0, 0.3)');
      glowGradient.addColorStop(1, 'rgba(255, 255, 0, 0)');
      ctx.fillStyle = glowGradient;
      ctx.fill();
      
      // 内圈
      ctx.beginPath();
      ctx.arc(tipX, tipY, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = '#ffff00';
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;
      
      // 十字准星
      ctx.strokeStyle = 'rgba(255, 255, 0, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(tipX - 25, tipY);
      ctx.lineTo(tipX - 12, tipY);
      ctx.moveTo(tipX + 12, tipY);
      ctx.lineTo(tipX + 25, tipY);
      ctx.moveTo(tipX, tipY - 25);
      ctx.lineTo(tipX, tipY - 12);
      ctx.moveTo(tipX, tipY + 12);
      ctx.lineTo(tipX, tipY + 25);
      ctx.stroke();

      // 平滑处理并回调
      const smoothed = smoothingFilterRef.current.add(1 - indexTip.x, indexTip.y);
      onHandMove(smoothed.x, smoothed.y, true, smoothed.velocity);
    } else {
      smoothingFilterRef.current.reset();
      trailPointsRef.current = [];
      onHandMove(0, 0, false, 0);
    }
  }, [onHandMove]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.6,
    });

    hands.onResults(onResults);
    handsRef.current = hands;

    const camera = new Camera(video, {
      onFrame: async () => {
        if (handsRef.current && video.readyState >= 2) {
          await handsRef.current.send({ image: video });
        }
      },
      width: 640,
      height: 480,
    });

    cameraRef.current = camera;
    camera.start();

    return () => {
      camera.stop();
      hands.close();
    };
  }, [onResults]);

  return (
    <div className="camera-container">
      <video
        ref={videoRef}
        className="camera-video"
        autoPlay
        playsInline
        muted
      />
      <canvas ref={canvasRef} className="camera-canvas" />
      <div className="camera-label">🎯 HAND TRACKING</div>
    </div>
  );
}
