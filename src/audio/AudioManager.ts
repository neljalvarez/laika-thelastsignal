/**
 * Audio: one AudioContext created only after a real user gesture (browser autoplay rules).
 *
 *   music ─┐
 *   ambience ─┼─> master -> speakers      (each bus has its own volume from Settings)
 *   sfx ───┘
 *
 * Music uses the original LAIKA soundtrack (MP3 files) through an <audio> element.
 * Sound effects and ambience are synthesized, so there are no extra audio files.
 * Every call is guarded: audio failures can never break gameplay.
 */
import type { Settings } from "../systems/settings";

export type MusicScene = "title" | "game" | "ending" | "none";
export type AmbienceKind = "ship" | "outside" | "station" | "none";

const TRACKS: Record<Exclude<MusicScene, "none">, string[]> = {
  title: ["audio/against-the-crimson-sky.mp3"],
  game: ["audio/below-the-red-horizon.mp3", "audio/last-light-on-the-ridge.mp3"],
  ending: ["audio/across-the-crimson-sands.mp3"],
};

interface Note {
  f: number;
  t: number;
  d: number;
  to?: number;
  noise?: boolean;
  /** Band-pass Q for noise notes. */
  q?: number;
  g?: number;
  wave?: OscillatorType;
}
interface Cue {
  wave: OscillatorType;
  gain: number;
  gap: number;
  notes: Note[];
}

const seq = (fs: number[], step: number, d = step, wave?: OscillatorType): Note[] => fs.map((f, i) => ({ f, t: i * step, d, wave }));

