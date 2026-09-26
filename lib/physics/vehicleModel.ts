import { BODY_TYPE_PRESETS } from "./defaults";
import { isRotary } from "./engineLayout";
import { recommendedGearRatios } from "./gearRatios";
import { dragLimitedTopSpeedMs, G } from "./vehicleDynamics";
import {
  BodyType,
  ChassisConfig,
  EngineConfig,
  EngineCurves,
  GearboxConfig,
  VehicleSpec,
  WeightComponent,
} from "./types";

const CYLINDER_MASS_KG = 12;
const DISPLACEMENT_MASS_PER_L_KG = 40;
// A rotor + housing section is lighter than a cylinder's worth of piston,
// rod, head and valvetrain, and there's no crankshaft or cam drive at all -
// a complete 13B weighs ~100-120kg against ~150kg+ for a comparable I4/V6.
const ROTOR_MASS_KG = 10;
const ROTARY_DISPLACEMENT_MASS_PER_L_KG = 25;
const TURBO_HARDWARE_KG = 25;
const SUPERCHARGER_HARDWARE_KG = 35;

// Final drive (differential) ratio bounds. Road cars sit around 3-4, but
// because this simulator's gearbox ratio spread is fixed, the final drive
// also absorbs what a real car would do with its individual gear ratios.
export const MIN_FINAL_DRIVE = 2;
export const MAX_FINAL_DRIVE = 7;

// Reference wheel sizes: the ones the grip figures are calibrated around.
// Width is what actually puts more rubber on the road (a wide performance
// tyre gets mu ~1.2 against a road tyre's ~1.05), so it drives grip.
const REFERENCE_FRONT_DIAMETER_IN = 25;
const REFERENCE_REAR_DIAMETER_IN = 26;
const REFERENCE_FRONT_WIDTH_MM = 235;
const REFERENCE_REAR_WIDTH_MM = 275;
const ROTATING_MASS_PER_INCH_KG = 3.5;
const WIDTH_MASS_PER_MM_KG = 0.15;
const GRIP_PER_MM = 0.003;

// Dry friction coefficient of a standard road tyre at the reference width.
// Slicks, compounds and road conditions scale this (vehicleDynamics.ts).
const ROAD_TYRE_MU = 1.15;

// A little under-inflation or over-inflation is fine; further from the
// recommended pressure (per body type, see defaults.ts) steadily costs
// grip in either direction.
const GRIP_LOSS_PER_PSI = 0.012;

// Drivetrain efficiency: ~10% lost through gearbox and differential, more
// for AWD with its extra transfer case, front differential and propshaft.
const DRIVETRAIN_EFFICIENCY = 0.9;
const AWD_DRIVETRAIN_EFFICIENCY = 0.85;

const ROLLING_RESISTANCE_COEFFICIENT = 0.012;

// Time with no drive force per upshift: a dual-clutch box pre-selects the
// next gear and is close to instantaneous, a torque-converter auto is
// quicker than a person, and a manual needs a clutch and a lever throw.
const DUAL_CLUTCH_SHIFT_TIME_S = 0.05;
const AUTO_SHIFT_TIME_S = 0.15;
const MANUAL_SHIFT_TIME_S = 0.3;

function shiftTimeS(gearbox: GearboxConfig): number {
  if (gearbox.dualClutch) return DUAL_CLUTCH_SHIFT_TIME_S;
  return gearbox.transmissionType === "manual" ? MANUAL_SHIFT_TIME_S : AUTO_SHIFT_TIME_S;
}

// Upper end of the torque band: the highest rpm still making ~all of peak
// torque. On a turbo plateau that's where the plateau starts to fade, not
// where it begins (which is what peakTorqueRpm reports).
function torqueBandTopRpm(curves: EngineCurves): number {
  for (let rpm = curves.maxRevRpm; rpm > curves.idleRpm; rpm -= 25) {
    if (curves.torqueAt(rpm) >= curves.peakTorqueNm * 0.98) return rpm;
  }
  return curves.peakTorqueRpm;
}

