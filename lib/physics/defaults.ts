import { DEFAULT_CIRCUIT_ID } from "./circuits";
import { recommendedGearRatios } from "./gearRatios";
import { BodyType, ChassisConfig, EngineConfig, GearboxConfig, TestConfig } from "./types";

export const DEFAULT_ENGINE: EngineConfig = {
  cylinders: 4,
  layout: "inline",
  displacementL: 2.0,
  redlineRpm: 7000,
  maxRevRpm: 7300,
  aspiration: "na",
  fuelType: "petrol",
};

export const DEFAULT_GEARBOX: GearboxConfig = {
  transmissionType: "manual",
  gearCount: 6,
  gearRatios: recommendedGearRatios(6),
  drivetrain: "rwd",
  dualClutch: false,
  autoShiftStrategy: "maxRpm",
};

export interface BodyTypePreset {
  weightKg: number;
  weightMinKg: number;
  weightMaxKg: number;
  dragCoefficient: number;
  frontalAreaM2: number;
  // Lift coefficient (sign convention: positive = downforce, negative =
  // aerodynamic lift). Road-going boxy shapes with no underbody/wing
  // aggressively worked tend to generate a small amount of *lift* at speed
  // (less effective tyre load, not more); a supercar's splitter/diffuser/
  // wing package instead generates real downforce. These are representative
  // order-of-magnitude figures, not measured wind-tunnel data for any real
  // car - see the hot-lap report for what data would replace them.
  liftCoefficient: number;
}

export const BODY_TYPE_PRESETS: Record<BodyType, BodyTypePreset> = {
  minivan: {
    weightKg: 1800,
    weightMinKg: 1400,
    weightMaxKg: 2400,
    dragCoefficient: 0.33,
    frontalAreaM2: 2.8,
    liftCoefficient: -0.05,
  },
  suv: {
    weightKg: 2100,
    weightMinKg: 1700,
    weightMaxKg: 2800,
    dragCoefficient: 0.38,
    frontalAreaM2: 3.1,
    liftCoefficient: -0.1,
  },
  supercar: {
    weightKg: 1400,
    weightMinKg: 1100,
    weightMaxKg: 1900,
    dragCoefficient: 0.3,
    frontalAreaM2: 1.9,
    liftCoefficient: 0.9,
  },
};

export const DEFAULT_CHASSIS: ChassisConfig = {
  bodyType: "supercar",
  weightKg: BODY_TYPE_PRESETS.supercar.weightKg,
  tyrePressurePsi: 32,
  wheelSpinPercent: 10,
  tractionControl: true,
  frontWheelDiameterIn: 25,
  rearWheelDiameterIn: 26,
  frontWheelWidthMm: 235,
  rearWheelWidthMm: 275,
  tyreType: "standard",
  tyreCompound: "medium",
};

export const DEFAULT_TEST_CONFIG: TestConfig = {
  testType: "tenSecond",
  condition: "dry",
  initialSpeedKph: 0,
  absEnabled: true,
  initialBrakeTempC: 80,
  brakeMaterial: "steel",
  circuitId: DEFAULT_CIRCUIT_ID,
};

export const DIESEL_MAX_REDLINE_RPM = 5200;
