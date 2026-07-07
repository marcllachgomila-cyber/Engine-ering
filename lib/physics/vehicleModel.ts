import { EngineConfig, EngineCurves, VehicleSpec } from "./types";

const BASE_CHASSIS_KG = 1100;
const CYLINDER_MASS_KG = 12;
const DISPLACEMENT_MASS_PER_L_KG = 40;
const TURBO_HARDWARE_KG = 25;
const SUPERCHARGER_HARDWARE_KG = 35;

const GEAR_COUNT = 6;
const LAUNCH_RATIO = 3.6;
const TOP_RATIO = 0.85;
const FINAL_DRIVE = 3.9;

export function deriveVehicle(
  engine: EngineConfig,
  curves: EngineCurves,
): VehicleSpec {
  let weightKg =
    BASE_CHASSIS_KG +
    engine.cylinders * CYLINDER_MASS_KG +
    engine.displacementL * DISPLACEMENT_MASS_PER_L_KG;

  if (engine.aspiration === "turbo") weightKg += TURBO_HARDWARE_KG;
  if (engine.aspiration === "supercharged") weightKg += SUPERCHARGER_HARDWARE_KG;

  const gearRatios = Array.from({ length: GEAR_COUNT }, (_, i) =>
    LAUNCH_RATIO * Math.pow(TOP_RATIO / LAUNCH_RATIO, i / (GEAR_COUNT - 1)),
  );

  return {
    weightKg,
    dragCoefficient: 0.3,
    frontalAreaM2: 2.2,
    rollingResistanceCoefficient: 0.013,
    drivetrainEfficiency: 0.85,
    tireGripMu: 1.0,
    wheelRadiusM: 0.33,
    gearRatios,
    finalDrive: FINAL_DRIVE,
    shiftRpm: curves.redlineRpm * 0.95,
  };
}
