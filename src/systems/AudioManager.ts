// Sound effect types
export const SOUND_EFFECTS = [
  "eat_apple",
  "combo_activate",
  "snake_death",
  "tail_shed",
  "projectile_fire",
  "projectile_hit",
  "player_join",
  "player_ready",
  "game_start",
  "countdown_tick",
  "ui_navigate",
  "rain_ambient",
] as const;

export type SoundEffect = (typeof SOUND_EFFECTS)[number];

// Sound generator function type
type SoundGenerator = (ctx: AudioContext, destination: AudioNode) => void;

export class AudioManager {
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private effectsGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  // Sound generators
  private soundGenerators: Map<SoundEffect, SoundGenerator> = new Map();

  // Settings
  private masterVolume: number = 0.7;
  private effectsVolume: number = 1.0;
  private musicVolume: number = 0.5;
  private isMuted: boolean = false;

  // Active sounds for ambient effects
  private activeAmbient: Map<
    string,
    { source: AudioBufferSourceNode | OscillatorNode; gain: GainNode }
  > = new Map();

  // Rain noise buffer
  private noiseBuffer: AudioBuffer | null = null;

  // Background music state
  private musicPlaying: boolean = false;
  private musicSchedulerId: number | null = null;
  private currentBeat: number = 0;
  private musicTempo: number = 140; // BPM
  private activeOscillators: Set<OscillatorNode> = new Set();

  constructor() {
    this.initSoundGenerators();
  }

  // Initialize audio context (must be called after user interaction)
  async initialize(): Promise<void> {
    if (this.audioContext) return;

    try {
      this.audioContext = new AudioContext();

      // Create gain nodes
      this.masterGain = this.audioContext.createGain();
      this.masterGain.connect(this.audioContext.destination);

      this.effectsGain = this.audioContext.createGain();
      this.effectsGain.connect(this.masterGain);

      this.musicGain = this.audioContext.createGain();
      this.musicGain.connect(this.masterGain);

      this.updateVolumes();

      // Generate noise buffer for rain
      this.noiseBuffer = this.createNoiseBuffer();
    } catch (e) {
      console.error("Failed to initialize audio:", e);
    }
  }

