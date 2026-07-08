import { buildEngineCurves } from "./engineModel";
import { deriveVehicle } from "./vehicleModel";
import {
  ChassisConfig,
  EngineConfig,
  EngineCurves,
  RoadCondition,
  SimulationResult,
  Telemetry,
  TestConfig,
  VehicleSpec,
} from "./types";

const AIR_DENSITY_KG_M3 = 1.225;
const G = 9.81;
const DT = 0.02;
const HUNDRED_KPH_MS = 100 / 3.6;
const DRAG_DISTANCE_M = 500;
const TEN_SECOND_DURATION_S = 10;
const SAFETY_MAX_TIME_S = 60;

// Wheel spin is modeled as a slip window: a little intentional slip (around
// the recommended 10%) actually uses the tire's peak grip, while too little
// or too much both waste it - launching too clean under-uses the tire, and
// spinning too much just burns rubber instead of moving the car.
function wheelSpinEfficiency(wheelSpinPercent: number): number {
  const optimal = 10;
  const distance = Math.abs(wheelSpinPercent - optimal);
  return Math.max(0.55, 1 - distance / 100);
}

function conditionGripMultiplier(condition: RoadCondition): number {
  switch (condition) {
    case "dry":
      return 1.0;
    case "wind":
      return 1.0;
    case "wet":
      return 0.75;
    case "rain":
      return 0.55;
  }
}

// The "wind" condition is a steady headwind straight off the nose, which
// only ever adds to the relative airspeed (and therefore drag) - it never
// helps.
function conditionHeadwindMs(condition: RoadCondition): number {
  return condition === "wind" ? 12 : 0;
}

// With traction control off, once the tires break loose the car is at the
// mercy of kinetic friction (lower than static) until grip is regained,
// instead of the smooth, modulated cap traction control provides.
const UNCONTROLLED_SLIP_PENALTY = 0.75;

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
  headwindMs: number,
): number {
  const topGearRatio = vehicle.gearRatios[vehicle.gearRatios.length - 1];
  const rollingForce = vehicle.rollingResistanceCoefficient * vehicle.weightKg * G;

  // Torque vs RPM isn't monotonic (it rises, peaks, then tapers), so in a
  // fixed, tall top gear the drive-force-minus-resistance margin can dip
  // negative at a low speed (weak low-RPM torque) and then recover once RPM
  // climbs into the engine's strong torque band. Breaking on the first
  // negative margin would understate top speed by stopping at that early
  // dip - scan the full range and keep the highest speed that ever balances,
  // only stopping once the redline itself becomes the limiter.
  let lastValidSpeedMs = 0;
  const stepMs = 0.2;
  for (let speedMs = stepMs; speedMs < 130; speedMs += stepMs) {
    const rpm = rpmFromSpeed(speedMs, topGearRatio, vehicle);
    if (rpm > curves.maxRevRpm) break;

    const torqueNm = curves.torqueAt(rpm);
    const driveForce =
      (torqueNm * topGearRatio * vehicle.finalDrive * vehicle.drivetrainEfficiency) /
      vehicle.wheelRadiusM;
    const relativeSpeedMs = speedMs + headwindMs;
    const dragForce =
      0.5 *
      AIR_DENSITY_KG_M3 *
      vehicle.dragCoefficient *
      vehicle.frontalAreaM2 *
      relativeSpeedMs *
      relativeSpeedMs;

    if (driveForce > dragForce + rollingForce) {
      lastValidSpeedMs = speedMs;
    }
  }

  return lastValidSpeedMs * 3.6;
}

export function simulate(
  engine: EngineConfig,
  chassis: ChassisConfig,
  test: TestConfig,
): SimulationResult {
  const curves = buildEngineCurves(engine);
  const vehicle = deriveVehicle(engine, curves, chassis);

  const headwindMs = conditionHeadwindMs(test.condition);
  const effectiveMu =
    vehicle.tireGripMu *
    conditionGripMultiplier(test.condition) *
    wheelSpinEfficiency(chassis.wheelSpinPercent);
  const tractionLimit = effectiveMu * vehicle.weightKg * G;

  let speedMs = Math.max(0, test.initialSpeedKph / 3.6);
  let distanceM = 0;
  let gear = 1;
  let t = 0;
  let reachedHundredAtS: number | null = speedMs >= HUNDRED_KPH_MS ? 0 : null;

  const telemetry: Telemetry[] = [];
  const rollingForce = vehicle.rollingResistanceCoefficient * vehicle.weightKg * G;

  const shouldContinue = (): boolean => {
    if (t >= SAFETY_MAX_TIME_S) return false;
    switch (test.testType) {
      case "tenSecond":
        return t < TEN_SECOND_DURATION_S;
      case "drag500m":
        return distanceM < DRAG_DISTANCE_M;
      case "zeroToHundred":
        return speedMs < HUNDRED_KPH_MS;
    }
  };

  while (shouldContinue()) {
    const gearRatio = vehicle.gearRatios[gear - 1];
    let rpm = Math.max(rpmFromSpeed(speedMs, gearRatio, vehicle), curves.idleRpm);

    if (rpm > vehicle.shiftRpm && gear < vehicle.gearRatios.length) {
      gear += 1;
      continue;
    }
    rpm = Math.min(rpm, curves.maxRevRpm);

    const torqueNm = curves.torqueAt(rpm);
    const engineForce =
      (torqueNm * gearRatio * vehicle.finalDrive * vehicle.drivetrainEfficiency) /
      vehicle.wheelRadiusM;

    let driveForce: number;
    if (engineForce <= tractionLimit) {
      driveForce = engineForce;
    } else if (chassis.tractionControl) {
      driveForce = tractionLimit;
    } else {
      driveForce = tractionLimit * UNCONTROLLED_SLIP_PENALTY;
    }

    const relativeSpeedMs = speedMs + headwindMs;
    const dragForce =
      0.5 *
      AIR_DENSITY_KG_M3 *
      vehicle.dragCoefficient *
      vehicle.frontalAreaM2 *
      relativeSpeedMs *
      relativeSpeedMs;

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

  const last = telemetry[telemetry.length - 1] ?? null;
  const timedOut =
    test.testType === "zeroToHundred"
      ? reachedHundredAtS === null
      : test.testType === "drag500m"
        ? (last?.distanceM ?? 0) < DRAG_DISTANCE_M
        : false;

  return {
    telemetry,
    testType: test.testType,
    initialSpeedKph: test.initialSpeedKph,
    elapsedS: t,
    finalSpeedKph: last?.speedKph ?? test.initialSpeedKph,
    finalDistanceM: last?.distanceM ?? 0,
    reachedHundredAtS,
    timedOut,
    peakHp: curves.peakPowerHp,
    peakHpRpm: curves.peakPowerRpm,
    peakTorqueNm: curves.peakTorqueNm,
    peakTorqueRpm: curves.peakTorqueRpm,
    weightKg: vehicle.weightKg,
    powerToWeightHpPerTonne: curves.peakPowerHp / (vehicle.weightKg / 1000),
    theoreticalTopSpeedKph: estimateTopSpeedKph(curves, vehicle, headwindMs),
  };
}
