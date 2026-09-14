import { downforceN, dragForceN } from "./aeroModel";
import { computeDrive, LongitudinalModel, SpeedProfilePoint, tyreUtilizationAt } from "./speedProfile";
import { EngineCurves, VehicleSpec } from "./types";

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
  throttle: number;
  brakeInput: number;
  brakeForceN: number;
  dragN: number;
  downforceN: number;
  tyreUtilization: number;
  accelMs2: number;
}

export function deriveDriverInputs(
  profile: SpeedProfilePoint[],
  vehicle: VehicleSpec,
  curves: EngineCurves,
  model: LongitudinalModel,
): DriverInputPoint[] {
  const n = profile.length;
  const ds = n > 1 ? profile[1].distanceM - profile[0].distanceM : 0;

  return profile.map((point, i) => {
    const next = profile[(i + 1) % n];
    const drive = computeDrive(point.speedMs, vehicle, curves);
    const drag = dragForceN(point.speedMs + model.headwindMs, vehicle);
    const downforce = downforceN(point.speedMs, vehicle);

    const actualAccelMs2 =
      ds > 0 ? (next.speedMs * next.speedMs - point.speedMs * point.speedMs) / (2 * ds) : 0;
    const netForceN = actualAccelMs2 * vehicle.weightKg;

    let throttle = 0;
    let brakeInput = 0;
    let brakeForceN = 0;
    let tyreForceForUtilN = 0;

    if (netForceN >= 0) {
      const driveForceUsedN = netForceN + drag + model.rollingForceN;
      const driveForceAvailN = model.availableDriveForceN(point.speedMs, point.curvature);
      throttle = Math.min(1, Math.max(0, driveForceUsedN / Math.max(1, driveForceAvailN)));
      tyreForceForUtilN = Math.max(0, driveForceUsedN);
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
      vehicle,
      model.muLong,
      model.muLat,
    );

    return {
      gear: drive.gear,
      rpm: drive.rpm,
      torqueNm: drive.torqueNm,
      throttle,
      brakeInput,
      brakeForceN,
      dragN: drag,
      downforceN: downforce,
      tyreUtilization,
      accelMs2: actualAccelMs2,
    };
  });
}
