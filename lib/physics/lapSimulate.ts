import { BRAKE_AMBIENT_TEMP_C, BRAKE_MATERIALS, brakeCoolingRatePerS } from "./brakeModel";
import { buildEngineCurves } from "./engineModel";
import { deriveVehicle } from "./vehicleModel";
import {
  Circuit,
  CircuitSegment,
  ChassisConfig,
  EngineConfig,
  GearboxConfig,
  SimulationResult,
  Telemetry,
  TestConfig,
} from "./types";
import {
  AIR_DENSITY_KG_M3,
  G,
  estimateTopSpeedKph,
  gearForAcceleration,
  rpmFromSpeed,
  tyreGripMultiplier,
  wheelSpinEfficiency,
} from "./vehicleDynamics";

const DT = 0.02;
const SAFETY_MAX_LAPS_S = 240;

interface Checkpoint {
  startM: number;
  endM: number;
  isCorner: boolean;
  apexSpeedMs: number;
}

// Flattens a circuit's segment list into cumulative-distance checkpoints, so
// the sim can look up "what corner (if any) am I in, and what's the next one
// ahead" from a plain distance-along-lap value.
function buildCheckpoints(segments: CircuitSegment[], effectiveMu: number): Checkpoint[] {
  let cursor = 0;
  return segments.map((segment) => {
    const startM = cursor;
    cursor += segment.lengthM;
    return {
      startM,
      endM: cursor,
      isCorner: segment.type === "corner",
      apexSpeedMs: segment.type === "corner" ? Math.sqrt(effectiveMu * G * segment.radiusM) : Infinity,
    };
  });
}

