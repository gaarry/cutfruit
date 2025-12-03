// Web Audio API 音效系统
class AudioSystem {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private isInitialized = false;

  async init() {
    if (this.isInitialized) return;
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.5;
      this.masterGain.connect(this.audioContext.destination);
      this.isInitialized = true;
    } catch (error) {
      console.warn('Audio initialization failed:', error);
    }
  }

  private playTone(
    frequency: number,
    duration: number,
    type: OscillatorType = 'sine',
    attack: number = 0.01,
    decay: number = 0.1,
    volume: number = 0.3
  ) {
    if (!this.audioContext || !this.masterGain) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, this.audioContext.currentTime);

    gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + attack);
    gainNode.gain.linearRampToValueAtTime(volume * 0.7, this.audioContext.currentTime + attack + decay);
    gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  private playNoise(duration: number, volume: number = 0.2) {
    if (!this.audioContext || !this.masterGain) return;

    const bufferSize = this.audioContext.sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.audioContext.createBufferSource();
    noise.buffer = buffer;

    const gainNode = this.audioContext.createGain();
    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);

    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 3000;

    noise.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(this.masterGain);

    noise.start();
    noise.stop(this.audioContext.currentTime + duration);
  }

  // 切水果音效 - 清脆的切割声
  playSliceSound() {
    this.playTone(800, 0.15, 'sine', 0.005, 0.05, 0.4);
    this.playTone(1200, 0.1, 'sine', 0.005, 0.03, 0.2);
    this.playNoise(0.08, 0.15);
  }

  // 西瓜切割 - 多汁的声音
  playWatermelonSlice() {
    this.playTone(400, 0.2, 'sine', 0.01, 0.1, 0.3);
    this.playTone(600, 0.15, 'triangle', 0.01, 0.08, 0.2);
    this.playNoise(0.15, 0.2);
    setTimeout(() => this.playTone(200, 0.3, 'sine', 0.05, 0.15, 0.15), 50);
  }

  // 便便切割 - 滑稽的声音
  playPoopSlice() {
    this.playTone(150, 0.3, 'sawtooth', 0.01, 0.1, 0.25);
    this.playTone(100, 0.4, 'square', 0.02, 0.2, 0.15);
    setTimeout(() => this.playTone(80, 0.2, 'sine', 0.05, 0.1, 0.2), 100);
  }

  // 炸弹爆炸 - 低沉的爆炸声
  playBombExplosion() {
    if (!this.audioContext || !this.masterGain) return;

    // 低频爆炸
    this.playTone(60, 0.5, 'sine', 0.01, 0.3, 0.5);
    this.playTone(40, 0.6, 'sine', 0.02, 0.4, 0.4);
    
    // 爆炸噪声
    this.playNoise(0.4, 0.4);
    
    // 余震
    setTimeout(() => {
      this.playTone(50, 0.3, 'sine', 0.1, 0.2, 0.2);
      this.playNoise(0.2, 0.15);
    }, 150);
  }

  // 连击音效
  playComboSound(comboCount: number) {
    const baseFreq = 400 + comboCount * 100;
    this.playTone(baseFreq, 0.15, 'sine', 0.005, 0.05, 0.3);
    this.playTone(baseFreq * 1.5, 0.1, 'triangle', 0.01, 0.05, 0.2);
  }

  // 开始游戏音效
  playStartSound() {
    const notes = [523, 659, 784, 1047]; // C5, E5, G5, C6
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 0.3, 'sine', 0.01, 0.1, 0.3);
      }, i * 100);
    });
  }

  // 游戏结束音效
  playGameOverSound() {
    const notes = [392, 349, 330, 262]; // G4, F4, E4, C4
    notes.forEach((freq, i) => {
      setTimeout(() => {
        this.playTone(freq, 0.4, 'sine', 0.02, 0.2, 0.3);
      }, i * 200);
    });
  }

  // 失去生命
  playLoseLifeSound() {
    this.playTone(200, 0.3, 'square', 0.01, 0.1, 0.3);
    this.playTone(150, 0.4, 'square', 0.02, 0.2, 0.2);
  }

  // 刀光划过音效
  playSwipeSound() {
    if (!this.audioContext || !this.masterGain) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(2000, this.audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(500, this.audioContext.currentTime + 0.1);

    gainNode.gain.setValueAtTime(0.1, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1);

    oscillator.connect(gainNode);
    gainNode.connect(this.masterGain);

    oscillator.start();
    oscillator.stop(this.audioContext.currentTime + 0.1);
  }
}

export const audioSystem = new AudioSystem();

