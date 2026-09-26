import { isRotary } from "./engineLayout";
import { Aspiration, EngineConfig, EngineCurves, FuelType } from "./types";

const IDLE_RPM = 900;

// Peak torque comes from brake mean effective pressure (BMEP) - the average
// cylinder pressure that ends up as useful work at the crank - rather than
// an invented torque-per-litre figure. For a four-stroke, one power stroke
// per cylinder every two revolutions gives:
//
//   T = BMEP * V_d / (4 * pi)       (BMEP in Pa, V_d in m^3)
//
// Typical peak BMEP: ~12.5 bar for a naturally aspirated petrol engine,
// 18-25 bar turbo/supercharged petrol (depending on boost), 20-25 bar for
// a turbo diesel. Sanity check: a Chiron's 8.0L at ~25 bar gives
// 2.5e6 * 0.008 / 4pi ~ 1,600Nm, what the real car makes.
const NA_PETROL_BMEP_BAR = 12.5;
// Diesels can't rev to fill the cylinder as well unboosted, but with no
// knock limit they turn boost into cylinder pressure more effectively.
const NA_DIESEL_BMEP_BAR = 9;
const PETROL_BOOST_EFFICIENCY = 0.95;
const DIESEL_BOOST_EFFICIENCY = 1.15;

// Default boost (bar above atmospheric) when an engine doesn't specify one.
export const DEFAULT_BOOST_BAR: Record<Exclude<Aspiration, "na">, number> = {
  turbo: 1.0,
  supercharged: 0.7,
};
export const MIN_BOOST_BAR = 0.2;
export const MAX_BOOST_BAR = 3;

// Rotary displacement is quoted as one chamber per rotor, but every rotor
// fires once per shaft revolution - twice as often as a four-stroke
// cylinder - so the swept volume that goes into the BMEP formula is
// doubled. Its long, thin combustion chamber loses a lot to heat and
// incomplete burn, which shows up as a lower BMEP. Calibrated against the
// RX-8 (1.3L NA, 211Nm).
const ROTARY_BMEP_FACTOR = 0.82;

export function effectiveBoostBar(engine: EngineConfig): number {
  if (engine.aspiration === "na") return 0;
  return engine.boostBar ?? DEFAULT_BOOST_BAR[engine.aspiration];
}

export function peakBmepBar(engine: EngineConfig): number {
  const diesel = engine.fuelType === "diesel";
  const base =
    engine.baseBmepBar ??
    (diesel ? NA_DIESEL_BMEP_BAR : NA_PETROL_BMEP_BAR) * (isRotary(engine) ? ROTARY_BMEP_FACTOR : 1);
  const boost = effectiveBoostBar(engine);
  if (boost === 0) return base;
  // Boost raises intake manifold pressure from 1 bar to 1 + boost bar
  // absolute, and cylinder pressure scales with it (less charge heating
  // and knock margin for petrol).
  return base * (1 + boost) * (diesel ? DIESEL_BOOST_EFFICIENCY : PETROL_BOOST_EFFICIENCY);
}

// Normalised torque curve (1 = peak) as a function of x = rpm / redline.
//
// Naturally aspirated: a single broad hump peaking high in the band (~72%
// of redline), still ~90% of peak at redline - which is why NA power peaks
// right up near the limiter.
//
// Turbo/supercharged: off boost the engine only makes roughly its NA
// torque, then the charger spools up to a flat plateau that fades toward
// redline as the turbo runs out of flow. A supercharger is belt-driven, so
// its plateau starts much earlier. Diesels spool early and fade harder.
interface CurveShape {
  plateauStart: number;
  plateauEnd: number;
  atRedline: number;
}

function forcedInductionShape(aspiration: Aspiration, fuelType: FuelType): CurveShape {
  if (fuelType === "diesel") return { plateauStart: 0.3, plateauEnd: 0.55, atRedline: 0.7 };
  if (aspiration === "supercharged") return { plateauStart: 0.2, plateauEnd: 0.6, atRedline: 0.85 };
  return { plateauStart: 0.33, plateauEnd: 0.65, atRedline: 0.85 };
}

function smoothstep(t: number): number {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
}

// Past redline the engine is over-revving: torque falls away fast enough
// that power drops toward the limiter.
const OVER_REV_EXPONENT = 1.5;

function normalisedTorque(x: number, engine: EngineConfig, idleFraction: number): number {
  if (x > 1) return normalisedTorque(1, engine, idleFraction) * Math.pow(1 / x, OVER_REV_EXPONENT);

  if (engine.aspiration === "na") {
    // Rotaries have no valvetrain to run out of breath, so the peak sits
    // later and the fall toward redline is gentler.
    const rotary = isRotary(engine);
    const peak = rotary ? 0.8 : 0.72;
    const curvature = rotary ? 0.9 : 1.28;
    return Math.max(0.35, 1 - curvature * (x - peak) ** 2);
  }

  const shape = forcedInductionShape(engine.aspiration, engine.fuelType);
  // Off-boost torque is roughly what the same engine would make NA.
  const boost = effectiveBoostBar(engine);
  const offBoost = Math.min(0.9, 1 / ((1 + boost) * PETROL_BOOST_EFFICIENCY));
  if (x < shape.plateauStart) {
    return offBoost + (1 - offBoost) * smoothstep((x - idleFraction) / (shape.plateauStart - idleFraction));
  }
  if (x <= shape.plateauEnd) return 1;
  const fade = (x - shape.plateauEnd) / (1 - shape.plateauEnd);
  return 1 - (1 - shape.atRedline) * fade;
}

