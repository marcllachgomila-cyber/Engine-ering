import { BrakeMaterial } from "./types";

// Brake temperature range the driver can dial in before a run - representing
// anything from a stone-cold morning start to brakes already warmed up from
// a previous stop.
export const BRAKE_TEMP_MIN_C = 20;
export const BRAKE_TEMP_MAX_C = 600;

// Without ABS, the driver (or the wheels) will occasionally push past the
// tire's peak grip and lock up - kinetic friction while sliding is lower
// than the peak static grip ABS keeps you right at the edge of, so a locked
// wheel stops the car slower, not faster.
export const ABS_OFF_PENALTY = 0.8;

interface BrakeMaterialSpec {
  label: string;
  // How much heat (in joules) it takes to raise this brake's temperature by
  // 1°C - a stand-in for rotor/pad mass and heat capacity. Bigger discs and
  // exotic materials soak up more heat before they get in trouble.
  thermalMassJPerC: number;
  // Fraction of full braking force actually available at a given rotor
  // temperature. 1.0 is "as strong as the tires allow"; below 1.0 the
  // brakes themselves are the limiter (cold, glazed, or overheated/faded).
  effectivenessAt: (tempC: number) => number;
}

export const BRAKE_MATERIALS: Record<BrakeMaterial, BrakeMaterialSpec> = {
  // Steel: strong from cold, but the pads and fluid can't take sustained
  // heat - effectiveness falls off once things get hot.
  steel: {
    label: "Steel",
    thermalMassJPerC: 4500,
    effectivenessAt: (t) => {
      if (t <= 350) return 1.0;
      if (t >= 600) return 0.55;
      return 1.0 - ((t - 350) / (600 - 350)) * 0.45;
    },
  },
  // Ceramic: needs a little warmth to bite as hard as steel does cold, but
  // shrugs off heat far better and holds its peak over a wide band.
  ceramic: {
    label: "Ceramic",
    thermalMassJPerC: 7000,
    effectivenessAt: (t) => {
      if (t < 80) return 0.92 + (t / 80) * 0.08;
      if (t <= 750) return 1.0;
      if (t >= 950) return 0.8;
      return 1.0 - ((t - 750) / (950 - 750)) * 0.2;
    },
  },
  // Carbon (carbon-ceramic): weak and grabby when cold - it wants heat in it
  // before it works - but once up to temperature it out-brakes everything
  // else, and can shrug off far higher temperatures before fading.
  carbon: {
    label: "Carbon",
    thermalMassJPerC: 9000,
    effectivenessAt: (t) => {
      if (t < 150) return 0.5 + (t / 150) * 0.3;
      if (t <= 850) return 1.05;
      if (t >= 1050) return 0.85;
      return 1.05 - ((t - 850) / (1050 - 850)) * 0.2;
    },
  },
};
