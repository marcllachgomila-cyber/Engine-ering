import { aeroModeVehicle } from "./aeroModel";
import { BRAKE_AMBIENT_TEMP_C, BRAKE_MATERIALS, brakeCoolingRatePerS } from "./brakeModel";
import { DriverInputPoint, deriveDriverInputs } from "./driverModel";
import { buildEngineCurves } from "./engineModel";
import { LongitudinalModel, SpeedProfilePoint, buildLongitudinalModel, computeSpeedProfile } from "./speedProfile";
import { computeWeightBreakdown, deriveVehicle } from "./vehicleModel";
import {
  ActiveAeroConfig,
  AeroMode,
  Circuit,
  ChassisConfig,
  EngineConfig,
  EngineCurves,
  ErsConfig,
  GearboxConfig,
  SimulationResult,
  Telemetry,
  TestConfig,
  VehicleSpec,
} from "./types";
import { G, estimateTopSpeedKph } from "./vehicleDynamics";

// Below this speed, a distance-domain dt = ds / v integration blows up
// numerically. A hot lap's speed profile should never actually get this
// low (see UNCONSTRAINED_SPEED_MS/cornering-limit floor in
// speedProfile.ts) - this only guards against pathological configurations
// (e.g. near-zero grip) so the simulation stays finite instead of
// producing Infinity/NaN lap times.
const MIN_INTEGRATION_SPEED_MS = 0.3;

// Most re-solves of the lap spent letting the active-aero modes and battery
// deployment settle (see solveHotLap) - a backstop, it normally takes a
// handful - and the lap-time change between re-solves that counts as
// settled.
const MAX_LAP_ITERATIONS = 30;
const LAP_TIME_TOLERANCE_S = 1e-4;

// Bisection steps for the charge a flying lap starts (and ends) on - 40
// halvings of a few MJ is far below a joule.
const SOC_BISECTION_STEPS = 40;

// The search for the fastest speed to start super-clipping above (see
// solveHotLap): a coarse sweep from SUPER_CLIP_SEARCH_MIN_KPH up to where
// the rules stop deployment anyway, then a finer one around the best.
const SUPER_CLIP_SEARCH_MIN_KPH = 100;
const SUPER_CLIP_COARSE_STEP_KPH = 20;
const SUPER_CLIP_FINE_STEP_KPH = 5;

const RPM_TO_RAD_S = (2 * Math.PI) / 60;

// Where the wings are over the lap, given what the driver is doing at every
// point: straight mode once the car is flat out, off the brakes and on a
// gentle enough curve, corner mode again the moment it brakes, lifts or the
// curve tightens past the (smaller) exit radius. A flying lap is a loop, so
// it's walked twice and the second time round kept - that way the lap
// starts in whatever mode the end of the previous lap left the wings in.
// Then any stretch too short to be worth opening the wings for is dropped.
function aeroModesFor(
  profile: SpeedProfilePoint[],
  inputs: DriverInputPoint[],
  activeAero: ActiveAeroConfig,
  flying: boolean,
): AeroMode[] {
  const n = profile.length;
  const ds = n > 1 ? profile[1].distanceM - profile[0].distanceM : 0;
  const modes: AeroMode[] = new Array(n).fill("corner");
  let straight = false;
  for (let k = 0; k < (flying ? 2 : 1) * n; k++) {
    const i = k % n;
    const flatOut = inputs[i].throttle >= activeAero.straightModeMinThrottle && inputs[i].brakeForceN <= 0;
    const radiusM = 1 / Math.max(1e-9, Math.abs(profile[i].curvature));
    const canOpen = flatOut && radiusM >= activeAero.straightModeMinRadiusM;
    const canStay = flatOut && radiusM >= activeAero.straightModeExitRadiusM;
    straight = straight ? canStay : canOpen;
    modes[i] = straight ? "straight" : "corner";
  }

  // Scan the runs of straight mode starting from a corner-mode point, so a
  // run that spans the start/finish line is measured as one run.
  const anchor = modes.indexOf("corner");
  if (anchor < 0 || ds <= 0) return modes;
  let runStart = -1;
  for (let k = 1; k <= n; k++) {
    const i = (anchor + k) % n;
    if (modes[i] === "straight") {
      if (runStart < 0) runStart = k;
    } else if (runStart >= 0) {
      if ((k - runStart) * ds < activeAero.straightModeMinZoneM) {
        for (let j = runStart; j < k; j++) modes[(anchor + j) % n] = "corner";
      }
      runStart = -1;
    }
  }
  return modes;
}

