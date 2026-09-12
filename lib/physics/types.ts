export type EngineLayout = "inline" | "v" | "flat" | "w";
export type Aspiration = "na" | "turbo" | "supercharged";
export type FuelType = "petrol" | "diesel";
export type Drivetrain = "fwd" | "rwd";

export interface EngineConfig {
  cylinders: number;
  layout: EngineLayout;
  displacementL: number;
  redlineRpm: number;
  maxRevRpm: number;
  aspiration: Aspiration;
  fuelType: FuelType;
  gearCount: number;
  drivetrain: Drivetrain;
}

export type BodyType = "minivan" | "suv" | "supercar";

export interface ChassisConfig {
  bodyType: BodyType;
  weightKg: number;
  tyrePressurePsi: number;
  wheelSpinPercent: number;
  tractionControl: boolean;
  frontWheelDiameterIn: number;
  rearWheelDiameterIn: number;
  frontWheelWidthMm: number;
  rearWheelWidthMm: number;
}

export type TestType = "zeroToHundred" | "tenSecond" | "drag500m" | "braking";
export type RoadCondition = "dry" | "wet" | "rain" | "wind";

export interface TestConfig {
  testType: TestType;
  condition: RoadCondition;
  initialSpeedKph: number;
}

export interface EngineCurves {
  torqueAt: (rpm: number) => number;
  powerAt: (rpm: number) => number;
  frictionTorqueAt: (rpm: number) => number;
  combustionTorqueAt: (rpm: number) => number;
  idleRpm: number;
  redlineRpm: number;
  maxRevRpm: number;
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
  initialSpeedKph: number;
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

export interface ForcePoint {
  speedKph: number;
  forceN: number;
}

export interface GearForceCurve {
  gear: number;
  points: ForcePoint[];
}

export interface TractiveForceData {
  gearCurves: GearForceCurve[];
  resistanceCurve: ForcePoint[];
}
