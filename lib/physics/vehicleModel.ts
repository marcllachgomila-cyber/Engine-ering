import { EngineConfig, EngineCurves, TestConfig, VehicleSpec } from "./types";

const BASE_CHASSIS_KG = 1100;
const CYLINDER_MASS_KG = 12;
const DISPLACEMENT_MASS_PER_L_KG = 40;
const TURBO_HARDWARE_KG = 25;
const SUPERCHARGER_HARDWARE_KG = 35;

const LAUNCH_RATIO = 3.6;
const TOP_RATIO = 0.85;
const FINAL_DRIVE = 3.9;

// Reference wheel sizes the base chassis weight/traction figures assume.
// Deviating from these adds/removes rotating mass (harder to spin up bigger
// wheels) and, for the rear (drive) tire, changes the contact patch and
// therefore the traction limit.
const REFERENCE_FRONT_DIAMETER_IN = 25;
const REFERENCE_REAR_DIAMETER_IN = 26;
const ROTATING_MASS_PER_INCH_KG = 3.5;
const REAR_GRIP_PER_INCH = 0.008;

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

  // Bigger wheels/tires add rotating mass, which behaves like extra
  // effective weight under acceleration (more inertia to spin up).
  weightKg +=
    (test.frontWheelDiameterIn - REFERENCE_FRONT_DIAMETER_IN) *
      ROTATING_MASS_PER_INCH_KG +
    (test.rearWheelDiameterIn - REFERENCE_REAR_DIAMETER_IN) *
      ROTATING_MASS_PER_INCH_KG;

  const gearCount = test.gearCount;
  const gearRatios = Array.from({ length: gearCount }, (_, i) =>
    LAUNCH_RATIO * Math.pow(TOP_RATIO / LAUNCH_RATIO, i / (gearCount - 1)),
  );

  // A wider rear (drive) tire puts more rubber on the road; a narrower one
  // less. This is the only wheel-size effect on grip - the model is RWD, so
  // front tire size doesn't factor into traction, only rotating mass.
  const rearGripMultiplier = Math.min(
    1.15,
    Math.max(
      0.85,
      1 + (test.rearWheelDiameterIn - REFERENCE_REAR_DIAMETER_IN) * REAR_GRIP_PER_INCH,
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
