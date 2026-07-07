import { EngineConfig, EngineLayout } from "../physics/types";

function createNoiseBuffer(ctx: AudioContext): AudioBuffer {
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

// Uneven-firing layouts (banks fire in staggered pairs rather than evenly
// spaced) get a slower secondary amplitude wobble layered on top of the
// main firing pulse, giving V/flat/W engines their characteristic "burble"
// instead of an inline engine's smoother, more even chug.
function unevenFiringDepth(layout: EngineLayout): number {
  switch (layout) {
    case "v":
      return 0.22;
    case "w":
      return 0.3;
    case "flat":
      return 0.18;
    case "inline":
      return 0;
  }
}

export class EngineAudioEngine {
  private ctx: AudioContext;
  private master: GainNode;

  // Low tonal "block resonance" layer - always stays in a deep, bounded
  // register (roughly 40-190Hz) regardless of cylinder count or redline, so
  // pitch never climbs into a shrill whistle. Two slightly detuned voices
  // give it beating/weight, like a real engine block resonating.
  private toneFilter: BiquadFilterNode;
  private toneOscA: OscillatorNode;
  private toneOscB: OscillatorNode;

  // Broadband "growl" layer - filtered noise whose amplitude is modulated
  // (not its pitch) at the actual cylinder firing rate. This is what
  // differentiates a lopey 3-cylinder idle from a smooth-buzzing V12 without
  // ever turning the firing rate into an audible musical pitch.
  private noiseSource: AudioBufferSourceNode;
  private noiseFilter: BiquadFilterNode;
  private noiseAmGain: GainNode;
  private firingOsc: OscillatorNode;
  private firingModDepth: GainNode;
  private unevenOsc: OscillatorNode | null;
  private unevenModDepth: GainNode | null;

  private turboWhine: { osc: OscillatorNode; gain: GainNode } | null = null;

  private cylinders: number;
  private started = false;
  private disposed = false;

  constructor(engine: EngineConfig) {
    this.cylinders = engine.cylinders;

    this.ctx = new AudioContext();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.0001;
    this.master.connect(this.ctx.destination);

    // Tonal layer
    this.toneFilter = this.ctx.createBiquadFilter();
    this.toneFilter.type = "lowpass";
    this.toneFilter.frequency.value = 250;
    this.toneFilter.Q.value = 0.7;
    this.toneFilter.connect(this.master);

    const toneGain = this.ctx.createGain();
    toneGain.gain.value = 0.55;
    toneGain.connect(this.toneFilter);

    this.toneOscA = this.ctx.createOscillator();
    this.toneOscA.type = "sawtooth";
    this.toneOscA.connect(toneGain);

    this.toneOscB = this.ctx.createOscillator();
    this.toneOscB.type = "sawtooth";
    this.toneOscB.connect(toneGain);

    // Growl layer: noise -> bandpass -> amplitude-modulated gain -> master
    this.noiseSource = this.ctx.createBufferSource();
    this.noiseSource.buffer = createNoiseBuffer(this.ctx);
    this.noiseSource.loop = true;

    this.noiseFilter = this.ctx.createBiquadFilter();
    this.noiseFilter.type = "bandpass";
    this.noiseFilter.frequency.value = 300;
    this.noiseFilter.Q.value = 0.8;

    this.noiseAmGain = this.ctx.createGain();
    this.noiseAmGain.gain.value = 0.3;

    this.noiseSource.connect(this.noiseFilter);
    this.noiseFilter.connect(this.noiseAmGain);
    this.noiseAmGain.connect(this.master);

    // Modulator: an inaudible oscillator (never connected to the destination
    // graph directly) whose output drives the growl gain's AudioParam,
    // amplitude-modulating the noise at the cylinder firing rate.
    this.firingOsc = this.ctx.createOscillator();
    this.firingOsc.type = "sine";
    this.firingModDepth = this.ctx.createGain();
    this.firingModDepth.gain.value = 0.22;
    this.firingOsc.connect(this.firingModDepth);
    this.firingModDepth.connect(this.noiseAmGain.gain);

    const depth = unevenFiringDepth(engine.layout);
    if (depth > 0) {
      this.unevenOsc = this.ctx.createOscillator();
      this.unevenOsc.type = "sine";
      this.unevenModDepth = this.ctx.createGain();
      this.unevenModDepth.gain.value = depth;
      this.unevenOsc.connect(this.unevenModDepth);
      this.unevenModDepth.connect(this.noiseAmGain.gain);
    } else {
      this.unevenOsc = null;
      this.unevenModDepth = null;
    }

    // Turbo/supercharger whistle - the one layer that's genuinely supposed
    // to be high-pitched, since that's what forced induction actually sounds
    // like spooling up.
    if (engine.aspiration !== "na") {
      const osc = this.ctx.createOscillator();
      osc.type = "sine";
      const gain = this.ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(this.master);
      this.turboWhine = { osc, gain };
    }
  }

  start(): void {
    if (this.started || this.disposed) return;
    this.started = true;
    const now = this.ctx.currentTime;
    this.toneOscA.start(now);
    this.toneOscB.start(now);
    this.noiseSource.start(now);
    this.firingOsc.start(now);
    this.unevenOsc?.start(now);
    this.turboWhine?.osc.start(now);
    this.master.gain.setTargetAtTime(0.5, now, 0.05);
  }

  update(rpm: number, redlineRpm: number): void {
    if (!this.started || this.disposed) return;
    const now = this.ctx.currentTime;
    const rpmFraction = Math.min(1, Math.max(0, rpm / redlineRpm));

    // Deep tonal body, always bounded low so it never reads as a whistle.
    const baseFreq = 42 + rpmFraction * 150;
    this.toneOscA.frequency.setTargetAtTime(baseFreq, now, 0.04);
    this.toneOscB.frequency.setTargetAtTime(baseFreq * 1.008, now, 0.04);
    this.toneFilter.frequency.setTargetAtTime(180 + rpmFraction * 420, now, 0.05);

    // Firing rate only modulates the growl's amplitude/texture, never a pitch.
    const firingFreqHz = (rpm * this.cylinders) / 120;
    this.firingOsc.frequency.setTargetAtTime(firingFreqHz, now, 0.03);
    this.unevenOsc?.frequency.setTargetAtTime(firingFreqHz / 2, now, 0.03);

    this.noiseFilter.frequency.setTargetAtTime(260 + rpmFraction * 420, now, 0.05);
    this.noiseAmGain.gain.setTargetAtTime(0.28 + rpmFraction * 0.22, now, 0.05);

    if (this.turboWhine) {
      const spoolFraction = Math.min(1, Math.max(0, (rpmFraction - 0.2) / 0.55));
      this.turboWhine.osc.frequency.setTargetAtTime(1200 + spoolFraction * 2200, now, 0.08);
      this.turboWhine.gain.gain.setTargetAtTime(spoolFraction * 0.045, now, 0.08);
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
    const stopAll: (OscillatorNode | AudioBufferSourceNode | undefined | null)[] = [
      this.toneOscA,
      this.toneOscB,
      this.noiseSource,
      this.firingOsc,
      this.unevenOsc,
      this.turboWhine?.osc,
    ];
    for (const node of stopAll) {
      try {
        node?.stop();
      } catch {
        // already stopped
      }
    }
    void this.ctx.close();
  }
}
