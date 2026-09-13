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
}

export type TransmissionType = "manual" | "auto";
export type AutoShiftStrategy = "maxRpm" | "maxTorque" | "maxPower";

export interface GearboxConfig {
  transmissionType: TransmissionType;
  gearCount: number;
  gearRatios: number[];
  drivetrain: Drivetrain;
  dualClutch: boolean;
  autoShiftStrategy: AutoShiftStrategy;
}

export type BodyType = "minivan" | "suv" | "supercar";
export type TyreType = "slick" | "standard";
export type TyreCompound = "soft" | "medium" | "hard" | "intermediate" | "wet";

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
  tyreType: TyreType;
  tyreCompound: TyreCompound;
}

export type TestType = "zeroToHundred" | "tenSecond" | "drag500m" | "braking" | "hotLap";
export type RoadCondition = "dry" | "wet" | "rain" | "wind";
export type BrakeMaterial = "steel" | "ceramic" | "carbon";

export interface TestConfig {
  testType: TestType;
  condition: RoadCondition;
  initialSpeedKph: number;
  absEnabled: boolean;
  initialBrakeTempC: number;
  brakeMaterial: BrakeMaterial;
  circuitId: string;
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
  brakeTempC?: number;
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
  circuitId?: string;
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

export type CircuitCornerClass = "hairpin" | "tight" | "medium" | "fast" | "veryFast";

export type CircuitSegment =
  | { type: "straight"; lengthM: number }
  | { type: "corner"; lengthM: number; radiusM: number };

export interface Circuit {
  id: string;
  name: string;
  country: string;
  lengthM: number;
  corners: number;
  viewBox: string;
  outlinePath: string;
  segments: CircuitSegment[];
}