// The battery over one lap (engine.ers): how much of the electric motor it
// can feed at each point, its state of charge, and the motor's power -
// positive deploying, negative harvesting.
export interface BatteryLap {
  availability: number[];
  socJ: number[];
  motorPowerW: number[];
  startSocJ: number;
  deployedJ: number;
  harvestedJ: number;
  // The part of harvestedJ recovered on throttle, and the time spent doing so.
  superClipHarvestedJ: number;
  superClipTimeS: number;
}

// One lap of the battery over a fixed speed profile, from startSocJ. The
// motor harvests under braking - as much of the braking force as its power
// limit allows (brake-by-wire hands the rest to the friction brakes, so the
// car decelerates the same either way) - and deploys whatever the driver
// model asks of it (DriverInputPoint.electricDemandW) for as long as there's
// charge and per-lap allowance left: flat out until it runs dry. That spends
// it coming out of the corners first - each braking zone recharges the
// battery right before the next exit - and whatever is left on the
// straights, where the rules' high-speed taper cuts deployment anyway.
// Flat out inside superClipZone it super-clips instead: harvests at up to
// ers.superClipPowerKw, while there's room in the battery and the lap's
// harvest allowance.
function walkBattery(
  profile: SpeedProfilePoint[],
  inputs: DriverInputPoint[],
  vehicle: VehicleSpec,
  curves: EngineCurves,
  ers: ErsConfig,
  startSocJ: number,
  superClipZone: boolean[] | null,
): BatteryLap {
  const n = profile.length;
  const ds = n > 1 ? profile[1].distanceM - profile[0].distanceM : 0;
  const capacityJ = ers.batteryCapacityMJ * 1e6;
  const harvestLimitW = ers.harvestPowerKw * 1e3;
  const superClipW = ers.superClipPowerKw * 1e3;
  const availability: number[] = new Array(n);
  const socJ: number[] = new Array(n);
  const motorPowerW: number[] = new Array(n);
  let soc = startSocJ;
  let deployedJ = 0;
  let harvestedJ = 0;
  let superClipHarvestedJ = 0;
  let superClipTimeS = 0;
  for (let i = 0; i < n; i++) {
    const speedMs = Math.max(MIN_INTEGRATION_SPEED_MS, profile[i].speedMs);
    const dt = ds / speedMs;
    const input = inputs[i];
    if (input.brakeForceN > 0) {
      const wantedJ = Math.min(harvestLimitW, input.brakeForceN * speedMs * vehicle.drivetrainEfficiency) * dt;
      const gotJ = Math.max(0, Math.min(wantedJ, capacityJ - soc, ers.maxHarvestPerLapMJ * 1e6 - harvestedJ));
      soc += gotJ;
      harvestedJ += gotJ;
      availability[i] = 1;
      motorPowerW[i] = dt > 0 ? -gotJ / dt : 0;
    } else if (superClipW > 0 && superClipZone?.[i] && input.throttle >= 0.999) {
      const gotJ = Math.max(
        0,
        Math.min(superClipW * dt, capacityJ - soc, ers.maxHarvestPerLapMJ * 1e6 - harvestedJ),
      );
      soc += gotJ;
      harvestedJ += gotJ;
      superClipHarvestedJ += gotJ;
      if (gotJ > 0) superClipTimeS += dt;
      // As a (negative) share of what the motor could deploy at these revs.
      const motorMaxW = curves.electricTorqueAt(input.rpm) * input.rpm * RPM_TO_RAD_S;
      availability[i] = motorMaxW > 0 && dt > 0 ? -Math.min(1, gotJ / dt / motorMaxW) : 0;
      motorPowerW[i] = dt > 0 ? -gotJ / dt : 0;
    } else {
      const wantedJ = input.electricDemandW * dt;
      const canJ = Math.max(0, Math.min(soc, ers.maxDeployPerLapMJ * 1e6 - deployedJ));
      const gotJ = Math.min(wantedJ, canJ);
      availability[i] = wantedJ > 0 ? gotJ / wantedJ : canJ > 0 ? 1 : 0;
      soc -= gotJ;
      deployedJ += gotJ;
      motorPowerW[i] = dt > 0 ? gotJ / dt : 0;
    }
    socJ[i] = soc;
  }
  return { availability, socJ, motorPowerW, startSocJ, deployedJ, harvestedJ, superClipHarvestedJ, superClipTimeS };
}

