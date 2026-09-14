import { BODY_TYPE_PRESETS } from "./defaults";
import { recommendedGearRatios } from "./gearRatios";
import { ChassisConfig, EngineConfig, EngineCurves, GearboxConfig, VehicleSpec } from "./types";

const CYLINDER_MASS_KG = 12;
const DISPLACEMENT_MASS_PER_L_KG = 40;
const TURBO_HARDWARE_KG = 25;
const SUPERCHARGER_HARDWARE_KG = 35;

const FINAL_DRIVE = 3.9;

// Reference wheel sizes the base chassis weight/traction figures assume.
// Diameter mainly changes gearing (rpm-to-speed) and rotating mass; width
// is what actually puts more rubber on the road, so it drives grip.
const REFERENCE_FRONT_DIAMETER_IN = 25;
const REFERENCE_REAR_DIAMETER_IN = 26;
const REFERENCE_FRONT_WIDTH_MM = 235;
const REFERENCE_REAR_WIDTH_MM = 275;
const ROTATING_MASS_PER_INCH_KG = 3.5;
const WIDTH_MASS_PER_MM_KG = 0.15;
const REAR_GRIP_PER_MM = 0.0018;

// A little under-inflation or over-inflation is fine; further from the
// recommended pressure steadily costs grip in either direction.
const OPTIMAL_TYRE_PRESSURE_PSI = 32;
const GRIP_LOSS_PER_PSI = 0.012;

// Under hard acceleration, weight transfers toward the rear axle - RWD cars
// are pushed onto their drive wheels by that transfer (grip goes up right
// when you need it), while FWD cars have weight lifted off their drive
// wheels at the exact same moment, making them more prone to wheelspin.
const FWD_TRACTION_PENALTY = 0.88;

// AWD splits power across all four contact patches, so it doesn't rely on
// weight transfer the way RWD does and shrugs off wheelspin better than
// either two-wheel-drive layout - at the cost of some efficiency lost to
// the extra transfer case and front differential.
const AWD_TRACTION_BONUS = 1.1;
const AWD_DRIVETRAIN_EFFICIENCY = 0.8;
const DRIVETRAIN_EFFICIENCY = 0.85;

// Shift right before the hard limiter rather than the tuned redline, so a
// higher max-rev setting genuinely extends each gear's pull. Manual boxes
// (and the default "max RPM" auto strategy) always shift here, on the
// assumption of a driver who takes every gear to the limiter; the other
// auto strategies instead short-shift at the torque or power peak.
function computeShiftRpm(curves: EngineCurves, gearbox: GearboxConfig): number {
  if (gearbox.transmissionType === "auto") {
    switch (gearbox.autoShiftStrategy) {
      case "maxTorque":
        return curves.peakTorqueRpm;
      case "maxPower":
        return curves.peakPowerRpm;
      case "maxRpm":
        break;
    }
  }
  return curves.maxRevRpm * 0.97;
}

export function wheelDiameterToRadiusM(diameterIn: number): number {
  return (diameterIn * 0.0254) / 2;
}

export function deriveVehicle(
  engine: EngineConfig,
  curves: EngineCurves,
  chassis: ChassisConfig,
  gearbox: GearboxConfig,
): VehicleSpec {
  const preset = BODY_TYPE_PRESETS[chassis.bodyType];

  let weightKg =
    chassis.weightKg +
    engine.cylinders * CYLINDER_MASS_KG +
    engine.displacementL * DISPLACEMENT_MASS_PER_L_KG;

  if (engine.aspiration === "turbo") weightKg += TURBO_HARDWARE_KG;
  if (engine.aspiration === "supercharged") weightKg += SUPERCHARGER_HARDWARE_KG;

  // Bigger wheels/tires (diameter and width alike) add rotating mass, which
  // behaves like extra effective weight under acceleration.
  weightKg +=
    (chassis.frontWheelDiameterIn - REFERENCE_FRONT_DIAMETER_IN) *
      ROTATING_MASS_PER_INCH_KG +
    (chassis.rearWheelDiameterIn - REFERENCE_REAR_DIAMETER_IN) *
      ROTATING_MASS_PER_INCH_KG +
    (chassis.frontWheelWidthMm - REFERENCE_FRONT_WIDTH_MM) * WIDTH_MASS_PER_MM_KG +
    (chassis.rearWheelWidthMm - REFERENCE_REAR_WIDTH_MM) * WIDTH_MASS_PER_MM_KG;

  // Custom ratios are trusted as long as they match the chosen gear count;
  // otherwise (e.g. gear count just changed) fall back to the recommended
  // spread rather than indexing into a mismatched array.
  const gearRatios =
    gearbox.gearRatios.length === gearbox.gearCount
      ? gearbox.gearRatios
      : recommendedGearRatios(gearbox.gearCount);

  // Whichever axle is driven is the one that puts power down, so its tire
  // width (contact patch) and diameter (gearing) are what matter for
  // traction and the rpm-to-speed relationship - not always the rear. AWD
  // drives both axles, so it splits the difference between the two.
  const isRwd = gearbox.drivetrain === "rwd";
  const isAwd = gearbox.drivetrain === "awd";
  const driveWidthMm = isAwd
    ? (chassis.frontWheelWidthMm + chassis.rearWheelWidthMm) / 2
    : isRwd
      ? chassis.rearWheelWidthMm
      : chassis.frontWheelWidthMm;
  const driveReferenceWidthMm = isAwd
    ? (REFERENCE_FRONT_WIDTH_MM + REFERENCE_REAR_WIDTH_MM) / 2
    : isRwd
      ? REFERENCE_REAR_WIDTH_MM
      : REFERENCE_FRONT_WIDTH_MM;
  const driveDiameterIn = isAwd
    ? (chassis.frontWheelDiameterIn + chassis.rearWheelDiameterIn) / 2
    : isRwd
      ? chassis.rearWheelDiameterIn
      : chassis.frontWheelDiameterIn;

  const driveGripMultiplier = Math.min(
    1.25,
    Math.max(0.8, 1 + (driveWidthMm - driveReferenceWidthMm) * REAR_GRIP_PER_MM),
  );

  const pressureGripMultiplier = Math.max(
    0.7,
    1 -
      Math.abs(chassis.tyrePressurePsi - OPTIMAL_TYRE_PRESSURE_PSI) *
        GRIP_LOSS_PER_PSI,
  );

  const drivetrainGripMultiplier = isAwd ? AWD_TRACTION_BONUS : isRwd ? 1 : FWD_TRACTION_PENALTY;

  return {
    weightKg,
    dragCoefficient: preset.dragCoefficient,
    frontalAreaM2: preset.frontalAreaM2,
    liftCoefficient: preset.liftCoefficient,
    rollingResistanceCoefficient: 0.013,
    drivetrainEfficiency: isAwd ? AWD_DRIVETRAIN_EFFICIENCY : DRIVETRAIN_EFFICIENCY,
    tireGripMu: driveGripMultiplier * pressureGripMultiplier * drivetrainGripMultiplier,
    wheelRadiusM: wheelDiameterToRadiusM(driveDiameterIn),
    frontWheelRadiusM: wheelDiameterToRadiusM(chassis.frontWheelDiameterIn),
    gearRatios,
    finalDrive: FINAL_DRIVE,
    shiftRpm: computeShiftRpm(curves, gearbox),
  };
}
