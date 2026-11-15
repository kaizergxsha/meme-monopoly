const PRELOAD_SOUNDS = {
  gain: '/sounds/gain.mp3',
  spend: '/sounds/spend.mp3',
  tauntLoh: '/sounds/taunt_loh.wav',
  tauntLohClean: '/sounds/taunt_loh_clean.wav',
  tauntRentRage: '/sounds/taunt_rent_rage.wav',
  tauntRentRageClean: '/sounds/taunt_rent_rage_clean.wav',
  tauntFiasco: '/sounds/taunt_fiasco.wav',
  tauntGovno: '/sounds/taunt_govno.wav',
  tauntGovnoClean: '/sounds/taunt_govno_clean.wav',
  tauntPressF: '/sounds/taunt_press_f.wav',
} as const;

function readInitialMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem('mm_muted') === '1';
  } catch {
    return false;
  }
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private unlocked = false;
  private muted: boolean = readInitialMuted();

  private audioTemplates = new Map<string, HTMLAudioElement>();
  private rawBuffers = new Map<string, ArrayBuffer>();
  private decodedBuffers = new Map<string, AudioBuffer>();
  private decodingUrls = new Set<string>();
  private activeClips = new Set<HTMLAudioElement>();
  private activeSources = new Set<AudioBufferSourceNode>();

  constructor() {
    if (typeof window !== 'undefined') {
      Object.values(PRELOAD_SOUNDS).forEach((url) => this.preloadSound(url));
      this.setupAutoUnlock();
    }
  }

  private preloadSound(url: string) {
    if (typeof Audio !== 'undefined') {
      try {
        const audio = new Audio(url);
        audio.preload = 'auto';
        audio.load();
        this.audioTemplates.set(url, audio);
      } catch {
        // ignore audio element preload issues
      }
    }

    if (typeof fetch !== 'undefined') {
      fetch(url)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(new Error(`HTTP ${res.status}`))))
        .then((buf) => {
          this.rawBuffers.set(url, buf);
          if (this.ctx) {
            this.decodeCachedBuffer(url);
          }
        })
        .catch(() => {
          // fallback will handle missing/offline files
        });
    }
  }

  private decodeCachedBuffer(url: string) {
    if (!this.ctx || this.decodedBuffers.has(url) || this.decodingUrls.has(url)) return;
    const raw = this.rawBuffers.get(url);
    if (!raw) return;

    this.decodingUrls.add(url);
    const copy = raw.slice(0);
    this.ctx
      .decodeAudioData(copy)
      .then((audioBuf) => {
        this.decodedBuffers.set(url, audioBuf);
      })
      .catch(() => {
        // HTMLAudioElement or synth fallback will handle playback
      })
      .finally(() => {
        this.decodingUrls.delete(url);
      });
  }

  private setupAutoUnlock() {
    const onFirstGesture = () => {
      this.unlock();
      if (this.unlocked) {
        window.removeEventListener('pointerdown', onFirstGesture, true);
        window.removeEventListener('keydown', onFirstGesture, true);
      }
    };
    window.addEventListener('pointerdown', onFirstGesture, { capture: true, passive: true });
    window.addEventListener('keydown', onFirstGesture, { capture: true, passive: true });
  }

  public unlock() {
    if (typeof window === 'undefined') return;

    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
        } catch {
          // ignore if blocked
        }
      }
    }

    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      // Проигрываем 1-семпловый тихий буфер для гарантированной разблокировки конвейера WebAudio
      try {
        const silentBuf = this.ctx.createBuffer(1, 1, 22050);
        const src = this.ctx.createBufferSource();
        src.buffer = silentBuf;
        src.connect(this.ctx.destination);
        src.start(0);
      } catch {
        // ignore
      }
      for (const url of this.rawBuffers.keys()) {
        this.decodeCachedBuffer(url);
      }
      this.unlocked = true;
    }

    // Прогреваем список голосов браузера для резервного speechSynthesis
    if ('speechSynthesis' in window) {
      try {
        window.speechSynthesis.getVoices();
      } catch {
        // ignore
      }
    }
  }

  private ensureCtx(): AudioContext | null {
    if (this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        try {
          this.ctx = new AudioCtx();
          for (const url of this.rawBuffers.keys()) {
            this.decodeCachedBuffer(url);
          }
        } catch {
          return null;
        }
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private playClip(url: string, volume: number, fallback: () => void) {
    if (this.muted) return;
    const clampedVol = Math.max(0, Math.min(1, volume));

    // Приоритет 1: декодированный AudioBuffer через разблокированный AudioContext
    // (не блокируется браузером при приходе чужих насмешек по WebSocket)
    const ctx = this.ensureCtx();
    const decoded = this.decodedBuffers.get(url);
    if (ctx && ctx.state === 'running' && decoded) {
      try {
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        src.buffer = decoded;
        gain.gain.setValueAtTime(clampedVol, ctx.currentTime);
        src.connect(gain);
        gain.connect(ctx.destination);
        this.activeSources.add(src);
        src.onended = () => {
          this.activeSources.delete(src);
          src.disconnect();
          gain.disconnect();
        };
        src.start(0);
        return;
      } catch {
        // переходим к HTMLAudioElement ниже
      }
    }

    // Приоритет 2: предзагруженный HTMLAudioElement
    const template = this.audioTemplates.get(url);
    if (template) {
      try {
        const clip = template.cloneNode(true) as HTMLAudioElement;
        clip.volume = clampedVol;
        this.activeClips.add(clip);
        const cleanup = () => {
          this.activeClips.delete(clip);
        };
        clip.addEventListener('ended', cleanup, { once: true });
        clip.addEventListener('error', cleanup, { once: true });

        const p = clip.play();
        if (p && typeof p.catch === 'function') {
          p.catch(() => {
            cleanup();
            fallback();
          });
        }
        return;
      } catch {
        // переходим к fallback ниже
      }
    }

    fallback();
  }

  private speakFallback(text: string, pitch: number, rate: number, toneFallback: () => void) {
    if (this.muted) return;
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof SpeechSynthesisUtterance !== 'undefined'
    ) {
      try {
        const synth = window.speechSynthesis;
        synth.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'ru-RU';
        utterance.pitch = pitch;
        utterance.rate = rate;
        utterance.volume = 0.95;

        const voices = synth.getVoices();
        const ruVoice = voices.find((v) => v.lang.toLowerCase().startsWith('ru'));
        if (ruVoice) {
          utterance.voice = ruVoice;
        }

        let fallbackCalled = false;
        utterance.onerror = () => {
          if (!fallbackCalled && !this.muted) {
            fallbackCalled = true;
            toneFallback();
          }
        };
        synth.speak(utterance);
        return;
      } catch {
        // переходим к тональному синтезатору
      }
    }
    toneFallback();
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public toggleMute(): boolean {
    this.muted = !this.muted;
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('mm_muted', this.muted ? '1' : '0');
      }
    } catch {
      // ignore storage quota/privacy errors
    }

    if (this.muted) {
      for (const clip of this.activeClips) {
        try {
          clip.pause();
          clip.currentTime = 0;
        } catch {
          // ignore
        }
      }
      this.activeClips.clear();

      for (const src of this.activeSources) {
        try {
          src.stop();
        } catch {
          // ignore
        }
      }
      this.activeSources.clear();

      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // ignore
        }
      }
    } else {
      this.unlock();
    }

    return this.muted;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    delay = 0,
    gainVal = 0.14,
    slideToFreq?: number
  ) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideToFreq) {
      osc.frequency.linearRampToValueAtTime(slideToFreq, now + duration);
    }
    const attack = Math.min(0.005, duration * 0.2);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.onended = () => {
      osc.disconnect();
      gain.disconnect();
    };
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  private playCardFlipSwish() {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const dur = 0.065;
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const noiseBuf = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      const env = Math.sin((Math.PI * i) / sampleCount);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(2.2, ctx.currentTime);
    filter.frequency.setValueAtTime(650, ctx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(2800, ctx.currentTime + dur);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.14, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    src.start(ctx.currentTime);
  }

  public playDice() {
    this.playTone(280, 0.06, 'square', 0, 0.08, 420);
    this.playTone(360, 0.06, 'square', 0.07, 0.08, 520);
    this.playTone(490, 0.09, 'triangle', 0.14, 0.11, 640);
  }

  public playCash() {
    this.playCashGain();
  }

  // Звук начисления денег (загруженный трек /sounds/gain.mp3, слышит только получатель)
  public playCashGain() {
    this.playClip(PRELOAD_SOUNDS.gain, 0.7, () => {
      this.playTone(1046.5, 0.14, 'sine', 0, 0.16);
      this.playTone(1318.51, 0.14, 'sine', 0.075, 0.17);
      this.playTone(1567.98, 0.16, 'sine', 0.15, 0.18);
      this.playTone(2093.0, 0.34, 'sine', 0.225, 0.2);
    });
  }

  // Звук оплаты / траты денег (загруженный трек /sounds/spend.mp3, слышит только плательщик)
  public playCashSpend() {
    this.playClip(PRELOAD_SOUNDS.spend, 0.7, () => {
      this.playTone(1318.51, 0.16, 'sine', 0, 0.18);
      this.playTone(1975.53, 0.42, 'sine', 0.095, 0.21);
    });
  }

  public playSiren() {
    this.playTone(620, 0.22, 'sawtooth', 0, 0.09, 920);
    this.playTone(920, 0.22, 'sawtooth', 0.22, 0.09, 620);
  }

  // Грустный тромбон («Инвестировал в говно»)
  public playSadTrombone() {
    this.playTone(293.66, 0.28, 'sawtooth', 0, 0.13); // D4
    this.playTone(277.18, 0.28, 'sawtooth', 0.3, 0.13); // C#4
    this.playTone(261.63, 0.28, 'sawtooth', 0.6, 0.13); // C4
    this.playTone(246.94, 0.75, 'sawtooth', 0.9, 0.15, 220); // B3 -> slide
  }

  // Приятный звук переворота и открытия карточки «Шанс»
  public playChanceReveal(tone: 'good' | 'bad' | 'move' | 'special' = 'special') {
    if (this.muted) return;
    this.playCardFlipSwish();
    this.playTone(300, 0.055, 'triangle', 0, 0.08, 860);

    if (tone === 'good') {
      // Светлый мажорный перелив удачи
      this.playTone(523.25, 0.12, 'sine', 0.055, 0.13);
      this.playTone(659.25, 0.12, 'sine', 0.115, 0.14);
      this.playTone(783.99, 0.14, 'sine', 0.175, 0.15);
      this.playTone(1046.5, 0.28, 'triangle', 0.24, 0.16);
    } else if (tone === 'bad') {
      // Ироничный драматический мини-аккорд подставы
      this.playTone(659.25, 0.12, 'triangle', 0.055, 0.13);
      this.playTone(622.25, 0.12, 'triangle', 0.125, 0.13);
      this.playTone(523.25, 0.14, 'triangle', 0.195, 0.14);
      this.playTone(440.0, 0.3, 'sawtooth', 0.27, 0.09, 392.0);
    } else if (tone === 'move') {
      // Стремительный звук телепорта / перемещения фишки
      this.playTone(587.33, 0.09, 'triangle', 0.055, 0.12, 783.99);
      this.playTone(783.99, 0.1, 'triangle', 0.125, 0.13, 987.77);
      this.playTone(987.77, 0.22, 'sine', 0.2, 0.15, 1174.66);
    } else {
      // Загадочный мерцающий аккорд карточки «Шанс»
      this.playTone(698.46, 0.12, 'sine', 0.055, 0.13);
      this.playTone(880.0, 0.12, 'sine', 0.115, 0.14);
      this.playTone(1046.5, 0.14, 'sine', 0.175, 0.14);
      this.playTone(1318.51, 0.28, 'triangle', 0.24, 0.15);
    }
  }

  public playTaunt(sound: 'laugh' | 'fiasco' | 'trombone' | 'rage' | 'pressf', censored = false) {
    if (this.muted) return;

    if (sound === 'trombone') {
      const url = censored ? PRELOAD_SOUNDS.tauntGovnoClean : PRELOAD_SOUNDS.tauntGovno;
      const phrase = censored ? 'Гениальная инвестиция!' : 'Инвестировал в говно!';
      this.playClip(url, 0.95, () => {
        this.speakFallback(phrase, 1.7, 1.2, () => {
          this.playSadTrombone();
        });
      });
      return;
    }

    if (sound === 'laugh') {
      const url = censored ? PRELOAD_SOUNDS.tauntLohClean : PRELOAD_SOUNDS.tauntLoh;
      const phrase = censored ? 'Ну ты и простофиля! Ха-ха!' : 'Ебать ты лох! Ха-ха-ха!';
      this.playClip(url, 0.95, () => {
        this.speakFallback(phrase, 1.85, 1.25, () => {
          [520, 480, 540, 440].forEach((f, i) => this.playTone(f, 0.1, 'square', i * 0.11, 0.1));
        });
      });
    } else if (sound === 'rage') {
      const url = censored ? PRELOAD_SOUNDS.tauntRentRageClean : PRELOAD_SOUNDS.tauntRentRage;
      const phrase = censored
        ? 'Да сколько можно платить аренду?!'
        : 'Иди нахуй со своей арендой!';
      this.playClip(url, 0.95, () => {
        this.speakFallback(phrase, 1.75, 1.3, () => {
          this.playTone(160, 0.35, 'sawtooth', 0, 0.15, 110);
        });
      });
    } else if (sound === 'fiasco') {
      this.playClip(PRELOAD_SOUNDS.tauntFiasco, 0.95, () => {
        this.speakFallback('Это фиаско, братан!', 1.7, 1.2, () => {
          this.playTone(440, 0.15, 'triangle', 0, 0.12);
          this.playTone(311, 0.4, 'sawtooth', 0.16, 0.13, 240);
        });
      });
    } else {
      // Press F голосовая озвучка + торжественный аккорд fallback
      this.playClip(PRELOAD_SOUNDS.tauntPressF, 0.95, () => {
        this.speakFallback('Помянем... Пресс эф!', 1.5, 1.15, () => {
          this.playTone(261.6, 0.6, 'sine', 0, 0.12);
          this.playTone(329.6, 0.6, 'sine', 0.05, 0.1);
          this.playTone(392.0, 0.7, 'sine', 0.1, 0.1);
        });
      });
    }
  }

  public playTick() {
    if (this.muted) return;
    this.playTone(880, 0.045, 'sine', 0, 0.08, 660);
  }

  public playBuild() {
    if (this.muted) return;
    [440, 554.37, 659.25].forEach((f, i) =>
      this.playTone(f, 0.11, 'triangle', i * 0.055, 0.13)
    );
  }

  public playBankruptcy(style: 'eralash' | 'curb' | 'wasted') {
    if (style === 'wasted') {
      // GTA Wasted тяжёлый басовый удар
      this.playTone(110, 0.9, 'sawtooth', 0, 0.22, 48);
      this.playTone(65, 1.1, 'sine', 0.05, 0.25, 38);
    } else if (style === 'eralash') {
      // Пара-пара-пам, фьють! Всё!
      [392, 440, 493, 523, 587].forEach((f, i) =>
        this.playTone(f, 0.11, 'triangle', i * 0.11, 0.13)
      );
      this.playTone(784, 0.25, 'sine', 0.65, 0.15, 1174);
    } else {
      // Curb Your Enthusiasm бодрая туба
      const notes = [587, 523, 493, 466, 493, 392];
      notes.forEach((f, i) => this.playTone(f, 0.18, 'triangle', i * 0.2, 0.14));
    }
  }
}

export const soundEngine = new SoundEngine();
