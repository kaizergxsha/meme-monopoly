import type { TauntSoundId } from '../../shared/types.ts';

const PRELOAD_SOUNDS = {
  gain: '/sounds/gain.mp3',
  spend: '/sounds/spend.mp3',
  tauntBalls: '/sounds/taunt_balls.mp3',
  tauntMiBombo: '/sounds/taunt_mi_bombo.mp3',
  tauntBlyat: '/sounds/taunt_blyat.mp3',
  tauntScream: '/sounds/taunt_scream.mp3',
  tauntBruh: '/sounds/taunt_bruh.mp3',
  tauntLaugh: '/sounds/taunt_laugh.mp3',
  tauntCasino: '/sounds/taunt_casino.mp3',
  tauntGay: '/sounds/taunt_gay.mp3',
  tauntCoalPlant: '/sounds/taunt_coal_plant.mp3',
  tauntBatyaDoma: '/sounds/taunt_batya_doma.mp3',
  tauntPodstavili: '/sounds/taunt_podstavili.mp3',
  tauntNetIdi: '/sounds/taunt_net_idi.mp3',
  tauntTck: '/sounds/taunt_tck.mp3',
  tauntZryaPolez: '/sounds/taunt_zrya_polez.mp3',
  tauntAmAmAm: '/sounds/taunt_am_am_am.mp3',
  tauntSpasiboHorosho: '/sounds/taunt_spasibo_horosho.mp3',
} as const;

