// "rotary" is a Wankel engine - for it, `cylinders` on EngineConfig/CarSpec
// holds the rotor count (see engineLayout.ts for the helpers that interpret it).
export type EngineLayout = "inline" | "v" | "flat" | "w" | "rotary";
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
  // Boost pressure above atmospheric, in bar - only meaningful for turbo/
  // supercharged engines. Undefined falls back to a per-aspiration default
  // (see engineModel.ts). It scales peak BMEP, and so peak torque.
  boostBar?: number;
  // Optional override for the naturally aspirated peak BMEP (bar) that
  // boost then multiplies. Only real-car presets set it, for engines well
  // off the typical figure (e.g. a race-bred, high-revving NA V10).
  baseBmepBar?: number;
  // Electric motor contribution (e.g. an F1 power unit's MGU-K) layered on
  // top of the combustion curve below - undefined/0 for every non-hybrid
  // engine. Modeled as available from idle up to redline, torque-capped at
  // hybridMaxTorqueNm at low rpm and power-capped at hybridBoostKw above
  // the rpm where that torque cap would exceed the power cap - the same
  // torque-then-power-limited shape a real electric motor has, rather than
  // a flat torque bonus that would make it strongest exactly where it's
  // least realistic (screaming near the limiter).
  hybridBoostKw?: number;
  hybridMaxTorqueNm?: number;
  // The energy store behind the motor, for a hot lap only (see
  // lapSimulate.ts). Undefined = unlimited energy, which is close enough
  // for any single straight-line test.
  ers?: ErsConfig;
}

// A hybrid's battery ("energy store") and the rules on how it's charged and
// spent over a lap.
export interface ErsConfig {
  // Most electrical energy the motor may deploy / harvest over one lap.
  maxDeployPerLapMJ: number;
  maxHarvestPerLapMJ: number;
  // Usable state-of-charge window.
  batteryCapacityMJ: number;
  // Most power the motor can recover while braking.
  harvestPowerKw: number;
  // Most power it may recover while the driver is still flat out
  // ("super-clipping"): the motor loads the engine and takes that power
  // away from the wheels. Where on the lap it does so is chosen by the lap
  // solver (see lapSimulate.ts); 0 turns it off.
  superClipPowerKw: number;
  // The motor's deployment power limit ramps linearly from full at
  // deployTaperStartKph down to nothing at deployTaperEndKph.
  deployTaperStartKph: number;
  deployTaperEndKph: number;
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
  // Final drive (differential) ratio. Undefined means "recommended": geared
  // so top gear reaches the engine's power peak right at the drag-limited
  // top speed (see vehicleModel.ts).
  finalDrive?: number;
}

export interface RealCarPreset {
  id: string;
  make: string;
  model: string;
  category: BodyType;
  engine: EngineConfig;
  gearbox: Omit<GearboxConfig, "gearRatios">;
  chassis: Pick<
    ChassisConfig,
    | "weightKg"
    | "frontWheelDiameterIn"
    | "rearWheelDiameterIn"
    | "frontWheelWidthMm"
    | "rearWheelWidthMm"
    | "activeAero"
  >;
  // Car-specific rationale for a modeling choice that doesn't fit the
  // general disclaimers in realCars.ts (e.g. why a particular season's
  // hybrid figures are what they are) - optional, shown nowhere in the UI
  // yet, just carried alongside the data for whoever's reading the file.
  notes?: string;
  // Optional dedicated 3D model for the viewer. Presets without one (and
  // custom builds) show their body type's generic model instead.
  model3d?: VehicleModelRef;
}

// A preset's own 3D model (its "model3d" field - "model" is the car's
// name): a GLB under public/models/, loaded only while that preset is
// selected. Every third-party model must carry its credit
// and licence here - the viewer displays them, and the generator script
// refuses a model without them.
export interface VehicleModelRef {
  // File name under public/models/, e.g. "mclaren-720s.glb".
  file: string;
  // Rotation about the vertical axis (degrees) that turns the model's nose
  // to face +X, the viewer's forward direction. Models are otherwise
  // auto-fitted: scaled so their length matches the preset's body length
  // and set down on the ground plane.
  yawDeg?: number;
  credit: {
    title: string;
    author: string;
    // Where the model was obtained, so the licence can be checked.
    sourceUrl: string;
    // SPDX-style identifier, e.g. "CC0-1.0" or "CC-BY-4.0".
    license: string;
  };
}

export type BodyType = "minivan" | "suv" | "supercar" | "f1";

// Exterior size of a body style, in metres. Representative figures for the
// class (like the rest of BODY_TYPE_PRESETS), not any one car's spec sheet.
// Wheelbase lives alongside these on the preset since the physics already
// uses it. Nothing in the simulation reads these yet - they exist so the 3D
// viewer and any future aero model size the car from the same numbers.
export interface BodyDimensions {
  lengthM: number;
  // Overall body width, mirrors excluded.
  widthM: number;
  heightM: number;
  // Wheel centre-to-centre distance across each axle.
  frontTrackM: number;
  rearTrackM: number;
  // Static ground clearance under the main floor.
  rideHeightM: number;
}

