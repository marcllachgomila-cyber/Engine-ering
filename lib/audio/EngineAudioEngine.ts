import { Aspiration, EngineConfig, EngineLayout } from "../physics/types";

interface HarmonicVoice {
  osc: OscillatorNode;
  gain: GainNode;
  multiplier: number;
}

interface HarmonicSpec {
  multiplier: number;
  amp: number;
  type: OscillatorType;
}

function harmonicProfile(cylinders: number, layout: EngineLayout): HarmonicSpec[] {
  // Inline layouts fire more evenly, giving a smoother harmonic spectrum
  // dominated by the fundamental. V/flat layouts have uneven firing
  // intervals, which emphasizes odd harmonics and gives a rougher, more
  // textured note. More cylinders add a touch more upper-harmonic content
  // (smoother top end), kept modest so the note stays deep rather than shrill.
  const unevenBoost = layout === "v" ? 1.3 : layout === "flat" ? 1.15 : 1.0;
  const highCylinderBoost = Math.min(1 + cylinders / 32, 1.25);

  // Pure sine partials for precise spectral control (a sawtooth voice already
  // carries its own full harmonic series, so stacking more sawtooths at each
  // multiple double-counts high-frequency energy and reads as shrill). Only
  // the fundamental keeps some sawtooth grit; a sub an octave below adds the
  // low-end rumble a real exhaust note has.
  return [
    { multiplier: 0.5, amp: 0.5, type: "sine" },
    { multiplier: 1, amp: 0.9, type: "sawtooth" },
    { multiplier: 2, amp: 0.32, type: "sine" },
    { multiplier: 3, amp: 0.18 * unevenBoost, type: "sine" },
    { multiplier: 4, amp: 0.1 * highCylinderBoost, type: "sine" },
  ];
}

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

export class EngineAudioEngine {
  private ctx: AudioContext;
  private master: GainNode;
  private filter: BiquadFilterNode;
  private voices: HarmonicVoice[] = [];
  private turboWhine: { osc: OscillatorNode; gain: GainNode } | null = null;
  private noiseSource: AudioBufferSourceNode;
  private noiseGain: GainNode;
  private cylinders: number;
  private aspiration: Aspiration;
  private started = false;
  private disposed = false;

  constructor(engine: EngineConfig) {
    this.cylinders = engine.cylinders;
    this.aspiration = engine.aspiration;

    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(this.ctx.destination);

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = "lowpass";
    this.filter.frequency.value = 400;
    this.filter.Q.value = 0.8;
    this.filter.connect(this.master);

    for (const spec of harmonicProfile(engine.cylinders, engine.layout)) {
      const osc = this.ctx.createOscillator();
      osc.type = spec.type;
      const gain = this.ctx.createGain();
      gain.gain.value = spec.amp;
      osc.connect(gain);
      gain.connect(this.filter);
      this.voices.push({ osc, gain, multiplier: spec.multiplier });
    }

    if (engine.aspiration !== "na") {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(this.master);
      this.turboWhine = { osc, gain };
    }

    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = createNoiseBuffer(this.ctx);
    this.noiseSource.loop = true;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = "bandpass";
    noiseFilter.frequency.value = 320;
    noiseFilter.Q.value = 0.7;
    this.noiseGain = this.ctx.createGain();
    this.noiseGain.gain.value = 0;
    this.noiseSource.connect(noiseFilter);
    noiseFilter.connect(this.noiseGain);
    this.noiseGain.connect(this.master);
  }

  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    const now = this.ctx.currentTime;
    this.voices.forEach(({ osc }) => osc.start(now));
    this.turboWhine?.osc.start(now);
    this.noiseSource.start(now);
    this.master.gain.setTargetAtTime(0.45, now, 0.05);
  }

  update(rpm: number, redlineRpm: number): void {
    if (!this.started || this.disposed) return;
    const now = this.ctx.currentTime;

    // 4-stroke: each cylinder fires once every two crank revolutions.
    const firingFreqHz = (rpm * this.cylinders) / 120;
    this.voices.forEach(({ osc, multiplier }) => {
      osc.frequency.setTargetAtTime(firingFreqHz * multiplier, now, 0.03);
    });

    const rpmFraction = Math.min(1, rpm / redlineRpm);
    this.filter.frequency.setTargetAtTime(400 + rpmFraction * 1900, now, 0.05);
    this.noiseGain.gain.setTargetAtTime(0.012 + rpmFraction * 0.035, now, 0.05);

    if (this.turboWhine) {
      const spoolFraction = Math.min(1, Math.max(0, (rpmFraction - 0.2) / 0.55));
      this.turboWhine.osc.frequency.setTargetAtTime(1400 + spoolFraction * 2600, now, 0.08);
      this.turboWhine.gain.gain.setTargetAtTime(spoolFraction * 0.05, now, 0.08);
    }
  }

  stop(): void {
    if (this.disposed) return;
    const now = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(0.0001, now, 0.15);
    setTimeout(() => this.dispose(), 350);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.voices.forEach(({ osc }) => {
      try {
        osc.stop();
      } catch {
        // already stopped
      }
    });
    try {
      this.turboWhine?.osc.stop();
    } catch {
      // already stopped
    }
    try {
      this.noiseSource.stop();
    } catch {
      // already stopped
    }
    void this.ctx.close();
  }
}
