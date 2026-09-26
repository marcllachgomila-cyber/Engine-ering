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

// Starting point when switching to a rotary - Mazda's 13B as fitted to the
// RX-8 (two 654cc rotors, 9,000rpm redline). `cylinders` is the rotor count.
export const DEFAULT_ROTARY_ENGINE: EngineConfig = {
  cylinders: 2,
  layout: "rotary",
  displacementL: 1.3,
  redlineRpm: 9000,
  maxRevRpm: 9400,
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
  // Total (kerb) weight, everything included - what the Weight slider sets.
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
  // Axle geometry for weight transfer (see traction.ts): wheelbase, share
  // of static weight on the rear axle, and centre-of-gravity height.
  // Representative figures for the body style, not any one car.
  wheelbaseM: number;
  rearWeightFraction: number;
  cgHeightM: number;
  // Tyre sidewall height as a fraction of tread width (the "35" in
  // 285/35 R20). Rolling radius = rim radius + sidewall.
  tyreAspectRatio: number;
  // Cold pressure the tyres are happiest at - grip falls away either side
  // of it (vehicleModel.ts). Road tyres run in the low-to-mid 30s, heavier
  // bodies a little higher; F1's big low-profile slicks run far lower.
  optimalTyrePressurePsi: number;
}

export const BODY_TYPE_PRESETS: Record<BodyType, BodyTypePreset> = {
  minivan: {
    weightKg: 2000,
    weightMinKg: 1500,
    weightMaxKg: 2600,
    dragCoefficient: 0.33,
    frontalAreaM2: 2.8,
    liftCoefficient: -0.05,
    // Transverse engine over the front wheels.
    wheelbaseM: 3.0,
    rearWeightFraction: 0.43,
    cgHeightM: 0.65,
    tyreAspectRatio: 0.6,
    optimalTyrePressurePsi: 36,
  },
  suv: {
    weightKg: 2100,
    weightMinKg: 1400,
    weightMaxKg: 3000,
    dragCoefficient: 0.38,
    frontalAreaM2: 3.1,
    liftCoefficient: -0.1,
    wheelbaseM: 2.9,
    rearWeightFraction: 0.47,
    cgHeightM: 0.7,
    tyreAspectRatio: 0.5,
    optimalTyrePressurePsi: 34,
  },
  supercar: {
    weightKg: 1500,
    weightMinKg: 1100,
    weightMaxKg: 2100,
    dragCoefficient: 0.39,
    frontalAreaM2: 1.95,
    liftCoefficient: 0.9,
    // Mid/rear engine: most of the weight over the driven rear axle.
    wheelbaseM: 2.65,
    rearWeightFraction: 0.59,
    cgHeightM: 0.43,
    tyreAspectRatio: 0.3,
    optimalTyrePressurePsi: 32,
  },
  f1: {
    weightKg: 798,
    weightMinKg: 700,
    weightMaxKg: 850,
    // Open wheels and a barn-door front wing mean far more drag than any
    // closed-bodywork car here, but it's paired with by far the highest
    // lift coefficient - the whole car is one big wing.
    dragCoefficient: 0.9,
    frontalAreaM2: 1.5,
    liftCoefficient: 3.0,
    wheelbaseM: 3.6,
    rearWeightFraction: 0.55,
    cgHeightM: 0.28,
    // Unused - F1 tyres are specified by outer diameter (see
    // vehicleModel.ts), not aspect ratio.
    tyreAspectRatio: 0.45,
    optimalTyrePressurePsi: 22,
  },
};

export const DEFAULT_CHASSIS: ChassisConfig = {
  bodyType: "supercar",
  weightKg: BODY_TYPE_PRESETS.supercar.weightKg,
  tyrePressurePsi: 32,
  tractionControl: true,
  frontWheelDiameterIn: 20,
  rearWheelDiameterIn: 21,
  frontWheelWidthMm: 235,
  rearWheelWidthMm: 275,
  tyreType: "standard",
  tyreCompound: "medium",
};

// The tyres a body type rolls out on: F1 cars run soft slicks at their low
// F1 pressure, everything else standard mediums at its own pressure.
export function defaultTyresFor(
  bodyType: BodyType,
): Pick<ChassisConfig, "tyreType" | "tyreCompound" | "tyrePressurePsi"> {
  return {
    tyreType: bodyType === "f1" ? "slick" : "standard",
    tyreCompound: bodyType === "f1" ? "soft" : "medium",
    tyrePressurePsi: BODY_TYPE_PRESETS[bodyType].optimalTyrePressurePsi,
  };
}

export const DEFAULT_TEST_CONFIG: TestConfig = {
  testType: "tenSecond",
  condition: "dry",
  initialSpeedKph: 0,
  absEnabled: true,
  initialBrakeTempC: 80,
  brakeMaterial: "steel",
  circuitId: DEFAULT_CIRCUIT_ID,
  lapStartMode: "flying",
  clutchDump: false,
};

export const DIESEL_MAX_REDLINE_RPM = 5200;
