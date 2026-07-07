export type EngineLayout = "inline" | "v" | "flat" | "w";
export type Aspiration = "na" | "turbo" | "supercharged";

export interface EngineConfig {
  cylinders: number;
  layout: EngineLayout;
  displacementL: number;
  redlineRpm: number;
  aspiration: Aspiration;
}

export type TestType = "zeroToHundred" | "tenSecond" | "drag500m";
export type RoadCondition = "dry" | "wet" | "rain" | "wind";

export interface TestConfig {
  testType: TestType;
  gearCount: number;
  wheelSpinPercent: number;
  tractionControl: boolean;
  condition: RoadCondition;
  frontWheelDiameterIn: number;
  rearWheelDiameterIn: number;
}

export interface EngineCurves {
  torqueAt: (rpm: number) => number;
  powerAt: (rpm: number) => number;
  idleRpm: number;
  redlineRpm: number;
  peakTorqueNm: number;
  peakTorqueRpm: number;
  peakPowerHp: number;
  peakPowerRpm: number;
}

export interface VehicleSpec {
  weightKg: number;
  dragCoefficient: number;
  frontalAreaM2: number;
  rollingResistanceCoefficient: number;
  drivetrainEfficiency: number;
  tireGripMu: number;
  wheelRadiusM: number;
  frontWheelRadiusM: number;
  gearRatios: number[];
  finalDrive: number;
  shiftRpm: number;
}

export interface Telemetry {
  t: number;
  speedKph: number;
  rpm: number;
  gear: number;
  hp: number;
  torqueNm: number;
  gForce: number;
  distanceM: number;
}

export interface SimulationResult {
  telemetry: Telemetry[];
  testType: TestType;
  elapsedS: number;
  finalSpeedKph: number;
  finalDistanceM: number;
  reachedHundredAtS: number | null;
  timedOut: boolean;
  peakHp: number;
  peakHpRpm: number;
  peakTorqueNm: number;
  peakTorqueRpm: number;
  weightKg: number;
  powerToWeightHpPerTonne: number;
  theoreticalTopSpeedKph: number;
}

export interface CarSpec {
  make: string;
  model: string;
  year: number;
  cylinders: number;
  layout: EngineLayout;
  displacementL: number;
  aspiration: Aspiration;
  hp: number;
  torqueNm: number;
  weightKg: number;
  zeroToHundredS: number;
}

export interface MatchResult {
  car: CarSpec;
  distance: number;
}
