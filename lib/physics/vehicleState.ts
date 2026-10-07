import { AeroContribution, aeroKitAvailable, aeroKitContributions, STOCK_AERO_KIT } from "./aeroKit";
import { BODY_TYPE_PRESETS, defaultTyresFor } from "./defaults";
import { buildEngineCurves } from "./engineModel";
import { engineSizeLabel } from "./engineLayout";
import { deriveVehicle, tyreRadiusM } from "./vehicleModel";
import {
  ActiveAeroConfig,
  AeroKitConfig,
  AutoShiftStrategy,
  BodyDimensions,
  BodyType,
  ChassisConfig,
  Drivetrain,
  EngineConfig,
  GearboxConfig,
  RealCarPreset,
  TransmissionType,
  TyreCompound,
  TyreType,
  VehicleModelRef,
} from "./types";

// One read-only snapshot of "the car as currently configured", for anything
// that needs to know about the whole vehicle at once (the live preview, the
// upcoming 3D viewer and aero model) rather than one form's slice of it.
//
// It's a *view*, not new state: the app still owns chassis/engine/gearbox/
// realCar as separate useState values (the forms, favorites and simulations
// are all built on those), and this is rebuilt from them on every change.
// Everything physical is read off deriveVehicle()/buildEngineCurves() - the
// exact objects the simulations use - so what this reports can never drift
// from what the simulation actually runs.

export interface VehicleIdentity {
  // Real-car preset id, or null for a custom build.
  presetId: string | null;
  make: string | null;
  model: string | null;
  // "McLaren 720S", or "Custom supercar" for a custom build.
  displayName: string;
  bodyType: BodyType;
  // The preset's dedicated 3D model, if it has one.
  model3d: VehicleModelRef | null;
}

export interface VehicleDimensions extends BodyDimensions {
  wheelbaseM: number;
}

export interface VehicleMass {
  totalKg: number;
  // Static share of totalKg on the rear axle (b/L).
  rearWeightFraction: number;
  frontAxleKg: number;
  rearAxleKg: number;
  cgHeightM: number;
}

export interface VehicleEngine {
  config: EngineConfig;
  sizeLabel: string;
  // Combined (combustion + any hybrid motor) peaks, from the modeled curves.
  peakPowerHp: number;
  peakPowerRpm: number;
  peakTorqueNm: number;
  peakTorqueRpm: number;
  // Electric motor output on top of the combustion engine; null if none.
  hybridPowerKw: number | null;
  powerToWeightHpPerTonne: number;
}

export interface VehicleDrivetrain {
  layout: Drivetrain;
  transmissionType: TransmissionType;
  dualClutch: boolean;
  autoShiftStrategy: AutoShiftStrategy;
  gearCount: number;
  // The ratios actually used (falls back to the recommended spread when the
  // configured list doesn't match the gear count, same as the simulation).
  gearRatios: number[];
  finalDrive: number;
  // True when finalDrive was auto-geared rather than set by hand.
  finalDriveIsRecommended: boolean;
  efficiency: number;
  shiftRpm: number;
}

export interface VehicleAxleTyre {
  rimDiameterIn: number;
  widthMm: number;
  rollingRadiusM: number;
}

export interface VehicleTyres {
  front: VehicleAxleTyre;
  rear: VehicleAxleTyre;
  type: TyreType;
  compound: TyreCompound;
  pressurePsi: number;
  optimalPressurePsi: number;
  // Dry-road friction coefficient before compound/condition multipliers.
  baseGripMu: number;
  tractionControl: boolean;
  // Rolling resistance force = this x weight x g (constant with speed).
  rollingResistanceCoefficient: number;
}

