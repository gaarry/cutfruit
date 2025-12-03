import { useState, useCallback, useEffect } from 'react';
import { GameEngine } from './components/GameEngine';
import { HandTracker } from './components/HandTracker';

type GameState = 'loading' | 'waiting' | 'playing' | 'gameover';

function App() {
  const [gameState, setGameState] = useState<GameState>('loading');
  const [fingerPosition, setFingerPosition] = useState<{ x: number; y: number } | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [lives, setLives] = useState(3);
  const [finalScore, setFinalScore] = useState(0);

  // 处理手势移动
  const handleHandMove = useCallback((x: number, y: number, tracking: boolean) => {
    setIsTracking(tracking);
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
  }, [score]);

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
        </div>
      )}

      {/* 3D 游戏场景 */}
      {gameState !== 'loading' && (
        <GameEngine
          fingerPosition={fingerPosition}
          isTracking={isTracking}
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
                🔥 {combo}x COMBO!
              </div>
            )}
            
            <div className="lives-display">
              {[...Array(3)].map((_, i) => (
                <span key={i} className={`life ${i >= lives ? 'lost' : ''}`}>
                  ❤️
                </span>
              ))}
            </div>
          </>
        )}

        {/* 等待开始 */}
        {gameState === 'waiting' && (
          <div className="game-status">
            <div className="start-hint">
              ✋ 用手指切割 🌍 地球 开始游戏
            </div>
          </div>
        )}

        {/* 游戏结束 */}
        {gameState === 'gameover' && (
          <div className="game-status">
            <div className="game-over">
              <h2>💥 GAME OVER</h2>
              <div className="final-score">
                最终得分: <span style={{ color: '#0ff' }}>{finalScore}</span>
              </div>
              <button className="restart-btn" onClick={handleRestart}>
                再来一局
              </button>
            </div>
          </div>
        )}

        {/* 游戏说明 */}
        {(gameState === 'waiting' || gameState === 'playing') && (
          <div className="instructions">
            <h4>🎮 游戏说明</h4>
            <p>
              用食指在空中划动来切割水果。<br/>
              连续切中获得连击加分！
            </p>
            <div className="emoji-guide">
              <span>
                <div>🍉</div>
                +10分
              </span>
              <span>
                <div>💩</div>
                -5分
              </span>
              <span>
                <div>💣</div>
                -1命
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;

