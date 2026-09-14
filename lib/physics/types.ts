export type EngineLayout = "inline" | "v" | "flat" | "w";
export type Aspiration = "na" | "turbo" | "supercharged";
export type FuelType = "petrol" | "diesel";
export type Drivetrain = "fwd" | "rwd" | "awd";

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
  // Rev the engine and slip the clutch instead of easing away from idle -
  // only meaningful for a standing-start acceleration/drag run (see
  // simulate.ts). Ignored otherwise.
  clutchDump: boolean;
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
  liftCoefficient: number;
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
  brakeForceN?: number;
  // Hot-lap-only channels: how much of the tyre's friction circle is being
  // used, split into its longitudinal/lateral components, plus the pedal
  // inputs and aero forces that produced this instant of the speed trace.
  lateralGForce?: number;
  throttle?: number;
  brakeInput?: number;
  tyreUtilization?: number;
  downforceN?: number;
  dragN?: number;
  curvature?: number;
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

// One sample along the circuit centerline, in real-world units. Distance,
// heading and curvature are all *derived* from the (x, y) geometry rather
// than assigned by hand - see lib/physics/circuitGeometry.ts. Curvature is
// signed (positive = turning left/CCW, negative = right/CW); 1/curvature is
// the corner radius at that point, 0 is a straight.
export interface CircuitPoint {
  distanceM: number;
  x: number;
  y: number;
  headingRad: number;
  curvature: number;
}

export interface Circuit {
  id: string;
  name: string;
  country: string;
  lengthM: number;
  corners: number;
  viewBox: string;
  outlinePath: string;
  // Track width is not known per-corner for any circuit currently in the
  // app (no survey data available) - this is a single representative
  // constant used only where a width estimate is unavoidable, not a
  // per-point measurement.
  trackWidthM: number;
  points: CircuitPoint[];
}