export interface VehicleAero {
  // Body-type representative figures (see BODY_TYPE_PRESETS) - estimates,
  // not measured data for any specific car.
  dragCoefficient: number;
  // Positive = downforce, negative = lift (same convention as aeroModel.ts).
  liftCoefficient: number;
  frontalAreaM2: number;
  // Cd*A and Cl*A: the products the force equations actually use.
  dragAreaM2: number;
  liftAreaM2: number;
  // Low-drag straight-mode coefficients, for presets that have them.
  activeAero: ActiveAeroConfig | null;
  // The body type's own coefficients before any aero kit, the kit itself
  // (null = standard), and its effect part by part - so a UI can show how
  // the totals above were reached.
  baseDragCoefficient: number;
  baseLiftCoefficient: number;
  kit: AeroKitConfig | null;
  kitContributions: AeroContribution[];
}

// A setting that differs from the baseline the car started from: the real
// car's preset (plus its default tyres), or the body type's defaults for a
// custom build.
export interface VehicleModification {
  field:
    | "weightKg"
    | "tyreType"
    | "tyreCompound"
    | "tyrePressurePsi"
    | "tractionControl"
    | "rideHeightOffsetMm"
    | "rearWing"
    | "frontSplitter"
    | "underbody";
  label: string;
  baseline: string | number | boolean;
  current: string | number | boolean;
}

export interface VehicleState {
  identity: VehicleIdentity;
  dimensions: VehicleDimensions;
  mass: VehicleMass;
  engine: VehicleEngine;
  drivetrain: VehicleDrivetrain;
  tyres: VehicleTyres;
  aero: VehicleAero;
  modifications: VehicleModification[];
}

const BODY_TYPE_NAMES: Record<BodyType, string> = {
  minivan: "minivan",
  suv: "SUV",
  supercar: "supercar",
  f1: "F1 car",
};

function findModifications(
  chassis: ChassisConfig,
  realCar: RealCarPreset | null,
): VehicleModification[] {
  // Presets are applied with traction control left as-is and a custom
  // build starts with it on (DEFAULT_CHASSIS), so "on" is the baseline
  // either way.
  const baseline = {
    weightKg: realCar ? realCar.chassis.weightKg : BODY_TYPE_PRESETS[chassis.bodyType].weightKg,
    ...defaultTyresFor(chassis.bodyType),
    tractionControl: true,
  };
  const checks: [VehicleModification["field"], string, string | number | boolean, string | number | boolean][] = [
    ["weightKg", "Weight", baseline.weightKg, chassis.weightKg],
    ["tyreType", "Tyre type", baseline.tyreType, chassis.tyreType],
    ["tyreCompound", "Tyre compound", baseline.tyreCompound, chassis.tyreCompound],
    ["tyrePressurePsi", "Tyre pressure", baseline.tyrePressurePsi, chassis.tyrePressurePsi],
    ["tractionControl", "Traction control", baseline.tractionControl, chassis.tractionControl],
  ];
  // Aero kit parts, against the standard car (only where the kit applies).
  const kit = aeroKitAvailable(chassis.bodyType) ? chassis.aeroKit : undefined;
  if (kit) {
    checks.push(
      ["rideHeightOffsetMm", "Ride height offset (mm)", STOCK_AERO_KIT.rideHeightOffsetMm, kit.rideHeightOffsetMm],
      ["rearWing", "Rear wing", STOCK_AERO_KIT.rearWing, kit.rearWing],
      ["frontSplitter", "Front splitter", STOCK_AERO_KIT.frontSplitter, kit.frontSplitter],
      ["underbody", "Underbody", STOCK_AERO_KIT.underbody, kit.underbody],
    );
  }
  return checks
    .filter(([, , from, to]) => from !== to)
    .map(([field, label, from, to]) => ({ field, label, baseline: from, current: to }));
}