export function buildEngineCurves(engine: EngineConfig): EngineCurves {
  const { displacementL, cylinders, redlineRpm, maxRevRpm, hybridBoostKw, hybridMaxTorqueNm } = engine;
  const rotary = isRotary(engine);

  const sweptVolumeM3 = (displacementL / 1000) * (rotary ? 2 : 1);
  const peakIceTorqueNm = (peakBmepBar(engine) * 1e5 * sweptVolumeM3) / (4 * Math.PI);
  const idleFraction = IDLE_RPM / redlineRpm;

  // The shape is always anchored to `redlineRpm` (where the manufacturer
  // tuned the curve), but a car can be pushed past it up to `maxRevRpm`
  // before the hard limiter.
  const iceTorqueAt = (rpm: number): number => {
    const clampedRpm = Math.min(Math.max(rpm, IDLE_RPM), maxRevRpm);
    return peakIceTorqueNm * normalisedTorque(clampedRpm / redlineRpm, engine, idleFraction);
  };

  // Electric motor torque available at the wheel/crank: torque-limited at
  // low rpm (hybridMaxTorqueNm), power-limited (constant hybridBoostKw)
  // once that torque would need more power than the motor has - the same
  // shape a real e-motor's torque curve has. Zero for any non-hybrid
  // engine (hybridBoostKw unset).
  const electricTorqueAt = (rpm: number): number => {
    if (!hybridBoostKw) return 0;
    const clampedRpm = Math.min(Math.max(rpm, IDLE_RPM), maxRevRpm);
    const omegaRadPerS = clampedRpm * ((2 * Math.PI) / 60);
    const powerLimitedTorqueNm = (hybridBoostKw * 1000) / omegaRadPerS;
    return Math.min(hybridMaxTorqueNm ?? Infinity, powerLimitedTorqueNm);
  };

  // Net torque actually delivered to the wheels - what every force/power
  // calculation downstream should use. combustionTorqueAt below stays
  // ICE-only, for the combustion-vs-friction breakdown.
  const torqueAt = (rpm: number): number => iceTorqueAt(rpm) + electricTorqueAt(rpm);

  // P = T * omega, reported in hp.
  const powerAt = (rpm: number): number => {
    const torqueNm = torqueAt(rpm);
    return (torqueNm * rpm * ((2 * Math.PI) / 60)) / 745.7;
  };

  // Internal friction (mechanical rubbing + pumping losses) grows with
  // engine size (more cylinders/displacement = more friction surfaces) and
  // rises faster than linearly with RPM - reciprocating and pumping losses
  // both accelerate at high engine speed. BMEP is a *brake* (net) figure,
  // so `torqueAt` is already net of this; combustion has to produce that
  // plus whatever friction is eating.
  //
  // A rotary has only spinning parts - no pistons to stop and restart twice
  // a revolution, no valvetrain - so its friction climbs roughly linearly
  // with rpm instead of accelerating toward the limiter.
  const frictionTorqueAt = (rpm: number): number => {
    const base = displacementL * 8 + cylinders * 1.5;
    const fraction = Math.min(1, Math.max(0, rpm / maxRevRpm));
    return base * (0.4 + 0.6 * Math.pow(fraction, rotary ? 1 : 1.3));
  };

  const combustionTorqueAt = (rpm: number): number => iceTorqueAt(rpm) + frictionTorqueAt(rpm);

  // Scan the usable RPM range to find actual peak torque/power, since the
  // hybrid contribution and the curve shape together don't put either peak
  // at a point that's easy to find analytically.
  let peakTorqueRpm = IDLE_RPM;
  let scannedPeakTorqueNm = 0;
  let peakPowerRpm = IDLE_RPM;
  let peakPowerHp = 0;

  const steps = 200;
  for (let i = 0; i <= steps; i++) {
    const rpm = IDLE_RPM + ((maxRevRpm - IDLE_RPM) * i) / steps;
    const torqueNm = torqueAt(rpm);
    if (torqueNm > scannedPeakTorqueNm) {
      scannedPeakTorqueNm = torqueNm;
      peakTorqueRpm = rpm;
    }
    const hp = powerAt(rpm);
    if (hp > peakPowerHp) {
      peakPowerHp = hp;
      peakPowerRpm = rpm;
    }
  }

  return {
    torqueAt,
    powerAt,
    frictionTorqueAt,
    combustionTorqueAt,
    electricTorqueAt,
    idleRpm: IDLE_RPM,
    redlineRpm,
    maxRevRpm,
    peakTorqueNm: scannedPeakTorqueNm,
    peakTorqueRpm,
    peakPowerHp,
    peakPowerRpm,
  };
}