// A flying lap is one of many identical laps, so the battery has to end it
// exactly as charged as it started it - otherwise the lap is borrowing (or
// banking) energy another lap would pay for. The charge the lap ends on only
// ever rises with the charge it starts on, never faster, so bisect for the
// one it gives back unchanged. A standing start is the first lap of a race
// instead: it starts fully charged and keeps whatever is left.
function solveBattery(
  profile: SpeedProfilePoint[],
  inputs: DriverInputPoint[],
  vehicle: VehicleSpec,
  curves: EngineCurves,
  ers: ErsConfig,
  flying: boolean,
  superClipZone: boolean[] | null,
): BatteryLap {
  const walk = (startSocJ: number) => walkBattery(profile, inputs, vehicle, curves, ers, startSocJ, superClipZone);
  const capacityJ = ers.batteryCapacityMJ * 1e6;
  const full = walk(capacityJ);
  if (!flying || full.socJ[full.socJ.length - 1] >= capacityJ) return full;
  let low = 0;
  let high = capacityJ;
  for (let k = 0; k < SOC_BISECTION_STEPS; k++) {
    const mid = (low + high) / 2;
    const lap = walk(mid);
    if (lap.socJ[lap.socJ.length - 1] >= mid) low = mid;
    else high = mid;
  }
  return walk(low);
}

function profileLapTimeS(profile: SpeedProfilePoint[]): number {
  const ds = profile.length > 1 ? profile[1].distanceM - profile[0].distanceM : 0;
  return profile.reduce((t, p) => t + ds / Math.max(MIN_INTEGRATION_SPEED_MS, p.speedMs), 0);
}

export interface HotLapSolution {
  curves: EngineCurves;
  vehicle: VehicleSpec;
  model: LongitudinalModel;
  profile: SpeedProfilePoint[];
  inputs: DriverInputPoint[];
  // Active-aero mode at each profile point (all corner mode without it).
  aeroModes: AeroMode[];
  // Null without an energy store (engine.ers): the motor is then never
  // short of energy.
  battery: BatteryLap | null;
  // The car super-clips wherever it would be flat out above this speed
  // without super-clipping (null: it doesn't super-clip).
  superClipMinKph: number | null;
  // Lap time over the profile, without gear-shift dead time.
  lapTimeS: number;
  // Re-solves of the whole lap it took to converge (for the chosen
  // super-clip speed), and in total including the search for it.
  iterations: number;
  totalIterations: number;
}