export function buildVehicleState(
  chassis: ChassisConfig,
  engine: EngineConfig,
  gearbox: GearboxConfig,
  realCar: RealCarPreset | null,
): VehicleState {
  const preset = BODY_TYPE_PRESETS[chassis.bodyType];
  const curves = buildEngineCurves(engine);
  const vehicle = deriveVehicle(engine, curves, chassis, gearbox);
  const kit = aeroKitAvailable(chassis.bodyType) ? (chassis.aeroKit ?? null) : null;
  // A ride height change moves the whole body up or down on its wheels.
  const rideOffsetM = (kit?.rideHeightOffsetMm ?? 0) / 1000;

  return {
    identity: {
      presetId: realCar?.id ?? null,
      make: realCar?.make ?? null,
      model: realCar?.model ?? null,
      displayName: realCar
        ? `${realCar.make} ${realCar.model}`
        : `Custom ${BODY_TYPE_NAMES[chassis.bodyType]}`,
      bodyType: chassis.bodyType,
      model3d: realCar?.model3d ?? null,
    },
    dimensions: {
      ...preset.dimensions,
      rideHeightM: preset.dimensions.rideHeightM + rideOffsetM,
      heightM: preset.dimensions.heightM + rideOffsetM,
      wheelbaseM: vehicle.wheelbaseM,
    },
    mass: {
      totalKg: vehicle.weightKg,
      rearWeightFraction: vehicle.rearWeightFraction,
      frontAxleKg: vehicle.weightKg * (1 - vehicle.rearWeightFraction),
      rearAxleKg: vehicle.weightKg * vehicle.rearWeightFraction,
      cgHeightM: vehicle.cgHeightM,
    },
    engine: {
      config: engine,
      sizeLabel: engineSizeLabel(engine),
      peakPowerHp: curves.peakPowerHp,
      peakPowerRpm: curves.peakPowerRpm,
      peakTorqueNm: curves.peakTorqueNm,
      peakTorqueRpm: curves.peakTorqueRpm,
      hybridPowerKw: engine.hybridBoostKw || null,
      // Same definition as SimulationResult.powerToWeightHpPerTonne.
      powerToWeightHpPerTonne: curves.peakPowerHp / (vehicle.weightKg / 1000),
    },
    drivetrain: {
      layout: gearbox.drivetrain,
      transmissionType: gearbox.transmissionType,
      dualClutch: gearbox.dualClutch,
      autoShiftStrategy: gearbox.autoShiftStrategy,
      gearCount: vehicle.gearRatios.length,
      gearRatios: vehicle.gearRatios,
      finalDrive: vehicle.finalDrive,
      finalDriveIsRecommended: gearbox.finalDrive === undefined,
      efficiency: vehicle.drivetrainEfficiency,
      shiftRpm: vehicle.shiftRpm,
    },
    tyres: {
      front: {
        rimDiameterIn: chassis.frontWheelDiameterIn,
        widthMm: chassis.frontWheelWidthMm,
        rollingRadiusM: vehicle.frontWheelRadiusM,
      },
      rear: {
        rimDiameterIn: chassis.rearWheelDiameterIn,
        widthMm: chassis.rearWheelWidthMm,
        rollingRadiusM: tyreRadiusM(chassis.rearWheelDiameterIn, chassis.rearWheelWidthMm, chassis.bodyType),
      },
      type: chassis.tyreType,
      compound: chassis.tyreCompound,
      pressurePsi: chassis.tyrePressurePsi,
      optimalPressurePsi: preset.optimalTyrePressurePsi,
      baseGripMu: vehicle.tireGripMu,
      tractionControl: chassis.tractionControl,
      rollingResistanceCoefficient: vehicle.rollingResistanceCoefficient,
    },
    aero: {
      dragCoefficient: vehicle.dragCoefficient,
      liftCoefficient: vehicle.liftCoefficient,
      frontalAreaM2: vehicle.frontalAreaM2,
      dragAreaM2: vehicle.dragCoefficient * vehicle.frontalAreaM2,
      liftAreaM2: vehicle.liftCoefficient * vehicle.frontalAreaM2,
      activeAero: vehicle.activeAero ?? null,
      baseDragCoefficient: preset.dragCoefficient,
      baseLiftCoefficient: preset.liftCoefficient,
      kit,
      kitContributions: kit ? aeroKitContributions(kit, preset.frontalAreaM2) : [],
    },
    modifications: findModifications(chassis, realCar),
  };
}