const TAUNT_SOUND_CONFIG: Record<TauntSoundId, { url: string; phrase: string; pitch: number }> = {
  balls: { url: PRELOAD_SOUNDS.tauntBalls, phrase: 'Большие яйца!', pitch: 0.9 },
  mi_bombo: { url: PRELOAD_SOUNDS.tauntMiBombo, phrase: 'Ми бомбо!', pitch: 1.4 },
  blyat: { url: PRELOAD_SOUNDS.tauntBlyat, phrase: 'Бляяять!', pitch: 1.1 },
  scream: { url: PRELOAD_SOUNDS.tauntScream, phrase: 'Ааааа!', pitch: 1.6 },
  bruh: { url: PRELOAD_SOUNDS.tauntBruh, phrase: 'Брух!', pitch: 0.85 },
  laugh: { url: PRELOAD_SOUNDS.tauntLaugh, phrase: 'Ха-ха-ха!', pitch: 1.5 },
  casino: { url: PRELOAD_SOUNDS.tauntCasino, phrase: 'Казино!', pitch: 1.2 },
  gay: { url: PRELOAD_SOUNDS.tauntGay, phrase: 'Гей!', pitch: 0.8 },
  coal_plant: { url: PRELOAD_SOUNDS.tauntCoalPlant, phrase: 'Угольный заводик! Покупаю!', pitch: 0.92 },
  batya_doma: { url: PRELOAD_SOUNDS.tauntBatyaDoma, phrase: 'Батя дома!', pitch: 0.9 },
  podstavili: { url: PRELOAD_SOUNDS.tauntPodstavili, phrase: 'Подставили меня!', pitch: 1.2 },
  net_idi: { url: PRELOAD_SOUNDS.tauntNetIdi, phrase: 'Нет, иди!', pitch: 0.85 },
  tck: { url: PRELOAD_SOUNDS.tauntTck, phrase: 'ТЦК и кнопка вызов!', pitch: 1.0 },
  zrya_polez: { url: PRELOAD_SOUNDS.tauntZryaPolez, phrase: 'Ох, зря я туда полез!', pitch: 0.8 },
  am_am_am: { url: PRELOAD_SOUNDS.tauntAmAmAm, phrase: 'Ам-ам-ам!', pitch: 1.1 },
  spasibo_horosho: { url: PRELOAD_SOUNDS.tauntSpasiboHorosho, phrase: 'Спасибо, хорошо!', pitch: 1.05 },
};

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
  private stopCurrentTaunt: (() => void) | null = null;

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

  private playClip(
    url: string,
    volume: number,
    fallback: () => void,
    onStopRegister?: (stopFn: () => void) => void
  ) {
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
        onStopRegister?.(() => {
          try {
            src.stop();
          } catch {
            // ignore
          }
          this.activeSources.delete(src);
        });
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
        onStopRegister?.(() => {
          try {
            clip.pause();
            clip.currentTime = 0;
          } catch {
            // ignore
          }
          cleanup();
        });

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

  private masterGain: GainNode | null = null;

  private ensureMasterBus(ctx: AudioContext): AudioNode {
    if (this.masterGain) return this.masterGain;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.setValueAtTime(-14, ctx.currentTime);
    comp.knee.setValueAtTime(18, ctx.currentTime);
    comp.ratio.setValueAtTime(4, ctx.currentTime);
    comp.attack.setValueAtTime(0.004, ctx.currentTime);
    comp.release.setValueAtTime(0.18, ctx.currentTime);

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.9, ctx.currentTime);
    master.connect(comp);
    comp.connect(ctx.destination);
    this.masterGain = master;
    return master;
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'triangle',
    delay = 0,
    gainVal = 0.14,
    slideToFreq?: number,
    filterCutoff?: number
  ) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideToFreq), now + duration);
    }

    const attack = Math.min(0.008, duration * 0.2);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    const dest = this.ensureMasterBus(ctx);
    if (filterCutoff || type === 'sawtooth' || type === 'square') {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      const startCut = filterCutoff ?? (type === 'sawtooth' ? 1400 : 1800);
      filter.frequency.setValueAtTime(startCut, now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(240, startCut * 0.45), now + duration);
      filter.Q.setValueAtTime(1.2, now);
      osc.connect(filter);
      filter.connect(gain);
      osc.onended = () => {
        osc.disconnect();
        filter.disconnect();
        gain.disconnect();
      };
    } else {
      osc.connect(gain);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    }

    gain.connect(dest);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  }

  // Тёплый стерео-голос с детюном и фильтром для дорогих UI-аккордов
  private playLuxuryVoice(
    freq: number,
    duration: number,
    delay = 0,
    gainVal = 0.1,
    cutoff = 2600
  ) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const dest = this.ensureMasterBus(ctx);

    const oscA = ctx.createOscillator();
    const oscB = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    oscA.type = 'triangle';
    oscB.type = 'sine';
    oscA.frequency.setValueAtTime(freq, now);
    oscB.frequency.setValueAtTime(freq * 1.0035, now); // мягкий хорус-детюн

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(320, cutoff * 0.35), now + duration);
    filter.Q.setValueAtTime(0.9, now);

    const attack = Math.min(0.012, duration * 0.22);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainVal, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    oscA.connect(filter);
    oscB.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    oscA.onended = () => {
      oscA.disconnect();
      oscB.disconnect();
      filter.disconnect();
      gain.disconnect();
    };

    oscA.start(now);
    oscB.start(now);
    oscA.stop(now + duration + 0.03);
    oscB.stop(now + duration + 0.03);
  }

  // Короткий фильтрованный шумовой транзиент (щелчок костей, свайп карты, удар замка)
  private playNoiseBurst(
    duration: number,
    delay: number,
    startFreq: number,
    endFreq: number,
    q = 2.0,
    gainVal = 0.14,
    filterType: BiquadFilterType = 'bandpass'
  ) {
    const ctx = this.ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime + delay;
    const sampleCount = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const noiseBuf = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      const env = Math.pow(1 - i / sampleCount, 1.4);
      data[i] = (Math.random() * 2 - 1) * env;
    }

    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.setValueAtTime(q, now);
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(60, endFreq), now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.ensureMasterBus(ctx));
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    src.start(now);
  }

  private playCardFlipSwish() {
    this.playNoiseBurst(0.085, 0, 750, 3200, 1.8, 0.13, 'bandpass');
  }

  // Тактильный перестук тяжёлых акриловых кубиков по сукну стола
  public playDice() {
    if (this.muted) return;
    const taps = [
      { t: 0.0, f: 245, n: 1950, g: 0.16 },
      { t: 0.052, f: 315, n: 2350, g: 0.14 },
      { t: 0.112, f: 270, n: 2100, g: 0.12 },
      { t: 0.182, f: 195, n: 1500, g: 0.15 },
    ];
    for (const tap of taps) {
      this.playNoiseBurst(0.028, tap.t, tap.n, tap.n * 0.45, 3.2, tap.g, 'bandpass');
      this.playTone(tap.f, 0.042, 'triangle', tap.t, 0.1, tap.f * 0.58);
    }
    // Мягкий вес сукна в финале броска
    this.playTone(96, 0.09, 'sine', 0.18, 0.14, 48);
  }

  public playCash() {
    this.playCashGain();
  }

  // Звук начисления денег (загруженный трек /sounds/gain.mp3, слышит только получатель)
  public playCashGain() {
    this.playClip(PRELOAD_SOUNDS.gain, 0.7, () => {
      this.playLuxuryVoice(1046.5, 0.18, 0, 0.12, 3400);
      this.playLuxuryVoice(1318.51, 0.18, 0.065, 0.13, 3800);
      this.playLuxuryVoice(1567.98, 0.22, 0.13, 0.14, 4200);
      this.playLuxuryVoice(2093.0, 0.42, 0.195, 0.16, 4800);
    });
  }

  // Звук оплаты / траты денег (загруженный трек /sounds/spend.mp3, слышит только плательщик)
  public playCashSpend() {
    this.playClip(PRELOAD_SOUNDS.spend, 0.7, () => {
      this.playLuxuryVoice(1174.66, 0.16, 0, 0.13, 2800);
      this.playLuxuryVoice(880.0, 0.34, 0.085, 0.14, 2200);
    });
  }

  // Попадание в Учебку / облава ТЦК: тяжёлый sub-slam + лязг засова + тёплая кинематографичная сирена
  public playSiren() {
    if (this.muted) return;
    // Тяжёлый удар ворот Учебки
    this.playTone(135, 0.36, 'sine', 0, 0.24, 38);
    this.playNoiseBurst(0.11, 0.01, 1400, 260, 1.5, 0.2, 'lowpass');
    // Металлический засов
    this.playTone(980, 0.14, 'triangle', 0.04, 0.08, 420, 1800);
    // Современная фильтрованная сирена (2 цикла)
    this.playTone(540, 0.26, 'sawtooth', 0.12, 0.085, 840, 1350);
    this.playTone(840, 0.26, 'sawtooth', 0.38, 0.085, 520, 1150);
    this.playTone(540, 0.24, 'sawtooth', 0.64, 0.075, 800, 1200);
    this.playTone(800, 0.3, 'sawtooth', 0.88, 0.065, 480, 950);
  }

  // Грустный тромбон («Инвестировал в говно») через тёплый духовой lowpass-фильтр
  public playSadTrombone() {
    this.playTone(293.66, 0.28, 'sawtooth', 0, 0.13, undefined, 980);
    this.playTone(277.18, 0.28, 'sawtooth', 0.3, 0.13, undefined, 920);
    this.playTone(261.63, 0.28, 'sawtooth', 0.6, 0.13, undefined, 860);
    this.playTone(246.94, 0.82, 'sawtooth', 0.9, 0.15, 216, 760);
  }

  // Премиальный звук переворота и открытия карточки «Шанс»
  public playChanceReveal(tone: 'good' | 'bad' | 'move' | 'special' = 'special') {
    if (this.muted) return;
    this.playCardFlipSwish();
    this.playTone(320, 0.06, 'sine', 0, 0.07, 780);

    if (tone === 'good') {
      this.playLuxuryVoice(523.25, 0.18, 0.045, 0.11, 3200);
      this.playLuxuryVoice(659.25, 0.18, 0.1, 0.12, 3600);
      this.playLuxuryVoice(783.99, 0.22, 0.155, 0.12, 4000);
      this.playLuxuryVoice(1046.5, 0.38, 0.215, 0.14, 4600);
    } else if (tone === 'bad') {
      this.playLuxuryVoice(587.33, 0.16, 0.05, 0.11, 1900);
      this.playLuxuryVoice(554.37, 0.16, 0.12, 0.11, 1700);
      this.playLuxuryVoice(440.0, 0.22, 0.19, 0.12, 1500);
      this.playTone(130.81, 0.42, 'sawtooth', 0.24, 0.12, 108, 680);
    } else if (tone === 'move') {
      this.playNoiseBurst(0.24, 0.04, 400, 2600, 2.2, 0.12, 'bandpass');
      this.playLuxuryVoice(587.33, 0.12, 0.05, 0.1, 2800);
      this.playLuxuryVoice(783.99, 0.14, 0.11, 0.11, 3400);
      this.playLuxuryVoice(1174.66, 0.28, 0.18, 0.13, 4200);
    } else {
      this.playLuxuryVoice(698.46, 0.18, 0.045, 0.1, 3000);
      this.playLuxuryVoice(880.0, 0.18, 0.1, 0.11, 3400);
      this.playLuxuryVoice(1046.5, 0.22, 0.155, 0.12, 3800);
      this.playLuxuryVoice(1318.51, 0.36, 0.215, 0.13, 4400);
    }
  }

  public playTaunt(sound: TauntSoundId, _censored = false) {
    if (this.muted) return;
    if (this.stopCurrentTaunt) {
      this.stopCurrentTaunt();
      this.stopCurrentTaunt = null;
    }

    const cfg = TAUNT_SOUND_CONFIG[sound];
    if (!cfg) return;

    this.playClip(
      cfg.url,
      0.95,
      () => {
        this.speakFallback(cfg.phrase, cfg.pitch, 1.2, () => {
          this.playLuxuryVoice(440, 0.16, 0, 0.11, 2200);
        });
      },
      (stopFn) => {
        this.stopCurrentTaunt = stopFn;
      }
    );
  }

  // Швейцарский тактильный клик для таймера и шагов
  public playTick() {
    if (this.muted) return;
    this.playNoiseBurst(0.014, 0, 2600, 1200, 2.5, 0.07, 'highpass');
    this.playTone(1320, 0.032, 'sine', 0, 0.065, 680);
  }

  // Дорогое золотое подтверждение постройки филиала / улучшения
  public playBuild() {
    if (this.muted) return;
    this.playNoiseBurst(0.025, 0, 1800, 900, 2.0, 0.08, 'bandpass');
    this.playTone(110, 0.12, 'sine', 0, 0.12, 72);
    [440, 554.37, 659.25, 987.77].forEach((f, i) =>
      this.playLuxuryVoice(f, 0.24, i * 0.048, 0.11, 3400)
    );
  }

  public playBankruptcy(style: 'eralash' | 'curb' | 'wasted') {
    if (style === 'wasted') {
      // GTA Wasted кинематографичный басовый удар + шумовой спад
      this.playNoiseBurst(0.35, 0, 900, 120, 1.2, 0.2, 'lowpass');
      this.playTone(110, 0.95, 'sawtooth', 0, 0.2, 46, 520);
      this.playTone(65, 1.15, 'sine', 0.04, 0.26, 36);
    } else if (style === 'eralash') {
      [392, 440, 493, 523, 587].forEach((f, i) =>
        this.playLuxuryVoice(f, 0.14, i * 0.105, 0.12, 2400)
      );
      this.playLuxuryVoice(784, 0.3, 0.62, 0.14, 3400);
    } else {
      const notes = [587, 523, 493, 466, 493, 392];
      notes.forEach((f, i) => this.playTone(f, 0.2, 'sawtooth', i * 0.2, 0.12, undefined, 950));
    }
  }
}

export const soundEngine = new SoundEngine();