// The speed profile and driver inputs for one lap. Two things on the car
// depend on what the driver is doing, which in turn depends on the speed
// profile they produce: the active-aero mode at each point, and how much of
// the electric motor the battery can still feed there. So solve with a
// first guess (corner mode everywhere, a bottomless battery), read both off
// the result, and re-solve with them - the forward/backward passes then
// see the new drive force - until the lap time stops changing.
//
// Super-clipping trades straight-line speed for energy to deploy out of
// the corners, and where that trade pays depends on the car and the track,
// so rather than being a fixed setting it's searched for: the car
// super-clips wherever the lap without it is flat out above some speed -
// the ends of the straights - and that speed is whichever gives the fastest
// lap over a sweep of them (never super-clipping included). The zones are
// fixed from that reference lap rather than following the car's speed as
// it re-solves: super-clipping slows the car, which would otherwise drop it
// out of its own zone and flick it on and off every re-solve.
export function solveHotLap(
  engine: EngineConfig,
  chassis: ChassisConfig,
  gearbox: GearboxConfig,
  test: TestConfig,
  circuit: Circuit,
): HotLapSolution {
  const curves = buildEngineCurves(engine);
  const vehicle = deriveVehicle(engine, curves, chassis, gearbox);
  const ers = engine.ers;
  const model = buildLongitudinalModel(vehicle, chassis, curves, test, ers);
  const flying = test.lapStartMode === "flying";
  let totalIterations = 0;

  const solve = (
    superClipMinKph: number | null,
    superClipZone: boolean[] | null,
    start: HotLapSolution | null,
  ): HotLapSolution => {
    let aeroModes: AeroMode[] = start ? start.aeroModes : circuit.points.map(() => "corner");
    let availability: number[] = start?.battery ? start.battery.availability : circuit.points.map(() => 1);
    let lapTimeS = Infinity;
    for (let k = 1; ; k++) {
      const profile = computeSpeedProfile(circuit.points, vehicle, model, test.lapStartMode, aeroModes, availability);
      const inputs = deriveDriverInputs(profile, vehicle, curves, model, aeroModes, availability);
      const battery = ers ? solveBattery(profile, inputs, vehicle, curves, ers, flying, superClipZone) : null;
      const nextModes = vehicle.activeAero ? aeroModesFor(profile, inputs, vehicle.activeAero, flying) : aeroModes;
      const nextLapTimeS = profileLapTimeS(profile);
      const settled =
        (!vehicle.activeAero && !ers) ||
        (nextModes.every((mode, i) => mode === aeroModes[i]) &&
          Math.abs(nextLapTimeS - lapTimeS) < LAP_TIME_TOLERANCE_S);
      if (settled || k >= MAX_LAP_ITERATIONS) {
        totalIterations += k;
        return {
          curves,
          vehicle,
          model,
          profile,
          inputs,
          aeroModes,
          battery,
          superClipMinKph,
          lapTimeS: nextLapTimeS,
          iterations: k,
          totalIterations,
        };
      }
      lapTimeS = nextLapTimeS;
      aeroModes = nextModes;
      if (battery) availability = battery.availability;
    }
  };

  const reference = solve(null, null, null);
  let best = reference;
  if (ers && ers.superClipPowerKw > 0) {
    const tried = new Set<number>();
    const tryAt = (kph: number) => {
      if (tried.has(kph)) return;
      tried.add(kph);
      const zone = reference.profile.map(
        (p, i) => p.speedMs * 3.6 >= kph && reference.inputs[i].throttle >= 0.999 && reference.inputs[i].brakeForceN <= 0,
      );
      if (!zone.includes(true)) return;
      const attempt = solve(kph, zone, reference);
      if (attempt.lapTimeS < best.lapTimeS) best = attempt;
    };
    for (let kph = SUPER_CLIP_SEARCH_MIN_KPH; kph <= ers.deployTaperEndKph; kph += SUPER_CLIP_COARSE_STEP_KPH) {
      tryAt(kph);
    }
    const coarseBest = best.superClipMinKph;
    if (coarseBest !== null) {
      for (let d = -SUPER_CLIP_COARSE_STEP_KPH + SUPER_CLIP_FINE_STEP_KPH; d < SUPER_CLIP_COARSE_STEP_KPH; d += SUPER_CLIP_FINE_STEP_KPH) {
        if (d !== 0) tryAt(coarseBest + d);
      }
    }
  }
  return { ...best, totalIterations };
}

