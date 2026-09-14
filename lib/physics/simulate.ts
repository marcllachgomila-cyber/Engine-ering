import { ABS_OFF_PENALTY, BRAKE_MATERIALS } from "./brakeModel";
import { normalLoadN } from "./aeroModel";
import { getCircuit } from "./circuits";
import { buildEngineCurves } from "./engineModel";
import { simulateHotLap } from "./lapSimulate";
import { deriveVehicle } from "./vehicleModel";
import {
  AIR_DENSITY_KG_M3,
  conditionHeadwindMs,
  estimateTopSpeedKph,
  G,
  gearForSpeed,
  rpmFromSpeed,
  tyreGripMultiplier,
  wheelSpinEfficiency,
} from "./vehicleDynamics";
import {
  ChassisConfig,
  EngineConfig,
  EngineCurves,
  GearboxConfig,
  SimulationResult,
  Telemetry,
  TestConfig,
} from "./types";

const DT = 0.02;
const HUNDRED_KPH_MS = 100 / 3.6;
const DRAG_DISTANCE_M = 500;
const TEN_SECOND_DURATION_S = 10;
const SAFETY_MAX_TIME_S = 60;

// With traction control off, once the tires break loose the car is at the
// mercy of kinetic friction (lower than static) until grip is regained,
// instead of the smooth, modulated cap traction control provides.
const UNCONTROLLED_SLIP_PENALTY = 0.75;

// A clutch-dump launch holds the engine at its torque peak and slips the
// clutch to get there, instead of easing away from idle - the wheels see
// peak-torque-rpm-level force from the very first instant. It only applies
// while the clutch is actually slipping: once road speed (via the gear
// ratio) catches back up to that held rpm, the clutch is effectively locked
// and the engine behaves exactly as it would without a dumped clutch. That
// handoff is deliberately one-directional - rpm is only ever held up to or
// overtaken by the road-speed-derived value, never snapped back down to it.
const LAUNCH_TEST_TYPES: TestConfig["testType"][] = ["zeroToHundred", "drag500m", "tenSecond"];

// Whether a run actually gets the clutch-dump treatment - shared with
// SimulationRunner so its pre-launch rev/countdown UI only appears when the
// simulation itself will act on the option.
export function isClutchDumpLaunch(test: TestConfig): boolean {
  return test.clutchDump && test.initialSpeedKph === 0 && LAUNCH_TEST_TYPES.includes(test.testType);
}

// The rpm a clutch-dump launch holds the engine at - also used by
// SimulationRunner to rev the audio/gauges to the same value during the
// pre-launch countdown.
export function computeLaunchRpm(curves: EngineCurves): number {
  return Math.min(Math.max(curves.peakTorqueRpm, curves.idleRpm), curves.maxRevRpm);
}

export interface CruiseState {
  gear: number;
  rpm: number;
}

// What the engine is doing while cruising at a steady speed before a test
// actually starts - used by the braking test's lead-in, where the car holds
// the chosen speed (and the audio/gauges reflect it) before the countdown.
export function computeCruiseState(
  engine: EngineConfig,
  chassis: ChassisConfig,
  gearbox: GearboxConfig,
  speedKph: number,
): CruiseState {
  const curves = buildEngineCurves(engine);
  const vehicle = deriveVehicle(engine, curves, chassis, gearbox);
  const speedMs = Math.max(0, speedKph / 3.6);
  const gear = gearForSpeed(speedMs, vehicle, curves);
  const rpm = Math.min(
    Math.max(rpmFromSpeed(speedMs, vehicle.gearRatios[gear - 1], vehicle), curves.idleRpm),
    curves.maxRevRpm,
  );
  return { gear, rpm };
}