// Shift right before the hard limiter rather than the tuned redline, so a
// higher max-rev setting genuinely extends each gear's pull. Manual boxes
// (and the default "max RPM" auto strategy) always shift here, on the
// assumption of a driver who takes every gear to the limiter; the other
// auto strategies instead short-shift at the top of the torque band or at
// the power peak.
function computeShiftRpm(curves: EngineCurves, gearbox: GearboxConfig): number {
  if (gearbox.transmissionType === "auto") {
    switch (gearbox.autoShiftStrategy) {
      case "maxTorque":
        return torqueBandTopRpm(curves);
      case "maxPower":
        return curves.peakPowerRpm;
      case "maxRpm":
        break;
    }
  }
  return curves.maxRevRpm * 0.97;
}

// F1 tyres are specified by outer diameter rather than aspect ratio: 670mm
// on the old 13" rims, 720mm on the 18" rims used since 2022.
function f1TyreOuterDiameterMm(rimIn: number): number {
  return Math.min(720, Math.max(670, 670 + (rimIn - 13) * 10));
}

// Rolling radius = rim radius + tyre sidewall. The sidewall matters a lot:
// a 21" rim alone is 267mm, but with a 355/25 tyre on it the wheel rolls
// on ~356mm - a third more road per revolution.
export function tyreRadiusM(rimIn: number, widthMm: number, bodyType: BodyType): number {
  if (bodyType === "f1") return f1TyreOuterDiameterMm(rimIn) / 2000;
  const rimRadiusM = (rimIn * 0.0254) / 2;
  return rimRadiusM + (widthMm * BODY_TYPE_PRESETS[bodyType].tyreAspectRatio) / 1000;
}

// Rough share of the total weight taken by each major system - the body/
// structure is whatever remains. An F1 car is weighed without fuel and has
// almost no interior; road cars carry trim, glass, seats, HVAC and a
// part-full tank.
const WEIGHT_SHARES: Record<
  BodyType,
  { suspensionBrakes: number; interiorElectrics: number; fuelFluids: number }
> = {
  minivan: { suspensionBrakes: 0.08, interiorElectrics: 0.16, fuelFluids: 0.045 },
  suv: { suspensionBrakes: 0.09, interiorElectrics: 0.13, fuelFluids: 0.05 },
  supercar: { suspensionBrakes: 0.09, interiorElectrics: 0.09, fuelFluids: 0.045 },
  f1: { suspensionBrakes: 0.09, interiorElectrics: 0.05, fuelFluids: 0.02 },
};
// Gearbox, differential(s) and driveshafts. AWD adds a transfer case, a
// front diff and a second propshaft.
const DRIVETRAIN_SHARE = 0.055;
const AWD_DRIVETRAIN_SHARE = 0.075;

const REFERENCE_WHEEL_SET_KG = 160;
const MIN_WHEEL_SET_KG = 20;
// The body/structure never drops below this share of the total - if a
// huge engine goes in a light car, the other estimates shrink to make room.
const MIN_BODY_SHARE = 0.1;

export interface WeightBreakdown {
  totalKg: number;
  components: WeightComponent[];
}

