import { EngineConfig, TestConfig } from "./types";

export const DEFAULT_ENGINE: EngineConfig = {
  cylinders: 4,
  layout: "inline",
  displacementL: 2.0,
  redlineRpm: 7000,
  aspiration: "na",
};

export const DEFAULT_TEST_CONFIG: TestConfig = {
  testType: "tenSecond",
  gearCount: 6,
  wheelSpinPercent: 10,
  tractionControl: true,
  condition: "dry",
  frontWheelDiameterIn: 25,
  rearWheelDiameterIn: 26,
};