export function simulate(
  engine: EngineConfig,
  chassis: ChassisConfig,
  gearbox: GearboxConfig,
  test: TestConfig,
): SimulationResult {
  if (test.testType === "hotLap") {
    return simulateHotLap(engine, chassis, gearbox, test, getCircuit(test.circuitId));
  }

  const curves = buildEngineCurves(engine);
  const vehicle = deriveVehicle(engine, curves, chassis, gearbox);

  const headwindMs = conditionHeadwindMs(test.condition);
  const gripMultiplier = tyreGripMultiplier(
    chassis.tyreType,
    chassis.tyreCompound,
    test.condition,
  );
  const effectiveMu =
    vehicle.tireGripMu * gripMultiplier * wheelSpinEfficiency(chassis.wheelSpinPercent);

  // Traction/braking limits scale with normal (tyre) load, not just static
  // weight - aero downforce adds to it at speed, aero lift (boxy road
  // bodies) subtracts from it, exactly as in the hot-lap model.
  const tractionLimitAt = (speedMs: number): number =>
    effectiveMu * normalLoadN(speedMs, vehicle, G);

  // Braking isn't limited by launch wheel-spin tuning - it's modeled as an
  // idealized max-effort stop (perfect ABS, no lock-up), so it only inherits
  // the tire's grip and the road condition, not the wheelspin term above.
  const brakingTractionLimitAt = (speedMs: number): number =>
    vehicle.tireGripMu * gripMultiplier * normalLoadN(speedMs, vehicle, G);

  let speedMs = Math.max(0, test.initialSpeedKph / 3.6);
  let distanceM = 0;
  let gear = test.testType === "braking" ? gearForSpeed(speedMs, vehicle, curves) : 1;
  let t = 0;
  let brakeTempC = test.initialBrakeTempC;
  const brakeMaterial = BRAKE_MATERIALS[test.brakeMaterial];
  let reachedHundredAtS: number | null = speedMs >= HUNDRED_KPH_MS ? 0 : null;

  const clutchDumpActive = isClutchDumpLaunch(test);
  const launchRpm = computeLaunchRpm(curves);

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
      case "braking":
        return speedMs > 0;
      case "hotLap":
        return false;
    }
  };

  while (shouldContinue()) {
    if (test.testType === "braking") {
      const brakeEffectiveness =
        brakeMaterial.effectivenessAt(brakeTempC) * (test.absEnabled ? 1 : ABS_OFF_PENALTY);
      const brakeForce = brakingTractionLimitAt(speedMs) * brakeEffectiveness;

      const relativeSpeedMs = speedMs + headwindMs;
      const dragForce =
        0.5 *
        AIR_DENSITY_KG_M3 *
        vehicle.dragCoefficient *
        vehicle.frontalAreaM2 *
        relativeSpeedMs *
        relativeSpeedMs;
      const decelForce = brakeForce + dragForce + rollingForce;
      const accelMs2 = -decelForce / vehicle.weightKg;

      speedMs = Math.max(0, speedMs + accelMs2 * DT);
      const stepDistanceM = speedMs * DT;
      distanceM += stepDistanceM;
      t += DT;

      // Heat generated by the brakes doing work this step raises their
      // temperature, which feeds back into effectiveness on the next step -
      // a long, hard stop can fade the brakes before the car is done slowing.
      brakeTempC += (brakeForce * stepDistanceM) / brakeMaterial.thermalMassJPerC;

      gear = gearForSpeed(speedMs, vehicle, curves);
      const rpm = Math.min(
        Math.max(rpmFromSpeed(speedMs, vehicle.gearRatios[gear - 1], vehicle), curves.idleRpm),
        curves.maxRevRpm,
      );

      telemetry.push({
        t,
        speedKph: speedMs * 3.6,
        rpm,
        gear,
        hp: 0,
        torqueNm: 0,
        gForce: accelMs2 / G,
        distanceM,
        brakeTempC,
      });
      continue;
    }

    const gearRatio = vehicle.gearRatios[gear - 1];
    let rpm = Math.max(rpmFromSpeed(speedMs, gearRatio, vehicle), curves.idleRpm);

    // Still slipping: held at launch rpm until road speed's natural rpm
    // catches up to it, at which point the clutch locks up.
    const clutchSlipping = clutchDumpActive && gear === 1 && rpm < launchRpm;
    if (clutchSlipping) rpm = launchRpm;

    if (rpm > vehicle.shiftRpm && gear < vehicle.gearRatios.length) {
      gear += 1;
      continue;
    }
    rpm = Math.min(rpm, curves.maxRevRpm);

    const torqueNm = curves.torqueAt(rpm);
    const engineForce =
      (torqueNm * gearRatio * vehicle.finalDrive * vehicle.drivetrainEfficiency) /
      vehicle.wheelRadiusM;

    const tractionLimit = tractionLimitAt(speedMs);
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
        : test.testType === "braking"
          ? (last?.speedKph ?? 0) > 0.5
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
