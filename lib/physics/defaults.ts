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
  gearCount: 6,
  drivetrain: "rwd",
};

export interface BodyTypePreset {
  weightKg: number;
  weightMinKg: number;
  weightMaxKg: number;
  dragCoefficient: number;
  frontalAreaM2: number;
}

export const BODY_TYPE_PRESETS: Record<BodyType, BodyTypePreset> = {
  minivan: {
    weightKg: 1800,
    weightMinKg: 1400,
    weightMaxKg: 2400,
    dragCoefficient: 0.33,
    frontalAreaM2: 2.8,
  },
  suv: {
    weightKg: 2100,
    weightMinKg: 1700,
    weightMaxKg: 2800,
    dragCoefficient: 0.38,
    frontalAreaM2: 3.1,
  },
  supercar: {
    weightKg: 1400,
    weightMinKg: 1100,
    weightMaxKg: 1900,
    dragCoefficient: 0.3,
    frontalAreaM2: 1.9,
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
};

export const DIESEL_MAX_REDLINE_RPM = 5200;
