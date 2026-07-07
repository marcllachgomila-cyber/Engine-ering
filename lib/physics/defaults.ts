import { EngineConfig, TestConfig } from "./types";

export const DEFAULT_ENGINE: EngineConfig = {
  cylinders: 4,
  layout: "inline",
  displacementL: 2.0,
  redlineRpm: 7000,
  aspiration: "na",
  fuelType: "petrol",
};

export const DEFAULT_TEST_CONFIG: TestConfig = {
  testType: "tenSecond",
  gearCount: 6,
  wheelSpinPercent: 10,
  tractionControl: true,
  condition: "dry",
  frontWheelDiameterIn: 25,
  rearWheelDiameterIn: 26,
  frontWheelWidthMm: 235,
  rearWheelWidthMm: 275,
};

export const DIESEL_MAX_REDLINE_RPM = 5200;
