import { downforceN, dragForceN } from "./aeroModel";
import { computeDrive, LongitudinalModel, SpeedProfilePoint, tyreUtilizationAt } from "./speedProfile";
import { effectiveDriveForceN, wheelSpinPercent } from "./traction";
import { AeroMode, EngineCurves, VehicleSpec } from "./types";
import { rotatingInertiaFactor } from "./vehicleDynamics";

// A deterministic virtual driver's per-point control inputs, derived from
// the already-converged speed profile rather than driven by its own
// separate logic: at any point along the lap, comparing the actual speed
// change over that step to the *maximum possible* accel/brake there (from
// the same longitudinal model the speed-profile solver used) tells you
// exactly how hard the driver must be pressing the pedal to produce that
// trace. Full throttle and full brake fall out naturally in the zones where
// the car is running at its physical limit; a gentle, partial throttle or
// brake falls out just as naturally on corner entry/exit and in the middle
// of a flat-out kink that never quite needed the whole tyre budget - this is
// what stands in for turn-in and trail braking without a separate heuristic
// bolted on top.
export interface DriverInputPoint {
  gear: number;
  rpm: number;
  torqueNm: number;
  // Power the electric motor draws here (W), and what it would draw if the
  // battery could feed all of it.
  electricPowerW: number;
  electricDemandW: number;
  throttle: number;
  brakeInput: number;
  brakeForceN: number;
  dragN: number;
  downforceN: number;
  tyreUtilization: number;
  wheelSpinPercent: number;
  accelMs2: number;
}

export function deriveDriverInputs(
  profile: SpeedProfilePoint[],
  vehicle: VehicleSpec,
  curves: EngineCurves,
  model: LongitudinalModel,
  aeroModes?: AeroMode[],
  electricAvailability?: number[],
): DriverInputPoint[] {
  const n = profile.length;
  const ds = n > 1 ? profile[1].distanceM - profile[0].distanceM : 0;

  return profile.map((point, i) => {
    const next = profile[(i + 1) % n];
    const availability = electricAvailability?.[i] ?? 1;
    const drive = computeDrive(point.speedMs, vehicle, curves, model.electricFactor(point.speedMs, availability));
    const aeroMode = aeroModes?.[i] ?? "corner";
    const aero = model.aeroVehicle(aeroMode);
    const drag = dragForceN(point.speedMs + model.headwindMs, aero);
    const downforce = downforceN(point.speedMs, aero);

    const actualAccelMs2 =
      ds > 0 ? (next.speedMs * next.speedMs - point.speedMs * point.speedMs) / (2 * ds) : 0;
    const netForceN = actualAccelMs2 * vehicle.weightKg;

    let throttle = 0;
    let brakeInput = 0;
    let brakeForceN = 0;
    let tyreForceForUtilN = 0;
    let wheelSpin = 0;
    let electricForceN = 0;
    let electricDemandForceN = 0;

    // Super-clipping (negative availability) can leave the car flat out yet
    // slowing down, with the motor taking more than drag leaves - still
    // throttle, not a coast, as long as it's driving the wheels at all.
    const superClipping = availability < 0 && netForceN + drag + model.rollingForceN >= 0;
    if (netForceN >= 0 || superClipping) {
      const driveForceUsedN = netForceN + drag + model.rollingForceN;
      const driveForceAvailN = model.availableDriveForceN(point.speedMs, point.curvature, aeroMode, availability);
      throttle = Math.min(1, Math.max(0, driveForceUsedN / Math.max(1, driveForceAvailN)));
      // The motor only covers whatever drive force the combustion engine
      // can't: no energy is spent on part throttle the ICE could manage
      // alone, or on torque the tyres couldn't put down anyway. Flat out,
      // it would use everything it had if the battery allowed.
      const iceOnlyAvailN = model.availableDriveForceN(point.speedMs, point.curvature, aeroMode, 0);
      electricForceN = Math.min(
        Math.max(0, driveForceAvailN - iceOnlyAvailN),
        Math.max(0, driveForceUsedN - iceOnlyAvailN),
      );
      electricDemandForceN =
        throttle >= 0.999
          ? Math.max(0, model.availableDriveForceN(point.speedMs, point.curvature, aeroMode, 1) - iceOnlyAvailN)
          : electricForceN;
      tyreForceForUtilN = Math.max(0, driveForceUsedN);
      // Flat out, the wheels see everything the engine sends them, even the
      // part the tyres can't use; part throttle only asks for what's used.
      const fullThrottleDemandN = effectiveDriveForceN(
        drive.engineForceN,
        drag + model.rollingForceN,
        rotatingInertiaFactor(vehicle, drive.gear),
      );
      const demandN = throttle >= 0.999 ? fullThrottleDemandN : Math.max(0, driveForceUsedN);
      wheelSpin = wheelSpinPercent(
        demandN,
        model.driveTractionLimitN(point.speedMs, point.curvature, aeroMode),
        model.tractionControl,
      );
    } else {
      const decelForceN = -netForceN;
      const engineBrakingForceN =
        (curves.frictionTorqueAt(drive.rpm) *
          vehicle.gearRatios[drive.gear - 1] *
          vehicle.finalDrive *
          vehicle.drivetrainEfficiency) /
        vehicle.wheelRadiusM;
      brakeForceN = Math.max(0, decelForceN - drag - model.rollingForceN - engineBrakingForceN);
      const brakeForceAvailN = model.availableBrakeForceN(point.speedMs, point.curvature);
      brakeInput = Math.min(1, Math.max(0, brakeForceN / Math.max(1, brakeForceAvailN)));
      tyreForceForUtilN = brakeForceN;
    }

    const tyreUtilization = tyreUtilizationAt(
      point.speedMs,
      point.curvature,
      tyreForceForUtilN,
      aero,
      model.muLong,
      model.muLat,
    );

    return {
      gear: drive.gear,
      rpm: drive.rpm,
      torqueNm: drive.torqueNm,
      // Motor output, back through the drivetrain from the wheels.
      electricPowerW: (electricForceN * point.speedMs) / vehicle.drivetrainEfficiency,
      electricDemandW: (electricDemandForceN * point.speedMs) / vehicle.drivetrainEfficiency,
      throttle,
      brakeInput,
      brakeForceN,
      dragN: drag,
      downforceN: downforce,
      tyreUtilization,
      wheelSpinPercent: wheelSpin,
      accelMs2: actualAccelMs2,
    };
  });
}