export const CUES: Record<string, Cue> = {
  step: { wave: "square", gain: 0.05, gap: 60, notes: [{ f: 1700, t: 0, d: 0.035, noise: true, q: 1.2 }] },
  jump: { wave: "square", gain: 0.035, gap: 80, notes: [{ f: 300, to: 620, t: 0, d: 0.11 }] },
  airJump: {
    wave: "square",
    gain: 0.05,
    gap: 80,
    notes: [
      { f: 2200, to: 500, t: 0, d: 0.2, noise: true, q: 0.8, g: 1.4 },
      { f: 480, to: 900, t: 0, d: 0.1, g: 0.5 },
    ],
  },
  land: {
    wave: "triangle",
    gain: 0.09,
    gap: 120,
    notes: [
      { f: 500, t: 0, d: 0.08, noise: true, q: 0.7 },
      { f: 130, to: 60, t: 0, d: 0.09, g: 0.8 },
    ],
  },
  sniff: {
    wave: "square",
    gain: 0.07,
    gap: 300,
    notes: [
      { f: 3200, t: 0, d: 0.05, noise: true, q: 2 },
      { f: 3600, t: 0.09, d: 0.05, noise: true, q: 2 },
      { f: 3000, t: 0.18, d: 0.07, noise: true, q: 2 },
    ],
  },
  pulse: { wave: "sine", gain: 0.05, gap: 200, notes: [{ f: 420, to: 840, t: 0, d: 0.35 }] },
  ping: { wave: "sine", gain: 0.08, gap: 60, notes: [{ f: 900, t: 0, d: 0.12 }] },
  reveal: { wave: "triangle", gain: 0.08, gap: 200, notes: seq([880, 1320, 1760], 0.06, 0.08) },
  dig: {
    wave: "square",
    gain: 0.08,
    gap: 400,
    notes: [0, 0.1, 0.2, 0.3, 0.4].map((t, i) => ({ f: 700 + i * 120, t, d: 0.06, noise: true, q: 1 })),
  },
  collect: { wave: "square", gain: 0.045, gap: 100, notes: seq([784, 1047, 1319], 0.06, 0.07) },
  collectBig: { wave: "square", gain: 0.05, gap: 300, notes: [...seq([523, 659, 784, 1047], 0.08, 0.09), { f: 1319, t: 0.34, d: 0.3 }] },
  mech: {
    wave: "square",
    gain: 0.06,
    gap: 120,
    notes: [
      { f: 2500, t: 0, d: 0.05, noise: true, q: 3 },
      { f: 140, t: 0, d: 0.07, g: 0.6 },
    ],
  },
  sweep: {
    wave: "square",
    gain: 0.05,
    gap: 300,
    notes: [
      { f: 800, to: 3200, t: 0, d: 0.22, noise: true, q: 1.5 },
      { f: 3000, to: 900, t: 0.24, d: 0.22, noise: true, q: 1.5 },
    ],
  },
  repair: {
    wave: "triangle",
    gain: 0.09,
    gap: 400,
    notes: [
      { f: 2000, t: 0, d: 0.04, noise: true, q: 4 },
      { f: 2000, t: 0.08, d: 0.04, noise: true, q: 4 },
      ...seq([392, 523, 659, 784], 0.08, 0.1).map((n) => ({ ...n, t: n.t + 0.16 })),
    ],
  },
  power: {
    wave: "square",
    gain: 0.05,
    gap: 1000,
    notes: [
      { f: 110, to: 880, t: 0, d: 0.7 },
      { f: 523, t: 0.7, d: 0.5, wave: "triangle", g: 1.4 },
      { f: 659, t: 0.7, d: 0.5, wave: "triangle", g: 1.4 },
      { f: 784, t: 0.7, d: 0.6, wave: "triangle", g: 1.4 },
    ],
  },
  static: {
    wave: "square",
    gain: 0.05,
    gap: 500,
    notes: [0, 0.07, 0.15, 0.26, 0.33, 0.45].map((t, i) => ({ f: 1200 + (i % 3) * 600, t, d: 0.06 + (i % 2) * 0.05, noise: true, q: 0.6 })),
  },
  blip: { wave: "square", gain: 0.022, gap: 45, notes: [{ f: 640, t: 0, d: 0.03 }] },
  bridge: {
    wave: "square",
    gain: 0.06,
    gap: 50,
    notes: [
      { f: 1800, t: 0, d: 0.04, noise: true, q: 2 },
      { f: 220, t: 0, d: 0.05, g: 0.5 },
    ],
  },
  door: { wave: "square", gain: 0.07, gap: 400, notes: [{ f: 900, to: 200, t: 0, d: 0.45, noise: true, q: 1 }] },
  error: { wave: "square", gain: 0.04, gap: 300, notes: seq([196, 147], 0.1, 0.11) },
  checkpoint: { wave: "triangle", gain: 0.09, gap: 400, notes: seq([659, 988, 1319], 0.07, 0.1) },
  woof: {
    wave: "triangle",
    gain: 0.11,
    gap: 400,
    notes: [
      { f: 420, to: 300, t: 0, d: 0.08 },
      { f: 300, to: 230, t: 0.07, d: 0.1 },
    ],
  },
  complete: {
    wave: "square",
    gain: 0.05,
    gap: 2000,
    notes: [...seq([523, 659, 784, 1047], 0.12, 0.11), { f: 784, t: 0.55, d: 0.1 }, { f: 1047, t: 0.68, d: 0.5 }],
  },
  click: { wave: "square", gain: 0.035, gap: 50, notes: seq([660, 990], 0.035) },
  hover: { wave: "square", gain: 0.012, gap: 60, notes: [{ f: 880, t: 0, d: 0.02 }] },
  thud: { wave: "triangle", gain: 0.1, gap: 300, notes: [{ f: 90, to: 50, t: 0, d: 0.2 }] },
  // ---- Phase 2 ----
  /** Paws skidding when Laika turns at speed. */
  skid: { wave: "square", gain: 0.05, gap: 200, notes: [{ f: 2600, to: 1200, t: 0, d: 0.09, noise: true, q: 1.4 }] },
  /** Tutorial stage complete: short, bright, distinct from item pickups. */
  stageDone: { wave: "triangle", gain: 0.09, gap: 300, notes: [...seq([659, 880, 1175], 0.06, 0.08), { f: 1568, t: 0.2, d: 0.16, g: 0.7 }] },
  /** The echo sensor replays the bark as a little beep tune. */
  beepTune: { wave: "square", gain: 0.035, gap: 600, notes: [...seq([523, 784, 659, 1047], 0.11, 0.09)] },
  roverBeep: { wave: "square", gain: 0.035, gap: 500, notes: seq([988, 740], 0.09, 0.07) },
  yawn: { wave: "triangle", gain: 0.05, gap: 2000, notes: [{ f: 520, to: 760, t: 0, d: 0.22 }, { f: 760, to: 380, t: 0.22, d: 0.45 }] },
  /** Scanner tracking tick (pitch carries distance; the HUD meter shows the same thing). */
  track: { wave: "sine", gain: 0.05, gap: 80, notes: [{ f: 1100, t: 0, d: 0.06 }] },
};

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private buses!: Record<"music" | "ambience" | "sfx", GainNode>;
  private musicFade!: GainNode;
  private musicEl: HTMLAudioElement | null = null;
  private musicScene: MusicScene = "none";
  private playlistIndex = 0;
  private noise: AudioBuffer | null = null;
  private lastPlayed = new Map<string, number>();
  private amb: { wind: GainNode; hum: GainNode; machine: GainNode; station: GainNode } | null = null;
  private settings: Settings;
  private wantedMusic: MusicScene = "none";

  constructor(settings: Settings) {
    this.settings = settings;
  }

  get unlocked(): boolean {
    return this.ctx !== null && this.ctx.state === "running";
  }

  /** Must be called from a user gesture (click / key / touch). Safe to call repeatedly. */
  unlock(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.build();
      }
      if (this.ctx.state === "suspended") void this.ctx.resume();
      if (this.wantedMusic !== "none" && this.musicScene !== this.wantedMusic) this.playMusic(this.wantedMusic);
    } catch {
      this.ctx = null;
    }
  }

  private build(): void {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.connect(ctx.destination);
    this.buses = { music: ctx.createGain(), ambience: ctx.createGain(), sfx: ctx.createGain() };
    for (const b of Object.values(this.buses)) b.connect(this.master);
    this.musicFade = ctx.createGain();
    this.musicFade.connect(this.buses.music);
    // 2 s of white noise, shared by every noise sound.
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.buildAmbience();
    this.applySettings(this.settings);
  }

  applySettings(s: Settings): void {
    this.settings = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.master, t, 0.03);
    this.buses.music.gain.setTargetAtTime(s.music, t, 0.03);
    this.buses.ambience.gain.setTargetAtTime(s.ambience, t, 0.03);
    this.buses.sfx.gain.setTargetAtTime(s.sfx, t, 0.03);
  }

  // ---------------- Music ----------------

  playMusic(scene: MusicScene): void {
    this.wantedMusic = scene;
    if (!this.ctx) return;
    if (scene === this.musicScene && this.musicEl && !this.musicEl.paused) return;
    this.musicScene = scene;
    this.playlistIndex = 0;
    const t = this.ctx.currentTime;
    this.musicFade.gain.cancelScheduledValues(t);
    this.musicFade.gain.setTargetAtTime(0, t, 0.15);
    const start = () => {
      if (this.musicScene !== scene) return;
      if (scene === "none") {
        this.musicEl?.pause();
        return;
      }
      this.startTrack();
    };
    window.setTimeout(start, this.musicEl && !this.musicEl.paused ? 450 : 0);
  }

  private startTrack(): void {
    if (!this.ctx || this.musicScene === "none") return;
    try {
      if (!this.musicEl) {
        this.musicEl = new Audio();
        this.musicEl.preload = "auto";
        const src = this.ctx.createMediaElementSource(this.musicEl);
        src.connect(this.musicFade);
        this.musicEl.addEventListener("ended", () => {
          if (this.musicScene === "ending") {
            this.musicScene = "none";
            this.playMusic("game");
            return;
          }
          this.playlistIndex += 1;
          this.startTrack();
        });
      }
      const list = TRACKS[this.musicScene];
      this.musicEl.src = list[this.playlistIndex % list.length];
      this.musicEl.currentTime = 0;
      void this.musicEl.play().catch(() => undefined);
      const t = this.ctx.currentTime;
      this.musicFade.gain.cancelScheduledValues(t);
      this.musicFade.gain.setValueAtTime(0, t);
      this.musicFade.gain.linearRampToValueAtTime(1, t + 1.5);
    } catch {
      /* ignore */
    }
  }

  /** Temporarily lowers the music (e.g. while a radio transmission plays). */
  duckMusic(on: boolean): void {
    if (!this.ctx) return;
    this.musicFade.gain.setTargetAtTime(on ? 0.35 : 1, this.ctx.currentTime, 0.2);
  }

  pauseAll(paused: boolean): void {
    if (!this.ctx) return;
    try {
      if (paused) void this.ctx.suspend();
      else void this.ctx.resume();
    } catch {
      /* ignore */
    }
  }

  // ---------------- Ambience ----------------

  private buildAmbience(): void {
    const ctx = this.ctx!;
    const out = this.buses.ambience;
    // Wind: looping noise through a slowly wandering band-pass filter.
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = this.noise;
    windSrc.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 380;
    bp.Q.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 180;
    lfo.connect(lfoGain).connect(bp.frequency);
    const wind = ctx.createGain();
    wind.gain.value = 0;
    windSrc.connect(bp).connect(wind).connect(out);
    windSrc.start();
    lfo.start();
    // Ship / station hum.
    const hum = ctx.createGain();
    hum.gain.value = 0;
    for (const [f, type, g] of [
      [55, "sine", 0.6],
      [110, "triangle", 0.15],
    ] as Array<[number, OscillatorType, number]>) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(hum);
      o.start();
    }
    hum.connect(out);
    // Outpost machinery once power is back.
    const machine = ctx.createGain();
    machine.gain.value = 0;
    const mo = ctx.createOscillator();
    mo.type = "sawtooth";
    mo.frequency.value = 82;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 260;
    mo.connect(lp).connect(machine).connect(out);
    mo.start();
    // Station: two slightly detuned tones that slowly beat - eerie and quiet.
    const station = ctx.createGain();
    station.gain.value = 0;
    for (const f of [220, 221.3, 329.6]) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.value = f;
      const og = ctx.createGain();
      og.gain.value = 0.12;
      o.connect(og).connect(station);
      o.start();
    }
    station.connect(out);
    this.amb = { wind, hum, machine, station };
  }

  /** Smoothly sets the ambience mix. `machine` is 0..1 (distance to powered machines). */
  setAmbience(kind: AmbienceKind, machine = 0): void {
    if (!this.ctx || !this.amb) return;
    const t = this.ctx.currentTime;
    const set = (g: GainNode, v: number) => g.gain.setTargetAtTime(v, t, 0.6);
    set(this.amb.wind, kind === "outside" ? 0.55 : kind === "none" ? 0 : 0.12);
    set(this.amb.hum, kind === "ship" ? 0.09 : 0);
    set(this.amb.station, kind === "station" ? 0.05 : 0);
    set(this.amb.machine, kind === "outside" ? machine * 0.05 : 0);
  }

  // ---------------- Sound effects ----------------

  sfx(name: string, opts: { pitch?: number; volume?: number } = {}): void {
    const ctx = this.ctx;
    const cue = CUES[name];
    if (!ctx || !cue || ctx.state !== "running") return;
    const now = performance.now();
    if (now - (this.lastPlayed.get(name) ?? 0) < cue.gap) return;
    this.lastPlayed.set(name, now);
    try {
      const pitch = opts.pitch ?? 1;
      const base = ctx.currentTime + 0.005;
      for (const n of cue.notes) {
        const g = ctx.createGain();
        const peak = cue.gain * (n.g ?? 1) * (opts.volume ?? 1);
        const t0 = base + n.t;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + n.d);
        g.connect(this.buses.sfx);
        if (n.noise && this.noise) {
          const src = ctx.createBufferSource();
          src.buffer = this.noise;
          const f = ctx.createBiquadFilter();
          f.type = "bandpass";
          f.Q.value = n.q ?? 1;
          f.frequency.setValueAtTime(n.f * pitch, t0);
          if (n.to) f.frequency.exponentialRampToValueAtTime(n.to * pitch, t0 + n.d);
          src.connect(f).connect(g);
          src.start(t0, Math.random() * 1.5, n.d + 0.05);
        } else {
          const o = ctx.createOscillator();
          o.type = n.wave ?? cue.wave;
          o.frequency.setValueAtTime(n.f * pitch, t0);
          if (n.to) o.frequency.exponentialRampToValueAtTime(n.to * pitch, t0 + n.d);
          o.connect(g);
          o.start(t0);
          o.stop(t0 + n.d + 0.05);
        }
      }
    } catch {
      /* never let audio break the game */
    }
  }
}