// Theoretical single flying lap: at every point on track the car either
// accelerates as hard as the engine/traction allow, holds a corner's apex
// speed, or brakes at the tire's grip limit just in time to make the next
// corner - the same look-ahead-braking idea used by real lap-time
// simulators, simplified to reuse this app's existing accel/grip model.
export function simulateHotLap(
  engine: EngineConfig,
  chassis: ChassisConfig,
  gearbox: GearboxConfig,
  test: TestConfig,
  circuit: Circuit,
): SimulationResult {
  const curves = buildEngineCurves(engine);
  const vehicle = deriveVehicle(engine, curves, chassis, gearbox);

  const effectiveMu = vehicle.tireGripMu * tyreGripMultiplier(
    chassis.tyreType,
    chassis.tyreCompound,
    test.condition,
  );
  const brakingDecelMs2 = effectiveMu * G;
  const rollingForce = vehicle.rollingResistanceCoefficient * vehicle.weightKg * G;

  const checkpoints = buildCheckpoints(circuit.segments, effectiveMu);
  const corners = checkpoints.filter((c) => c.isCorner);
  const lastCornerApexMs = corners.length > 0 ? corners[corners.length - 1].apexSpeedMs : 0;

  let distanceM = 0;
  let speedMs = Number.isFinite(lastCornerApexMs) ? lastCornerApexMs : 0;
  const startSpeedMs = speedMs;
  let gear = 1;
  let t = 0;
  let checkpointIndex = 0;
  let brakeTempC = test.initialBrakeTempC;
  const brakeMaterial = BRAKE_MATERIALS[test.brakeMaterial];

  const telemetry: Telemetry[] = [];

  const tractionLimit = effectiveMu * vehicle.weightKg * G * wheelSpinEfficiency(chassis.wheelSpinPercent);

  while (distanceM < circuit.lengthM && t < SAFETY_MAX_LAPS_S) {
    while (checkpointIndex < checkpoints.length - 1 && distanceM >= checkpoints[checkpointIndex].endM) {
      checkpointIndex += 1;
    }
    const current = checkpoints[checkpointIndex];
    const next = checkpoints.find((c, i) => i >= checkpointIndex && c.isCorner) ?? null;

    // The shortest gear that doesn't over-rev - a driver on a hot lap
    // short-shifts right at the limiter, never coasts up in a taller gear
    // than the current speed calls for.
    gear = gearForAcceleration(speedMs, vehicle);
    const gearRatio = vehicle.gearRatios[gear - 1];
    const rpm = Math.min(Math.max(rpmFromSpeed(speedMs, gearRatio, vehicle), curves.idleRpm), curves.maxRevRpm);
    const torqueNm = curves.torqueAt(rpm);
    const engineForce =
      (torqueNm * gearRatio * vehicle.finalDrive * vehicle.drivetrainEfficiency) / vehicle.wheelRadiusM;
    const dragForce =
      0.5 * AIR_DENSITY_KG_M3 * vehicle.dragCoefficient * vehicle.frontalAreaM2 * speedMs * speedMs;

    let accelMs2: number;
    let brakeForceN = 0;

    if (current.isCorner) {
      // Already in a corner: hold its apex speed - brake down to it, or
      // gently regather speed toward it once the car is under the limit.
      if (speedMs > current.apexSpeedMs) {
        accelMs2 = -brakingDecelMs2;
        brakeForceN = brakingDecelMs2 * vehicle.weightKg;
      } else {
        const driveForce = Math.min(engineForce, tractionLimit);
        accelMs2 = (driveForce - dragForce - rollingForce) / vehicle.weightKg;
      }
    } else {
      const distanceToNextCornerM = next ? next.startM - distanceM : Infinity;
      const nextApexMs = next?.apexSpeedMs ?? 0;
      const brakingDistanceNeededM =
        speedMs > nextApexMs ? (speedMs * speedMs - nextApexMs * nextApexMs) / (2 * brakingDecelMs2) : 0;

      if (distanceToNextCornerM <= brakingDistanceNeededM) {
        accelMs2 = -brakingDecelMs2;
        brakeForceN = brakingDecelMs2 * vehicle.weightKg;
      } else {
        const driveForce = chassis.tractionControl
          ? Math.min(engineForce, tractionLimit)
          : engineForce <= tractionLimit
            ? engineForce
            : tractionLimit * 0.75;
        accelMs2 = (driveForce - dragForce - rollingForce) / vehicle.weightKg;
      }
    }

    speedMs = Math.max(0, speedMs + accelMs2 * DT);
    const stepDistanceM = speedMs * DT;
    distanceM += stepDistanceM;
    t += DT;

    // Air cooling relaxes the brakes toward ambient every step - faster at
    // speed on a straight, slower while crawling through a corner - then any
    // heat generated by braking this step piles back on top.
    const coolingRatePerS = brakeCoolingRatePerS(speedMs);
    brakeTempC =
      BRAKE_AMBIENT_TEMP_C + (brakeTempC - BRAKE_AMBIENT_TEMP_C) * Math.exp(-coolingRatePerS * DT);
    if (brakeForceN > 0) {
      brakeTempC += (brakeForceN * stepDistanceM) / brakeMaterial.thermalMassJPerC;
    }

    telemetry.push({
      t,
      speedKph: speedMs * 3.6,
      rpm,
      gear,
      hp: curves.powerAt(rpm),
      torqueNm,
      gForce: accelMs2 / G,
      distanceM: Math.min(distanceM, circuit.lengthM),
      brakeTempC,
      brakeForceN,
    });
  }

  const last = telemetry[telemetry.length - 1] ?? null;

  return {
    telemetry,
    testType: "hotLap",
    initialSpeedKph: startSpeedMs * 3.6,
    elapsedS: t,
    finalSpeedKph: last?.speedKph ?? 0,
    finalDistanceM: last?.distanceM ?? 0,
    reachedHundredAtS: null,
    timedOut: false,
    peakHp: curves.peakPowerHp,
    peakHpRpm: curves.peakPowerRpm,
    peakTorqueNm: curves.peakTorqueNm,
    peakTorqueRpm: curves.peakTorqueRpm,
    weightKg: vehicle.weightKg,
    powerToWeightHpPerTonne: curves.peakPowerHp / (vehicle.weightKg / 1000),
    theoreticalTopSpeedKph: estimateTopSpeedKph(curves, vehicle, 0),
    circuitId: circuit.id,
  };
}
