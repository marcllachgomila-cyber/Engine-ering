import { firingEventsPerRev, isRotary } from "./engineLayout";
import { Aspiration, EngineConfig, EngineCurves, FuelType } from "./types";

const IDLE_RPM = 900;

// Diesels make substantially more torque per liter than petrol (higher
// compression ratio, long-stroke design) but pay for it with a much lower
// redline ceiling, enforced separately in the UI.
const DIESEL_TORQUE_MULTIPLIER = 1.35;

// Rotary displacement is quoted as one chamber per rotor, but every rotor
// fires once per shaft revolution - twice as often as a four-stroke
// cylinder - so a "1.3L" 13B behaves more like a ~2.6L piston engine. Its
// long, thin combustion chamber loses a lot of that to heat and incomplete
// burn, which is why the multiplier is well short of 2x. Calibrated against
// the RX-8 (1.3L NA, 211Nm) and RX-7 FD (1.3L twin-turbo, 294Nm).
const ROTARY_TORQUE_MULTIPLIER = 1.6;

// Rotaries have no valvetrain to run out of breath, so torque peaks later
// in the band and falls away more gently toward the limiter.
const ROTARY_PEAK_FRACTION_SHIFT = 0.1;
const ROTARY_FALL_SIGMA_BONUS = 0.12;

function torquePerLiter(aspiration: Aspiration, fuelType: FuelType): number {
  const base = (() => {
    switch (aspiration) {
      case "na":
        return 100;
      case "turbo":
        return 155;
      case "supercharged":
        return 145;
    }
  })();
  return fuelType === "diesel" ? base * DIESEL_TORQUE_MULTIPLIER : base;
}

function cylinderFactor(cylinders: number): number {
  // Modest efficiency bonus for smoother multi-cylinder combustion,
  // offset by per-cylinder friction losses at very high counts.
  const factor = 0.92 + cylinders * 0.008;
  return Math.min(Math.max(factor, 0.9), 1.15);
}

function peakTorqueFraction(aspiration: Aspiration, fuelType: FuelType): number {
  const base = (() => {
    switch (aspiration) {
      case "na":
        return 0.45;
      case "supercharged":
        return 0.5;
      case "turbo":
        return 0.55;
    }
  })();
  // Diesels build boost/cylinder pressure earlier and don't rev out, so
  // their torque peak sits noticeably lower in the band than petrol's.
  return fuelType === "diesel" ? base - 0.12 : base;
}

function curveSigmas(aspiration: Aspiration): { rise: number; fall: number } {
  // `fall` is tuned so peak power lands ~80-90% of redline (power keeps
  // climbing after peak torque since rpm growth outpaces torque decay),
  // matching typical dyno shapes instead of dropping off mid-range.
  switch (aspiration) {
    case "turbo":
      return { rise: 0.16, fall: 0.5 };
    case "supercharged":
      return { rise: 0.14, fall: 0.52 };
    case "na":
      return { rise: 0.22, fall: 0.55 };
  }
}

function shapeMultiplier(
  rpmFraction: number,
  peakFraction: number,
  aspiration: Aspiration,
  rotary: boolean,
): number {
  const { rise, fall } = curveSigmas(aspiration);
  const sigma =
    rpmFraction < peakFraction ? rise : fall + (rotary ? ROTARY_FALL_SIGMA_BONUS : 0);
  const value = Math.exp(
    -((rpmFraction - peakFraction) ** 2) / (2 * sigma * sigma),
  );
  return Math.max(value, 0.22);
}

export function buildEngineCurves(engine: EngineConfig): EngineCurves {
  const { displacementL, cylinders, redlineRpm, maxRevRpm, aspiration, fuelType, hybridBoostKw, hybridMaxTorqueNm } = engine;
  const rotary = isRotary(engine);

  // Each rotor fires like two four-stroke cylinders, so the smoothness
  // factor looks at the equivalent cylinder count rather than rotor count.
  const smoothnessCylinders = firingEventsPerRev(engine) * 2;
  const peakTorqueNm =
    displacementL *
    torquePerLiter(aspiration, fuelType) *
    cylinderFactor(smoothnessCylinders) *
    (rotary ? ROTARY_TORQUE_MULTIPLIER : 1);
  const peakFraction =
    peakTorqueFraction(aspiration, fuelType) + (rotary ? ROTARY_PEAK_FRACTION_SHIFT : 0);

  // The shape is always anchored to `redlineRpm` (where the manufacturer
  // tuned the curve to peak), but a car can be pushed past it up to
  // `maxRevRpm` before the hard limiter - torque just keeps tapering along
  // the same falling curve into that over-rev zone.
  const iceTorqueAt = (rpm: number): number => {
    const clampedRpm = Math.min(Math.max(rpm, IDLE_RPM), maxRevRpm);
    const fraction = clampedRpm / redlineRpm;
    return peakTorqueNm * shapeMultiplier(fraction, peakFraction, aspiration, rotary);
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

  const powerAt = (rpm: number): number => {
    const torqueNm = torqueAt(rpm);
    return (torqueNm * rpm * ((2 * Math.PI) / 60)) / 745.7;
  };

  // Internal friction (mechanical rubbing + pumping losses) grows with
  // engine size (more cylinders/displacement = more friction surfaces) and
  // rises faster than linearly with RPM - reciprocating and pumping losses
  // both accelerate at high engine speed, which is part of why power
  // eventually falls off near the limiter even though torque alone
  // wouldn't explain it. `torqueAt` is the net (crankshaft/output) torque;
  // combustion has to produce that plus whatever friction is eating.
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
  // shape function doesn't guarantee the analytic peak lands exactly at
  // peakFraction once combined with rpm-dependent power scaling.
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
    idleRpm: IDLE_RPM,
    redlineRpm,
    maxRevRpm,
    peakTorqueNm: scannedPeakTorqueNm,
    peakTorqueRpm,
    peakPowerHp,
    peakPowerRpm,
  };
}
