import { EngineConfig, EngineCurves, TestConfig, VehicleSpec } from "./types";

const BASE_CHASSIS_KG = 1100;
const CYLINDER_MASS_KG = 12;
const DISPLACEMENT_MASS_PER_L_KG = 40;
const TURBO_HARDWARE_KG = 25;
const SUPERCHARGER_HARDWARE_KG = 35;

const LAUNCH_RATIO = 3.6;
// Reference top-gear ratio for a 6-speed box. More gears spread the same
// launch-to-top range further, so each extra gear makes top gear ~7%
// taller (numerically lower); fewer gears make it shorter. This is what
// lets picking more gears meaningfully raise theoretical top speed, the
// same way a taller final-drive/overdrive gear does in a real car.
const TOP_RATIO_AT_SIX_SPEED = 0.85;
const TOP_RATIO_STEP = 0.93;
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

export function wheelDiameterToRadiusM(diameterIn: number): number {
  return (diameterIn * 0.0254) / 2;
}

export function deriveVehicle(
  engine: EngineConfig,
  curves: EngineCurves,
  test: TestConfig,
): VehicleSpec {
  let weightKg =
    BASE_CHASSIS_KG +
    engine.cylinders * CYLINDER_MASS_KG +
    engine.displacementL * DISPLACEMENT_MASS_PER_L_KG;

  if (engine.aspiration === "turbo") weightKg += TURBO_HARDWARE_KG;
  if (engine.aspiration === "supercharged") weightKg += SUPERCHARGER_HARDWARE_KG;

  // Bigger wheels/tires (diameter and width alike) add rotating mass, which
  // behaves like extra effective weight under acceleration.
  weightKg +=
    (test.frontWheelDiameterIn - REFERENCE_FRONT_DIAMETER_IN) *
      ROTATING_MASS_PER_INCH_KG +
    (test.rearWheelDiameterIn - REFERENCE_REAR_DIAMETER_IN) *
      ROTATING_MASS_PER_INCH_KG +
    (test.frontWheelWidthMm - REFERENCE_FRONT_WIDTH_MM) * WIDTH_MASS_PER_MM_KG +
    (test.rearWheelWidthMm - REFERENCE_REAR_WIDTH_MM) * WIDTH_MASS_PER_MM_KG;

  const gearCount = test.gearCount;
  const topRatio = TOP_RATIO_AT_SIX_SPEED * Math.pow(TOP_RATIO_STEP, gearCount - 6);
  const gearRatios = Array.from({ length: gearCount }, (_, i) =>
    LAUNCH_RATIO * Math.pow(topRatio / LAUNCH_RATIO, i / (gearCount - 1)),
  );

  // A wider rear (drive) tire puts more rubber on the road; a narrower one
  // less. This is the only wheel-size effect on grip - the model is RWD, so
  // the front tire doesn't factor into traction, only rotating mass.
  const rearGripMultiplier = Math.min(
    1.25,
    Math.max(
      0.8,
      1 + (test.rearWheelWidthMm - REFERENCE_REAR_WIDTH_MM) * REAR_GRIP_PER_MM,
    ),
  );

  return {
    weightKg,
    dragCoefficient: 0.3,
    frontalAreaM2: 2.2,
    rollingResistanceCoefficient: 0.013,
    drivetrainEfficiency: 0.85,
    tireGripMu: 1.0 * rearGripMultiplier,
    wheelRadiusM: wheelDiameterToRadiusM(test.rearWheelDiameterIn),
    frontWheelRadiusM: wheelDiameterToRadiusM(test.frontWheelDiameterIn),
    gearRatios,
    finalDrive: FINAL_DRIVE,
    shiftRpm: curves.redlineRpm * 0.95,
  };
}