// One theoretical flying lap of a circuit, calculated (not guessed) end to
// end:
//
//   vehicle config -> engine/gearbox -> wheel force -> tyre limits
//   -> aerodynamics -> braking/acceleration -> circuit curvature
//   -> virtual driver -> speed profile -> telemetry -> lap time
//
// circuit.points already carries distance/heading/curvature derived purely
// from the track's geometry (circuitGeometry.ts); this function's job is to
// find the fastest speed the car can carry at every one of those points
// (computeSpeedProfile), turn that into per-point pedal/gear inputs
// (deriveDriverInputs), and integrate dt = ds / v along the lap to get both
// the telemetry trace and the final lap time - never the other way around.
export function simulateHotLap(
  engine: EngineConfig,
  chassis: ChassisConfig,
  gearbox: GearboxConfig,
  test: TestConfig,
  circuit: Circuit,
): SimulationResult {
  const { curves, vehicle, profile, inputs, aeroModes, battery } = solveHotLap(engine, chassis, gearbox, test, circuit);

  const n = profile.length;
  const ds = n > 1 ? profile[1].distanceM - profile[0].distanceM : circuit.lengthM;

  let t = 0;
  let brakeTempC = test.initialBrakeTempC;
  const brakeMaterial = BRAKE_MATERIALS[test.brakeMaterial];
  let prevGear = inputs[0]?.gear ?? 1;

  const telemetry: Telemetry[] = [];
  let peakWheelSpinPercent = 0;

  for (let i = 0; i < n; i++) {
    const point = profile[i];
    const input = inputs[i];

    // Each gear change (vehicle.shiftTimeS, see vehicleModel.ts) is added
    // as dead time on the lap clock rather than modeled inside the
    // speed-position solve, which works in distance, not time, and doesn't
    // need discrete events to find the fastest achievable speed at each
    // point.
    if (input.gear !== prevGear) {
      t += vehicle.shiftTimeS;
      prevGear = input.gear;
    }

    // A standing start begins the lap at rest, so holding this point's own
    // speed constant across the segment (the usual approximation, fine when
    // consecutive points are close in speed) would wildly overstate the
    // time for that first, near-zero-speed segment. Use the segment's
    // average speed instead - exact for the constant-acceleration launch
    // the speed profile itself already assumes.
    const integrationSpeedMs =
      i === 0 && test.lapStartMode === "standing" && n > 1
        ? Math.max(MIN_INTEGRATION_SPEED_MS, (point.speedMs + profile[1].speedMs) / 2)
        : Math.max(MIN_INTEGRATION_SPEED_MS, point.speedMs);
    const dt = ds / integrationSpeedMs;
    t += dt;

    // Air cooling relaxes the brakes toward ambient every step - faster at
    // speed on a straight, slower through a slow corner - then any heat
    // generated by braking this step piles back on top.
    const coolingRatePerS = brakeCoolingRatePerS(point.speedMs);
    brakeTempC = BRAKE_AMBIENT_TEMP_C + (brakeTempC - BRAKE_AMBIENT_TEMP_C) * Math.exp(-coolingRatePerS * dt);
    if (input.brakeForceN > 0) {
      brakeTempC += (input.brakeForceN * ds) / brakeMaterial.thermalMassJPerC;
    }

    peakWheelSpinPercent = Math.max(peakWheelSpinPercent, input.wheelSpinPercent);
    telemetry.push({
      t,
      speedKph: point.speedMs * 3.6,
      rpm: input.rpm,
      gear: input.gear,
      // What the power unit can give here: the combustion engine plus
      // whatever share of the motor the battery and the rules allow.
      hp: (input.torqueNm * input.rpm * ((2 * Math.PI) / 60)) / 745.7,
      torqueNm: input.torqueNm,
      gForce: input.accelMs2 / G,
      distanceM: point.distanceM,
      brakeTempC,
      brakeForceN: input.brakeForceN,
      lateralGForce: (point.speedMs * point.speedMs * point.curvature) / G,
      throttle: input.throttle,
      brakeInput: input.brakeInput,
      tyreUtilization: input.tyreUtilization,
      wheelSpinPercent: input.wheelSpinPercent,
      downforceN: input.downforceN,
      dragN: input.dragN,
      curvature: point.curvature,
      aeroMode: vehicle.activeAero ? aeroModes[i] : undefined,
      batterySocMJ: battery ? battery.socJ[i] / 1e6 : undefined,
      mguKPowerKw: battery ? battery.motorPowerW[i] / 1e3 : undefined,
    });
  }

  const last = telemetry[telemetry.length - 1] ?? null;

  return {
    telemetry,
    testType: "hotLap",
    initialSpeedKph: profile[0]?.speedMs !== undefined ? profile[0].speedMs * 3.6 : 0,
    elapsedS: t,
    finalSpeedKph: last?.speedKph ?? 0,
    finalDistanceM: circuit.racingLineLengthM,
    reachedHundredAtS: null,
    timedOut: false,
    peakHp: curves.peakPowerHp,
    peakHpRpm: curves.peakPowerRpm,
    peakTorqueNm: curves.peakTorqueNm,
    peakTorqueRpm: curves.peakTorqueRpm,
    weightKg: vehicle.weightKg,
    weightBreakdown: computeWeightBreakdown(engine, chassis, gearbox).components,
    powerToWeightHpPerTonne: curves.peakPowerHp / (vehicle.weightKg / 1000),
    // Flat out on a straight is straight mode for a car with active aero.
    theoreticalTopSpeedKph: estimateTopSpeedKph(curves, aeroModeVehicle(vehicle, "straight"), 0),
    peakWheelSpinPercent,
    circuitId: circuit.id,
  };
}
