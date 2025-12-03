import { useEffect, useRef, useCallback } from 'react';
import { Hands, Results, HAND_CONNECTIONS } from '@mediapipe/hands';
import { Camera } from '@mediapipe/camera_utils';
import { drawConnectors, drawLandmarks } from '@mediapipe/drawing_utils';

interface HandTrackerProps {
  onHandMove: (x: number, y: number, isTracking: boolean) => void;
}

export function HandTracker({ onHandMove }: HandTrackerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const handsRef = useRef<Hands | null>(null);
  const cameraRef = useRef<Camera | null>(null);

  const onResults = useCallback((results: Results) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 设置 canvas 尺寸
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      const hand = results.multiHandLandmarks[0];
      
      // 绘制骨骼连线
      drawConnectors(ctx, hand, HAND_CONNECTIONS, {
        color: '#00FFFF',
        lineWidth: 3,
      });
      
      // 绘制关键点
      drawLandmarks(ctx, hand, {
        color: '#FF00FF',
        lineWidth: 1,
        radius: 4,
      });

      // 高亮食指指尖 (index 8)
      const indexTip = hand[8];
      ctx.beginPath();
      ctx.arc(indexTip.x * canvas.width, indexTip.y * canvas.height, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 0, 0.8)';
      ctx.fill();
      ctx.strokeStyle = '#FFFF00';
      ctx.lineWidth = 3;
      ctx.stroke();

      // 添加发光效果
      ctx.shadowColor = '#FFFF00';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(indexTip.x * canvas.width, indexTip.y * canvas.height, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
      ctx.shadowBlur = 0;

      // 转换坐标并回调 (镜像 x 坐标)
      const normalizedX = 1 - indexTip.x; // 镜像处理
      const normalizedY = indexTip.y;
      
      onHandMove(normalizedX, normalizedY, true);
    } else {
      onHandMove(0, 0, false);
    }
  }, [onHandMove]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // 初始化 MediaPipe Hands
    const hands = new Hands({
      locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
      },
    });

    hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    });

    hands.onResults(onResults);
    handsRef.current = hands;

    // 初始化摄像头
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

