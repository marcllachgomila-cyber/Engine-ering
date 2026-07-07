import { Aspiration, EngineConfig, EngineCurves } from "./types";

const IDLE_RPM = 900;

function torquePerLiter(aspiration: Aspiration): number {
  switch (aspiration) {
    case "na":
      return 100;
    case "turbo":
      return 155;
    case "supercharged":
      return 145;
  }
}

function cylinderFactor(cylinders: number): number {
  // Modest efficiency bonus for smoother multi-cylinder combustion,
  // offset by per-cylinder friction losses at very high counts.
  const factor = 0.92 + cylinders * 0.008;
  return Math.min(Math.max(factor, 0.9), 1.15);
}

function peakTorqueFraction(aspiration: Aspiration): number {
  switch (aspiration) {
    case "na":
      return 0.45;
    case "supercharged":
      return 0.5;
    case "turbo":
      return 0.55;
  }
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
): number {
  const { rise, fall } = curveSigmas(aspiration);
  const sigma = rpmFraction < peakFraction ? rise : fall;
  const value = Math.exp(
    -((rpmFraction - peakFraction) ** 2) / (2 * sigma * sigma),
  );
  return Math.max(value, 0.22);
}

export function buildEngineCurves(engine: EngineConfig): EngineCurves {
  const { displacementL, cylinders, redlineRpm, aspiration } = engine;

  const peakTorqueNm =
    displacementL * torquePerLiter(aspiration) * cylinderFactor(cylinders);
  const peakFraction = peakTorqueFraction(aspiration);

  const torqueAt = (rpm: number): number => {
    const clampedRpm = Math.min(Math.max(rpm, IDLE_RPM), redlineRpm);
    const fraction = clampedRpm / redlineRpm;
    return peakTorqueNm * shapeMultiplier(fraction, peakFraction, aspiration);
  };

  const powerAt = (rpm: number): number => {
    const torqueNm = torqueAt(rpm);
    return (torqueNm * rpm * ((2 * Math.PI) / 60)) / 745.7;
  };

  // Scan the usable RPM range to find actual peak torque/power, since the
  // shape function doesn't guarantee the analytic peak lands exactly at
  // peakFraction once combined with rpm-dependent power scaling.
  let peakTorqueRpm = IDLE_RPM;
  let scannedPeakTorqueNm = 0;
  let peakPowerRpm = IDLE_RPM;
  let peakPowerHp = 0;

  const steps = 200;
  for (let i = 0; i <= steps; i++) {
    const rpm = IDLE_RPM + ((redlineRpm - IDLE_RPM) * i) / steps;
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
    idleRpm: IDLE_RPM,
    redlineRpm,
    peakTorqueNm: scannedPeakTorqueNm,
    peakTorqueRpm,
    peakPowerHp,
    peakPowerRpm,
  };
}