// Movable-wing aero (the 2026 F1 rules' replacement for DRS): the car runs
// its normal high-downforce "corner mode" (the body type's
// dragCoefficient/liftCoefficient, see defaults.ts) except on straights,
// where the wings open into a low-drag, low-downforce "straight mode".
// Hot-lap only (see lapSimulate.ts) - undefined for every car without it.
export type AeroMode = "corner" | "straight";

export interface ActiveAeroConfig {
  // Straight-mode aero coefficients, same conventions and frontal area as
  // the corner-mode ones.
  dragCoefficientStraight: number;
  liftCoefficientStraight: number;
  // Straight mode opens only where the corner radius is at least
  // straightModeMinRadiusM (and the car is flat out and off the brakes),
  // and once open stays open until the radius drops below the smaller
  // straightModeExitRadiusM - a hysteresis band, so a radius hovering
  // around the threshold doesn't flick the wings open and shut.
  straightModeMinRadiusM: number;
  straightModeExitRadiusM: number;
  // Throttle (0-1) that counts as "flat out" for straight mode.
  straightModeMinThrottle: number;
  // Straight-mode stretches shorter than this are skipped - the wings stay
  // shut rather than blip open for a few metres before a corner. Like the
  // real cars' pre-defined activation zones, this is decided for the whole
  // lap up front. It never keeps them open longer: closing on braking or a
  // lift is always immediate.
  straightModeMinZoneM: number;
}
export type TyreType = "slick" | "standard";
export type TyreCompound = "soft" | "medium" | "hard" | "intermediate" | "wet";

export interface ChassisConfig {
  bodyType: BodyType;
  weightKg: number;
  tyrePressurePsi: number;
  tractionControl: boolean;
  frontWheelDiameterIn: number;
  rearWheelDiameterIn: number;
  frontWheelWidthMm: number;
  rearWheelWidthMm: number;
  tyreType: TyreType;
  tyreCompound: TyreCompound;
  // Only set by a real-car preset that has it (F1 2026).
  activeAero?: ActiveAeroConfig;
  // Bolt-on aero and ride height for a custom road car (see aeroKit.ts).
  // Undefined = the body type as standard, exactly as before this existed,
  // so older saved configurations load unchanged.
  aeroKit?: AeroKitConfig;
}

export type RearWing = "none" | "low" | "high";
export type Underbody = "standard" | "diffuser";

export interface AeroKitConfig {
  // Body raised (+) or lowered (-) from the body type's standard ride
  // height; the wheels stay where they are.
  rideHeightOffsetMm: number;
  rearWing: RearWing;
  frontSplitter: boolean;
  // "diffuser" = a flat floor ending in a rear diffuser.
  underbody: Underbody;
}

export type TestType = "zeroToHundred" | "tenSecond" | "drag500m" | "braking" | "hotLap";
export type RoadCondition = "dry" | "wet" | "rain" | "wind";
export type BrakeMaterial = "steel" | "ceramic" | "carbon";
// A hot lap either starts already at speed, as if arriving from the corner
// before the line (a qualifying "flying lap"), or from a dead stop on the
// line itself, lights-out style. Only meaningful when testType is "hotLap".
export type LapStartMode = "flying" | "standing";

export interface TestConfig {
  testType: TestType;
  condition: RoadCondition;
  initialSpeedKph: number;
  absEnabled: boolean;
  initialBrakeTempC: number;
  brakeMaterial: BrakeMaterial;
  circuitId: string;
  lapStartMode: LapStartMode;
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
  // The electric motor's share of torqueAt (0 for a non-hybrid).
  electricTorqueAt: (rpm: number) => number;
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
  drivetrain: Drivetrain;
  // Axle geometry for longitudinal weight transfer: wheelbase L, the share
  // of static weight on the rear axle (b/L, where b is the CG-to-front-axle
  // distance) and the centre-of-gravity height h.
  wheelbaseM: number;
  rearWeightFraction: number;
  cgHeightM: number;
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
  // Seconds with no drive force during each upshift.
  shiftTimeS: number;
  activeAero?: ActiveAeroConfig;
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
  // How much faster the driven wheels are turning than the road (slip
  // ratio, %) - an output of the traction model, not an input.
  wheelSpinPercent?: number;
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
  // Only on cars with active aero.
  aeroMode?: AeroMode;
  // Only on cars with an energy store (engine.ers): battery state of charge,
  // and motor power - positive deploying, negative harvesting.
  batterySocMJ?: number;
  mguKPowerKw?: number;
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
  // Estimated split of weightKg into major components; sums to weightKg.
  weightBreakdown: WeightComponent[];
  powerToWeightHpPerTonne: number;
  theoreticalTopSpeedKph: number;
  // Highest driven-wheel slip seen during the run (%).
  peakWheelSpinPercent: number;
  circuitId?: string;
}

export interface WeightComponent {
  label: string;
  kg: number;
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
  // Length of the racing line `points` trace - a little shorter than
  // lengthM (the surveyed centerline), since it cuts the corners. Lap
  // progress along `points` is measured against this.
  racingLineLengthM: number;
}