// The Weight setting is the car's total weight - nothing is added on top.
// This only splits that total into an estimate of where it sits: the
// engine, forced induction and wheels are sized from their own settings,
// the other systems take a typical share for the body type, and the body
// and chassis structure is whatever remains.
export function computeWeightBreakdown(
  engine: EngineConfig,
  chassis: ChassisConfig,
  gearbox: GearboxConfig,
): WeightBreakdown {
  const totalKg = chassis.weightKg;
  const rotary = isRotary(engine);
  const engineKg =
    engine.cylinders * (rotary ? ROTOR_MASS_KG : CYLINDER_MASS_KG) +
    engine.displacementL *
      (rotary ? ROTARY_DISPLACEMENT_MASS_PER_L_KG : DISPLACEMENT_MASS_PER_L_KG);

  const forcedInductionKg =
    engine.aspiration === "turbo"
      ? TURBO_HARDWARE_KG
      : engine.aspiration === "supercharged"
        ? SUPERCHARGER_HARDWARE_KG
        : 0;

  const wheelsKg = Math.max(
    MIN_WHEEL_SET_KG,
    REFERENCE_WHEEL_SET_KG +
      (chassis.frontWheelDiameterIn - REFERENCE_FRONT_DIAMETER_IN) * ROTATING_MASS_PER_INCH_KG +
      (chassis.rearWheelDiameterIn - REFERENCE_REAR_DIAMETER_IN) * ROTATING_MASS_PER_INCH_KG +
      (chassis.frontWheelWidthMm - REFERENCE_FRONT_WIDTH_MM) * WIDTH_MASS_PER_MM_KG +
      (chassis.rearWheelWidthMm - REFERENCE_REAR_WIDTH_MM) * WIDTH_MASS_PER_MM_KG,
  );

  const shares = WEIGHT_SHARES[chassis.bodyType];
  const drivetrainShare = gearbox.drivetrain === "awd" ? AWD_DRIVETRAIN_SHARE : DRIVETRAIN_SHARE;
  const sharedKg =
    totalKg *
    (drivetrainShare + shares.suspensionBrakes + shares.interiorElectrics + shares.fuelFluids);
  const fixedKg = engineKg + forcedInductionKg + wheelsKg;
  const roomForShared = Math.max(0, totalKg * (1 - MIN_BODY_SHARE) - fixedKg);
  const scale = sharedKg > 0 ? Math.min(1, roomForShared / sharedKg) : 1;

  const drivetrainKg = totalKg * drivetrainShare * scale;
  const suspensionBrakesKg = totalKg * shares.suspensionBrakes * scale;
  const interiorElectricsKg = totalKg * shares.interiorElectrics * scale;
  const fuelFluidsKg = totalKg * shares.fuelFluids * scale;
  const bodyKg =
    totalKg - fixedKg - drivetrainKg - suspensionBrakesKg - interiorElectricsKg - fuelFluidsKg;

  const components: WeightComponent[] = [
    {
      label: chassis.bodyType === "f1" ? "Monocoque & bodywork" : "Body & chassis structure",
      kg: bodyKg,
    },
    { label: rotary ? "Engine (rotary)" : "Engine", kg: engineKg },
  ];
  if (forcedInductionKg > 0) {
    components.push({
      label: engine.aspiration === "turbo" ? "Turbocharger & plumbing" : "Supercharger & drive",
      kg: forcedInductionKg,
    });
  }
  components.push(
    { label: "Gearbox & drivetrain", kg: drivetrainKg },
    { label: "Wheels & tyres", kg: wheelsKg },
    { label: "Suspension & brakes", kg: suspensionBrakesKg },
    {
      label: chassis.bodyType === "f1" ? "Cockpit & electronics" : "Interior & electrics",
      kg: interiorElectricsKg,
    },
    { label: "Fuel & fluids", kg: fuelFluidsKg },
  );

  return { totalKg, components };
}

// The final drive a manufacturer would pick for this car: tall enough that
// in top gear the engine reaches its power peak exactly at the drag-limited
// top speed - any shorter and the car hits the limiter below it, any taller
// and it never gets up onto its power peak.
export function recommendedFinalDrive(
  curves: EngineCurves,
  topGearRatio: number,
  wheelRadiusM: number,
  weightKg: number,
  dragAreaM2: number,
  drivetrainEfficiency: number,
): number {
  const peakWheelPowerW = curves.peakPowerHp * 745.7 * drivetrainEfficiency;
  const rollingForceN = ROLLING_RESISTANCE_COEFFICIENT * weightKg * G;
  const topSpeedMs = dragLimitedTopSpeedMs(peakWheelPowerW, dragAreaM2, rollingForceN);
  if (topSpeedMs <= 0) return MAX_FINAL_DRIVE;
  const finalDrive =
    (curves.peakPowerRpm * 2 * Math.PI * wheelRadiusM) / (60 * topSpeedMs * topGearRatio);
  return Math.min(MAX_FINAL_DRIVE, Math.max(MIN_FINAL_DRIVE, finalDrive));
}

