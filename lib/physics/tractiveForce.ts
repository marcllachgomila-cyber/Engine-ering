import { EngineCurves, ForcePoint, GearForceCurve, TractiveForceData, VehicleSpec } from "./types";

const AIR_DENSITY_KG_M3 = 1.225;
const G = 9.81;
const STEP_MS = 0.5;
const MAX_SEARCH_SPEED_MS = 130;

function rpmFromSpeedMs(speedMs: number, gearRatio: number, vehicle: VehicleSpec): number {
  return (
    (speedMs / vehicle.wheelRadiusM) *
    gearRatio *
    vehicle.finalDrive *
    (60 / (2 * Math.PI))
  );
}

// The tractive-effort diagram: for each gear, how much force reaches the
// wheels across the speed range that gear can actually pull, plus the
// resistance (drag + rolling) curve every gear has to overcome. Where a
// gear's line drops below resistance is exactly where the car can't
// accelerate any further and has to shift.
export function computeTractiveForceData(
  curves: EngineCurves,
  vehicle: VehicleSpec,
): TractiveForceData {
  const gearCurves: GearForceCurve[] = vehicle.gearRatios.map((ratio, i) => {
    const points: ForcePoint[] = [];
    for (let speedMs = 0; speedMs <= MAX_SEARCH_SPEED_MS; speedMs += STEP_MS) {
      const rpm = rpmFromSpeedMs(speedMs, ratio, vehicle);
      if (rpm < curves.idleRpm) continue;
      if (rpm > curves.maxRevRpm) break;
      const torqueNm = curves.torqueAt(rpm);
      const forceN =
        (torqueNm * ratio * vehicle.finalDrive * vehicle.drivetrainEfficiency) /
        vehicle.wheelRadiusM;
      points.push({ speedKph: speedMs * 3.6, forceN });
    }
    return { gear: i + 1, points };
  });

  const highestGearMaxSpeedKph =
    gearCurves[gearCurves.length - 1]?.points.at(-1)?.speedKph ?? 0;
  const resistanceMaxSpeedMs = Math.max(20, (highestGearMaxSpeedKph * 1.1) / 3.6);

  const resistanceCurve: ForcePoint[] = [];
  for (let speedMs = 0; speedMs <= resistanceMaxSpeedMs; speedMs += STEP_MS) {
    const dragForce =
      0.5 *
      AIR_DENSITY_KG_M3 *
      vehicle.dragCoefficient *
      vehicle.frontalAreaM2 *
      speedMs *
      speedMs;
    const rollingForce = vehicle.rollingResistanceCoefficient * vehicle.weightKg * G;
    resistanceCurve.push({ speedKph: speedMs * 3.6, forceN: dragForce + rollingForce });
  }

  return { gearCurves, resistanceCurve };
}