  // Ensure context is running (call on user interaction)
  async resume(): Promise<void> {
    if (this.audioContext?.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  private initSoundGenerators(): void {
    // Eat apple - short pop
    this.soundGenerators.set("eat_apple", (ctx, dest) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.05);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    });

    // Combo activate - magical chime
    this.soundGenerators.set("combo_activate", (ctx, dest) => {
      const frequencies = [523, 659, 784, 1047]; // C5, E5, G5, C6

      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const startTime = ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.4);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(startTime);
        osc.stop(startTime + 0.4);
      });
    });

    // Snake death - descending sad tone
    this.soundGenerators.set("snake_death", (ctx, dest) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(400, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.5);

      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.5);

      // Add a "wah wah" effect
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc2.type = "triangle";
      osc2.frequency.setValueAtTime(300, ctx.currentTime + 0.15);
      osc2.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.4);

      gain2.gain.setValueAtTime(0, ctx.currentTime + 0.15);
      gain2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.2);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);

      osc2.connect(gain2);
      gain2.connect(dest);

      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.5);
    });

    // Tail shed - crumbling/breaking sound
    this.soundGenerators.set("tail_shed", (ctx, dest) => {
      // Create noise burst
      const bufferSize = ctx.sampleRate * 0.3;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(2000, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start(ctx.currentTime);
    });

    // Projectile fire - whoosh
    this.soundGenerators.set("projectile_fire", (ctx, dest) => {
      const bufferSize = ctx.sampleRate * 0.2;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.setValueAtTime(1000, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(
        4000,
        ctx.currentTime + 0.1
      );
      filter.Q.value = 2;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);

      noise.start(ctx.currentTime);
    });

    // Projectile hit - ding/transform
    this.soundGenerators.set("projectile_hit", (ctx, dest) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.05);

      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);

      // Add sparkle
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.05);

      gain2.gain.setValueAtTime(0, ctx.currentTime);
      gain2.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);

      osc2.connect(gain2);
      gain2.connect(dest);

      osc2.start(ctx.currentTime);
      osc2.stop(ctx.currentTime + 0.25);
    });

    // Player join - welcome jingle
    this.soundGenerators.set("player_join", (ctx, dest) => {
      const notes = [392, 523, 659]; // G4, C5, E5

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const startTime = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.25, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + 0.2);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(startTime);
        osc.stop(startTime + 0.2);
      });
    });

    // Player ready - confirmation beep
    this.soundGenerators.set("player_ready", (ctx, dest) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "square";
      osc.frequency.setValueAtTime(880, ctx.currentTime);

      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.1);

      // Second beep
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();

      osc2.type = "square";
      osc2.frequency.setValueAtTime(1100, ctx.currentTime);

      gain2.gain.setValueAtTime(0, ctx.currentTime + 0.1);
      gain2.gain.linearRampToValueAtTime(0.15, ctx.currentTime + 0.11);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);

      osc2.connect(gain2);
      gain2.connect(dest);

      osc2.start(ctx.currentTime + 0.1);
      osc2.stop(ctx.currentTime + 0.2);
    });

    // Game start - energetic fanfare
    this.soundGenerators.set("game_start", (ctx, dest) => {
      const notes = [523, 659, 784, 1047, 784, 1047]; // C5, E5, G5, C6, G5, C6
      const durations = [0.1, 0.1, 0.1, 0.2, 0.1, 0.3];
      let time = 0;

      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "square";
        osc.frequency.setValueAtTime(freq, ctx.currentTime);

        const startTime = ctx.currentTime + time;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.01);
        gain.gain.setValueAtTime(0.2, startTime + durations[i] * 0.8);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + durations[i]);

        osc.connect(gain);
        gain.connect(dest);

        osc.start(startTime);
        osc.stop(startTime + durations[i]);

        time += durations[i];
      });
    });

    // Countdown tick
    this.soundGenerators.set("countdown_tick", (ctx, dest) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(660, ctx.currentTime);

      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
    });

    // UI navigate - soft click
    this.soundGenerators.set("ui_navigate", (ctx, dest) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1000, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.03);

      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);

      osc.connect(gain);
      gain.connect(dest);

      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.05);
    });

    // Rain ambient - handled separately with looping noise
    this.soundGenerators.set("rain_ambient", () => {
      // This is handled by startAmbient/stopAmbient
    });
  }

  private createNoiseBuffer(): AudioBuffer {
    if (!this.audioContext) throw new Error("Audio context not initialized");

    const sampleRate = this.audioContext.sampleRate;
    const duration = 2; // 2 second loop
    const bufferSize = sampleRate * duration;
    const buffer = this.audioContext.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);

    // Generate pink-ish noise for rain
    let b0 = 0,
      b1 = 0,
      b2 = 0,
      b3 = 0,
      b4 = 0,
      b5 = 0,
      b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;

      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.969 * b2 + white * 0.153852;
      b3 = 0.8665 * b3 + white * 0.3104856;
      b4 = 0.55 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.016898;

      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }

    return buffer;
  }

  // Play a sound effect
  play(sound: SoundEffect): void {
    if (!this.audioContext || !this.effectsGain || this.isMuted) return;

    // Ensure context is running
    if (this.audioContext.state === "suspended") {
      this.audioContext.resume();
    }

    const generator = this.soundGenerators.get(sound);
    if (generator && sound !== "rain_ambient") {
      generator(this.audioContext, this.effectsGain);
    }
  }

  // Start ambient sound (like rain)
  startAmbient(id: string, type: "rain"): void {
    if (!this.audioContext || !this.effectsGain || this.isMuted) return;
    if (this.activeAmbient.has(id)) return;

    if (type === "rain" && this.noiseBuffer) {
      const source = this.audioContext.createBufferSource();
      source.buffer = this.noiseBuffer;
      source.loop = true;

      const filter = this.audioContext.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 3000;

      const gain = this.audioContext.createGain();
      gain.gain.setValueAtTime(0, this.audioContext.currentTime);
      gain.gain.linearRampToValueAtTime(
        0.3,
        this.audioContext.currentTime + 0.5
      );

      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.effectsGain);

      source.start();

      this.activeAmbient.set(id, { source, gain });
    }
  }

  // Stop ambient sound
  stopAmbient(id: string): void {
    const ambient = this.activeAmbient.get(id);
    if (!ambient || !this.audioContext) return;

    // Fade out
    ambient.gain.gain.linearRampToValueAtTime(
      0,
      this.audioContext.currentTime + 0.5
    );

    // Stop after fade
    setTimeout(() => {
      try {
        ambient.source.stop();
      } catch {
        // Already stopped
      }
      this.activeAmbient.delete(id);
    }, 500);
  }

  // Stop all ambient sounds
  stopAllAmbient(): void {
    for (const id of this.activeAmbient.keys()) {
      this.stopAmbient(id);
    }
  }

  // Volume controls
  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  setEffectsVolume(volume: number): void {
    this.effectsVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  setMusicVolume(volume: number): void {
    this.musicVolume = Math.max(0, Math.min(1, volume));
    this.updateVolumes();
  }

  getMasterVolume(): number {
    return this.masterVolume;
  }

  getEffectsVolume(): number {
    return this.effectsVolume;
  }

  getMusicVolume(): number {
    return this.musicVolume;
  }

  // Mute toggle
  setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.updateVolumes();

    if (muted) {
      this.stopAllAmbient();
      this.stopMusic();
    }
  }

  isMutedState(): boolean {
    return this.isMuted;
  }

  toggleMute(): boolean {
    this.setMuted(!this.isMuted);
    return this.isMuted;
  }

  private updateVolumes(): void {
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : this.masterVolume;
    }
    if (this.effectsGain) {
      this.effectsGain.gain.value = this.effectsVolume;
    }
    if (this.musicGain) {
      this.musicGain.gain.value = this.musicVolume;
    }
  }

  // ============ Background Music ============

  // Note frequencies for chiptune music
  private noteToFreq(note: number): number {
    // A4 = 440Hz, note 69
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  // Melody patterns (MIDI note numbers, 0 = rest)
  private readonly melodyPattern: number[] = [
    // Bar 1 - Upbeat intro
    72, 0, 76, 0, 79, 0, 76, 0,
    // Bar 2
    74, 0, 77, 0, 81, 0, 77, 0,
    // Bar 3
    76, 0, 79, 0, 83, 0, 79, 0,
    // Bar 4
    74, 0, 77, 0, 81, 79, 77, 0,
    // Bar 5 - Variation
    72, 72, 0, 76, 79, 0, 76, 0,
    // Bar 6
    74, 74, 0, 77, 81, 0, 77, 0,
    // Bar 7
    76, 76, 0, 79, 83, 84, 83, 0,
    // Bar 8 - Resolution
    81, 0, 79, 0, 76, 0, 72, 0,
  ];

  // Bass pattern (lower octave)
  private readonly bassPattern: number[] = [
    // Bar 1
    48, 0, 0, 0, 48, 0, 0, 0,
    // Bar 2
    50, 0, 0, 0, 50, 0, 0, 0,
    // Bar 3
    52, 0, 0, 0, 52, 0, 0, 0,
    // Bar 4
    50, 0, 0, 0, 50, 0, 48, 0,
    // Bar 5
    48, 0, 48, 0, 48, 0, 0, 0,
    // Bar 6
    50, 0, 50, 0, 50, 0, 0, 0,
    // Bar 7
    52, 0, 52, 0, 52, 0, 0, 0,
    // Bar 8
    50, 0, 48, 0, 45, 0, 48, 0,
  ];

  // Arpeggio/harmony pattern
  private readonly arpeggioPattern: number[] = [
    // Bar 1
    60, 64, 67, 64, 60, 64, 67, 64,
    // Bar 2
    62, 65, 69, 65, 62, 65, 69, 65,
    // Bar 3
    64, 67, 71, 67, 64, 67, 71, 67,
    // Bar 4
    62, 65, 69, 65, 62, 65, 69, 65,
    // Bar 5
    60, 64, 67, 64, 60, 64, 67, 64,
    // Bar 6
    62, 65, 69, 65, 62, 65, 69, 65,
    // Bar 7
    64, 67, 71, 67, 64, 67, 71, 67,
    // Bar 8
    62, 65, 69, 62, 60, 64, 67, 60,
  ];

  // Play a chiptune note
  private playNote(
    freq: number,
    startTime: number,
    duration: number,
    type: OscillatorType,
    volume: number
  ): void {
    if (!this.audioContext || !this.musicGain) return;

    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    // Chiptune envelope - quick attack, sustain, quick release
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + 0.01);
    gain.gain.setValueAtTime(volume, startTime + duration - 0.02);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(startTime);
    osc.stop(startTime + duration);

    // Track active oscillators for cleanup
    this.activeOscillators.add(osc);
    osc.onended = () => {
      this.activeOscillators.delete(osc);
    };
  }

  // Schedule the next batch of notes
  private scheduleMusic(): void {
    if (!this.audioContext || !this.musicPlaying) return;

    const beatDuration = 60 / this.musicTempo / 2; // 8th notes
    const currentTime = this.audioContext.currentTime;
    const scheduleAhead = 0.2; // Schedule 200ms ahead

    // Schedule a few beats ahead
    for (let i = 0; i < 4; i++) {
      const beatIndex = (this.currentBeat + i) % this.melodyPattern.length;
      const noteTime = currentTime + i * beatDuration;

      if (noteTime > currentTime + scheduleAhead) break;

      // Melody (square wave - classic chiptune lead)
      const melodyNote = this.melodyPattern[beatIndex];
      if (melodyNote > 0) {
        this.playNote(
          this.noteToFreq(melodyNote),
          noteTime,
          beatDuration * 0.8,
          "square",
          0.15
        );
      }

      // Bass (triangle wave - softer bass)
      const bassNote = this.bassPattern[beatIndex];
      if (bassNote > 0) {
        this.playNote(
          this.noteToFreq(bassNote),
          noteTime,
          beatDuration * 0.9,
          "triangle",
          0.2
        );
      }

      // Arpeggio (pulse-ish square, quieter)
      const arpNote = this.arpeggioPattern[beatIndex];
      if (arpNote > 0) {
        this.playNote(
          this.noteToFreq(arpNote),
          noteTime,
          beatDuration * 0.5,
          "square",
          0.08
        );
      }
    }

    this.currentBeat = (this.currentBeat + 1) % this.melodyPattern.length;
  }

  // Start background music
  startMusic(): void {
    if (this.musicPlaying || !this.audioContext || this.isMuted) return;

    this.musicPlaying = true;
    this.currentBeat = 0;

    // Fade in music
    if (this.musicGain) {
      this.musicGain.gain.setValueAtTime(0, this.audioContext.currentTime);
      this.musicGain.gain.linearRampToValueAtTime(
        this.musicVolume,
        this.audioContext.currentTime + 1
      );
    }

    // Start scheduling loop
    const scheduleInterval = 100; // ms
    this.musicSchedulerId = window.setInterval(() => {
      this.scheduleMusic();
    }, scheduleInterval);

    // Initial schedule
    this.scheduleMusic();
  }

  // Stop background music
  stopMusic(): void {
    if (!this.musicPlaying) return;

    this.musicPlaying = false;

    // Clear scheduler
    if (this.musicSchedulerId !== null) {
      clearInterval(this.musicSchedulerId);
      this.musicSchedulerId = null;
    }

    // Fade out and stop all active oscillators
    if (this.audioContext && this.musicGain) {
      const fadeTime = 0.5;
      this.musicGain.gain.linearRampToValueAtTime(
        0,
        this.audioContext.currentTime + fadeTime
      );

      // Stop oscillators after fade
      setTimeout(() => {
        for (const osc of this.activeOscillators) {
          try {
            osc.stop();
          } catch {
            // Already stopped
          }
        }
        this.activeOscillators.clear();
      }, fadeTime * 1000);
    }
  }

  // Check if music is playing
  isMusicPlaying(): boolean {
    return this.musicPlaying;
  }

  // Toggle music
  toggleMusic(): boolean {
    if (this.musicPlaying) {
      this.stopMusic();
    } else {
      this.startMusic();
    }
    return this.musicPlaying;
  }

  // Cleanup
  dispose(): void {
    this.stopMusic();
    this.stopAllAmbient();

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.masterGain = null;
    this.effectsGain = null;
    this.musicGain = null;
  }
}

// Singleton instance
export const audioManager = new AudioManager();