export function deriveVehicle(
  engine: EngineConfig,
  curves: EngineCurves,
  chassis: ChassisConfig,
  gearbox: GearboxConfig,
): VehicleSpec {
  const preset = BODY_TYPE_PRESETS[chassis.bodyType];
  const weightKg = chassis.weightKg;

  // Custom ratios are trusted as long as they match the chosen gear count;
  // otherwise (e.g. gear count just changed) fall back to the recommended
  // spread rather than indexing into a mismatched array.
  const gearRatios =
    gearbox.gearRatios.length === gearbox.gearCount
      ? gearbox.gearRatios
      : recommendedGearRatios(gearbox.gearCount);

  // Whichever axle is driven is the one that puts power down, so its tyre
  // width (grip) and rolling radius (gearing) are what matter - not always
  // the rear. AWD drives both axles, so it splits the difference.
  const isRwd = gearbox.drivetrain === "rwd";
  const isAwd = gearbox.drivetrain === "awd";
  const frontRadiusM = tyreRadiusM(chassis.frontWheelDiameterIn, chassis.frontWheelWidthMm, chassis.bodyType);
  const rearRadiusM = tyreRadiusM(chassis.rearWheelDiameterIn, chassis.rearWheelWidthMm, chassis.bodyType);
  const wheelRadiusM = isAwd ? (frontRadiusM + rearRadiusM) / 2 : isRwd ? rearRadiusM : frontRadiusM;

  const driveWidthMm = isAwd
    ? (chassis.frontWheelWidthMm + chassis.rearWheelWidthMm) / 2
    : isRwd
      ? chassis.rearWheelWidthMm
      : chassis.frontWheelWidthMm;
  const driveReferenceWidthMm = isAwd
    ? (REFERENCE_FRONT_WIDTH_MM + REFERENCE_REAR_WIDTH_MM) / 2
    : isRwd
      ? REFERENCE_REAR_WIDTH_MM
      : REFERENCE_FRONT_WIDTH_MM;

  const widthGripMultiplier = Math.min(
    1.25,
    Math.max(0.8, 1 + (driveWidthMm - driveReferenceWidthMm) * GRIP_PER_MM),
  );
  const pressureGripMultiplier = Math.max(
    0.7,
    1 - Math.abs(chassis.tyrePressurePsi - preset.optimalTyrePressurePsi) * GRIP_LOSS_PER_PSI,
  );

  const drivetrainEfficiency = isAwd ? AWD_DRIVETRAIN_EFFICIENCY : DRIVETRAIN_EFFICIENCY;
  const finalDrive =
    gearbox.finalDrive ??
    recommendedFinalDrive(
      curves,
      gearRatios[gearRatios.length - 1],
      wheelRadiusM,
      weightKg,
      preset.dragCoefficient * preset.frontalAreaM2,
      drivetrainEfficiency,
    );

  return {
    weightKg,
    drivetrain: gearbox.drivetrain,
    wheelbaseM: preset.wheelbaseM,
    rearWeightFraction: preset.rearWeightFraction,
    cgHeightM: preset.cgHeightM,
    dragCoefficient: preset.dragCoefficient,
    frontalAreaM2: preset.frontalAreaM2,
    liftCoefficient: preset.liftCoefficient,
    rollingResistanceCoefficient: ROLLING_RESISTANCE_COEFFICIENT,
    drivetrainEfficiency,
    tireGripMu: ROAD_TYRE_MU * widthGripMultiplier * pressureGripMultiplier,
    wheelRadiusM,
    frontWheelRadiusM: frontRadiusM,
    gearRatios,
    finalDrive,
    shiftRpm: computeShiftRpm(curves, gearbox),
    shiftTimeS: shiftTimeS(gearbox),
  };
}
