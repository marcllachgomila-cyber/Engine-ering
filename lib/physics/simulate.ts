import { buildEngineCurves } from "./engineModel";
import { deriveVehicle } from "./vehicleModel";
import { EngineConfig, EngineCurves, SimulationResult, Telemetry, VehicleSpec } from "./types";

const AIR_DENSITY_KG_M3 = 1.225;
const G = 9.81;
const DT = 0.02;
const RUN_DURATION_S = 10;
const HUNDRED_KPH_MS = 100 / 3.6;

function rpmFromSpeed(
  speedMs: number,
  gearRatio: number,
  vehicle: VehicleSpec,
): number {
  return (
    (speedMs / vehicle.wheelRadiusM) *
    gearRatio *
    vehicle.finalDrive *
    (60 / (2 * Math.PI))
  );
}

function estimateTopSpeedKph(
  curves: EngineCurves,
  vehicle: VehicleSpec,
): number {
  const topGearRatio = vehicle.gearRatios[vehicle.gearRatios.length - 1];
  const rollingForce = vehicle.rollingResistanceCoefficient * vehicle.weightKg * G;

  let lastValidSpeedMs = 0;
  const stepMs = 0.2;
  for (let speedMs = stepMs; speedMs < 130; speedMs += stepMs) {
    const rpm = rpmFromSpeed(speedMs, topGearRatio, vehicle);
    if (rpm > curves.redlineRpm) break;

    const torqueNm = curves.torqueAt(rpm);
    const driveForce =
      (torqueNm * topGearRatio * vehicle.finalDrive * vehicle.drivetrainEfficiency) /
      vehicle.wheelRadiusM;
    const dragForce =
      0.5 *
      AIR_DENSITY_KG_M3 *
      vehicle.dragCoefficient *
      vehicle.frontalAreaM2 *
      speedMs *
      speedMs;

    if (driveForce <= dragForce + rollingForce) break;
    lastValidSpeedMs = speedMs;
  }

  return lastValidSpeedMs * 3.6;
}

export function simulate(engine: EngineConfig): SimulationResult {
  const curves = buildEngineCurves(engine);
  const vehicle = deriveVehicle(engine, curves);

  let speedMs = 0;
  let distanceM = 0;
  let gear = 1;
  let t = 0;
  let reachedHundredAtS: number | null = null;

  const telemetry: Telemetry[] = [];
  const rollingForce = vehicle.rollingResistanceCoefficient * vehicle.weightKg * G;
  const tractionLimit = vehicle.tireGripMu * vehicle.weightKg * G;

  while (t < RUN_DURATION_S) {
    const gearRatio = vehicle.gearRatios[gear - 1];
    let rpm = Math.max(rpmFromSpeed(speedMs, gearRatio, vehicle), curves.idleRpm);

    if (rpm > vehicle.shiftRpm && gear < vehicle.gearRatios.length) {
      gear += 1;
      continue;
    }
    rpm = Math.min(rpm, curves.redlineRpm);

    const torqueNm = curves.torqueAt(rpm);
    const engineForce =
      (torqueNm * gearRatio * vehicle.finalDrive * vehicle.drivetrainEfficiency) /
      vehicle.wheelRadiusM;
    const driveForce = Math.min(engineForce, tractionLimit);

    const dragForce =
      0.5 *
      AIR_DENSITY_KG_M3 *
      vehicle.dragCoefficient *
      vehicle.frontalAreaM2 *
      speedMs *
      speedMs;

    const netForce = driveForce - dragForce - rollingForce;
    const accelMs2 = netForce / vehicle.weightKg;

    speedMs = Math.max(0, speedMs + accelMs2 * DT);
    distanceM += speedMs * DT;
    t += DT;

    if (reachedHundredAtS === null && speedMs >= HUNDRED_KPH_MS) {
      reachedHundredAtS = t;
    }

    telemetry.push({
      t,
      speedKph: speedMs * 3.6,
      rpm,
      gear,
      hp: curves.powerAt(rpm),
      torqueNm,
      gForce: accelMs2 / G,
      distanceM,
    });
  }

  const topSpeedKph = telemetry.length > 0 ? telemetry[telemetry.length - 1].speedKph : 0;

  return {
    telemetry,
    runDurationS: t,
    topSpeedKph,
    reachedHundredAtS,
    peakHp: curves.peakPowerHp,
    peakHpRpm: curves.peakPowerRpm,
    peakTorqueNm: curves.peakTorqueNm,
    peakTorqueRpm: curves.peakTorqueRpm,
    weightKg: vehicle.weightKg,
    powerToWeightHpPerTonne: curves.peakPowerHp / (vehicle.weightKg / 1000),
    theoreticalTopSpeedKph: estimateTopSpeedKph(curves, vehicle),
  };
}
