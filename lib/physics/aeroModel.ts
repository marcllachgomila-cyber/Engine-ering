import { AeroMode, VehicleSpec } from "./types";
import { AIR_DENSITY_KG_M3 } from "./vehicleDynamics";

// The car as it is aerodynamically in the given active-aero mode: straight
// mode swaps in the preset's low-drag coefficients, everything else is
// untouched. Every drag/downforce/normal-load function below reads the
// coefficients off the vehicle it's handed, so passing this one is all it
// takes for the mode to reach drag, traction, cornering and braking alike.
// Cars without active aero are always in corner mode.
export function aeroModeVehicle(vehicle: VehicleSpec, mode: AeroMode): VehicleSpec {
  if (mode === "corner" || !vehicle.activeAero) return vehicle;
  return {
    ...vehicle,
    dragCoefficient: vehicle.activeAero.dragCoefficientStraight,
    liftCoefficient: vehicle.activeAero.liftCoefficientStraight,
  };
}

// Standard quadratic aerodynamic drag: grows with the square of relative
// airspeed, dominates resistance only as a car approaches top speed.
export function dragForceN(relativeSpeedMs: number, vehicle: VehicleSpec): number {
  return (
    0.5 *
    AIR_DENSITY_KG_M3 *
    vehicle.dragCoefficient *
    vehicle.frontalAreaM2 *
    relativeSpeedMs *
    relativeSpeedMs
  );
}

// Same quadratic form as drag, using the lift coefficient instead of drag.
// Positive liftCoefficient is genuine downforce (extra tyre load); negative
// is aerodynamic lift (less tyre load) - see defaults.ts for which body
// types get which sign. Uses road speed, not relative-to-air speed: a
// headwind changes drag but doesn't meaningfully change how hard the car's
// own aero surfaces press onto the road under it.
export function downforceN(speedMs: number, vehicle: VehicleSpec): number {
  return (
    0.5 *
    AIR_DENSITY_KG_M3 *
    vehicle.liftCoefficient *
    vehicle.frontalAreaM2 *
    speedMs *
    speedMs
  );
}

// Total normal (vertical) load the tyres press onto the road with: static
// weight plus/minus whatever aero downforce or lift is doing at this speed.
// Floored well above zero - a real car doesn't lose meaningful static
// contact patch at any speed this simulator reaches, and letting normal
// load hit zero would blow up the friction-circle math in tyreModel.ts.
export function normalLoadN(speedMs: number, vehicle: VehicleSpec, gravityMs2: number): number {
  const staticLoadN = vehicle.weightKg * gravityMs2;
  const aeroLoadN = downforceN(speedMs, vehicle);
  return Math.max(0.2 * staticLoadN, staticLoadN + aeroLoadN);
}
