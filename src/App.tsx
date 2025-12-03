import { useState, useCallback, useEffect } from 'react';
import { GameEngine } from './components/GameEngine';
import { HandTracker } from './components/HandTracker';

type GameState = 'loading' | 'waiting' | 'playing' | 'gameover';

function App() {
  const [gameState, setGameState] = useState<GameState>('loading');
  const [fingerPosition, setFingerPosition] = useState<{ x: number; y: number } | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [fingerVelocity, setFingerVelocity] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [finalScore, setFinalScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('fruitNinjaHighScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  // 处理手势移动
  const handleHandMove = useCallback((x: number, y: number, tracking: boolean, velocity: number) => {
    setIsTracking(tracking);
    setFingerVelocity(velocity);
    if (tracking) {
      setFingerPosition({ x, y });
    } else {
      setFingerPosition(null);
    }
  }, []);

  // 开始游戏
  const handleGameStart = useCallback(() => {
    setGameState('playing');
    setScore(0);
    setCombo(0);
    setLives(3);
  }, []);

  // 游戏结束
  const handleGameOver = useCallback(() => {
    setFinalScore(score);
    setGameState('gameover');
    
    // 更新最高分
    if (score > highScore) {
      setHighScore(score);
      localStorage.setItem('fruitNinjaHighScore', score.toString());
    }
  }, [score, highScore]);

  // 重新开始
  const handleRestart = useCallback(() => {
    setGameState('waiting');
    setScore(0);
    setCombo(0);
    setLives(3);
  }, []);

  // 加载完成
  useEffect(() => {
    const timer = setTimeout(() => {
      setGameState('waiting');
    }, 2000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="game-container">
      {/* 加载界面 */}
      {gameState === 'loading' && (
        <div className="loading-overlay">
          <div className="loading-spinner" />
          <div className="loading-text">正在加载...</div>
          <div className="loading-subtext">请允许摄像头访问权限</div>
        </div>
      )}

      {/* 3D 游戏场景 */}
      {gameState !== 'loading' && (
        <GameEngine
          fingerPosition={fingerPosition}
          isTracking={isTracking}
          fingerVelocity={fingerVelocity}
          gameState={gameState === 'gameover' ? 'waiting' : gameState}
          onGameStart={handleGameStart}
          onScoreChange={setScore}
          onComboChange={setCombo}
          onLivesChange={setLives}
          onGameOver={handleGameOver}
        />
      )}

      {/* 摄像头 */}
      {gameState !== 'loading' && (
        <HandTracker onHandMove={handleHandMove} />
      )}

      {/* UI 覆盖层 */}
      <div className="ui-overlay">
        {/* 分数显示 */}
        {gameState === 'playing' && (
          <>
            <div className="score-display">
              <div className="score-label">SCORE</div>
              <div className="score-value">{score}</div>
            </div>
            
            {combo > 1 && (
              <div className={`combo-display ${combo > 1 ? 'active' : ''}`}>
                <span className="combo-fire">🔥</span>
                <span className="combo-count">{combo}x</span>
                <span className="combo-text">COMBO!</span>
              </div>
            )}
            
            <div className="lives-display">
              {[...Array(3)].map((_, i) => (
                <span key={i} className={`life ${i >= lives ? 'lost' : ''}`}>
                  ❤️
                </span>
              ))}
            </div>

            {/* 最高分显示 */}
            {highScore > 0 && (
              <div className="high-score">
                <span>🏆 最高: {highScore}</span>
              </div>
            )}
          </>
        )}

        {/* 等待开始 */}
        {gameState === 'waiting' && (
          <div className="game-status">
            <div className="title-container">
              <h1 className="game-title">🍉 手势切水果</h1>
              <p className="game-subtitle">GESTURE FRUIT NINJA</p>
            </div>
            <div className="start-hint">
              <span className="hint-icon">✋</span>
              <span className="hint-text">用手指划过 🌍 地球 开始游戏</span>
            </div>
            {highScore > 0 && (
              <div className="high-score-display">
                🏆 最高分: <span>{highScore}</span>
              </div>
            )}
          </div>
        )}

        {/* 游戏结束 */}
        {gameState === 'gameover' && (
          <div className="game-status">
            <div className="game-over">
              <h2>💥 GAME OVER</h2>
              <div className="final-score">
                得分: <span className="score-number">{finalScore}</span>
              </div>
              {finalScore >= highScore && finalScore > 0 && (
                <div className="new-record">🎉 新纪录！</div>
              )}
              <div className="high-score-info">
                最高分: <span>{highScore}</span>
              </div>
              <button className="restart-btn" onClick={handleRestart}>
                <span className="btn-icon">🔄</span>
                <span>再来一局</span>
              </button>
            </div>
          </div>
        )}

        {/* 游戏说明 */}
        {(gameState === 'waiting' || gameState === 'playing') && (
          <div className="instructions">
            <h4>🎮 游戏说明</h4>
            <p>
              快速划动食指切割水果！<br/>
              连续切中获得连击加分！
            </p>
            <div className="emoji-guide">
              <span className="guide-item">
                <div className="guide-emoji">🍉</div>
                <div className="guide-score positive">+10</div>
              </span>
              <span className="guide-item">
                <div className="guide-emoji">💩</div>
                <div className="guide-score negative">-5</div>
              </span>
              <span className="guide-item">
                <div className="guide-emoji">💣</div>
                <div className="guide-score danger">-1❤️</div>
              </span>
            </div>
          </div>
        )}

        {/* 手势状态指示器 */}
        {gameState !== 'loading' && (
          <div className={`tracking-indicator ${isTracking ? 'active' : ''}`}>
            <div className="indicator-dot" />
            <span>{isTracking ? '手势追踪中' : '未检测到手势'}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
