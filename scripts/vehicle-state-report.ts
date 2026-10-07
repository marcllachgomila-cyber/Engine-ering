// Builds the central VehicleState (lib/physics/vehicleState.ts) for every
// real-car preset and every custom body type, prints the headline figures
// and checks it agrees with the simulation and is physically plausible.
// Exits non-zero on any failed check.
// Run with: npx tsx scripts/vehicle-state-report.ts
import { gearboxFromPreset, REAL_CAR_PRESETS } from "../lib/physics/realCars";
import {
  BODY_TYPE_PRESETS,
  DEFAULT_CHASSIS,
  DEFAULT_ENGINE,
  DEFAULT_GEARBOX,
  DEFAULT_TEST_CONFIG,
  defaultTyresFor,
} from "../lib/physics/defaults";
import { simulate } from "../lib/physics/simulate";
import { buildVehicleState, VehicleState } from "../lib/physics/vehicleState";
import { BodyType, ChassisConfig, EngineConfig, GearboxConfig, RealCarPreset } from "../lib/physics/types";

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  if (!ok) {
    failures++;
    console.log(`  FAIL ${name}: ${detail}`);
  }
}

function hasNaN(value: unknown): boolean {
  if (typeof value === "number") return !Number.isFinite(value);
  if (value && typeof value === "object") return Object.values(value).some(hasNaN);
  return false;
}

function verify(label: string, state: VehicleState, engine: EngineConfig, chassis: ChassisConfig, gearbox: GearboxConfig) {
  const d = state.dimensions;
  const a = state.aero;
  console.log(
    [
      label.padEnd(26),
      `${d.lengthM.toFixed(2)}x${d.widthM.toFixed(2)}x${d.heightM.toFixed(2)}m`,
      `wb ${d.wheelbaseM.toFixed(2)}`,
      `${state.mass.totalKg}kg`,
      `${state.engine.peakPowerHp.toFixed(0)}hp`,
      `${state.engine.peakTorqueNm.toFixed(0)}Nm`,
      `${state.drivetrain.layout}/${state.drivetrain.gearCount}sp FD ${state.drivetrain.finalDrive.toFixed(2)}`,
      `Cd ${a.dragCoefficient} Cl ${a.liftCoefficient} A ${a.frontalAreaM2} (fill ${(a.frontalAreaM2 / (d.widthM * d.heightM)).toFixed(2)})`,
      state.modifications.length ? `mods: ${state.modifications.map((m) => m.field).join(",")}` : "",
    ].join("  "),
  );

  // Agrees with what the simulation itself reports.
  const sim = simulate(engine, chassis, gearbox, { ...DEFAULT_TEST_CONFIG, testType: "zeroToHundred" });
  check("peak power", Math.abs(sim.peakHp - state.engine.peakPowerHp) < 1e-9, `${sim.peakHp} vs ${state.engine.peakPowerHp}`);
  check("peak torque", Math.abs(sim.peakTorqueNm - state.engine.peakTorqueNm) < 1e-9, `${sim.peakTorqueNm} vs ${state.engine.peakTorqueNm}`);
  check("weight", sim.weightKg === state.mass.totalKg, `${sim.weightKg} vs ${state.mass.totalKg}`);
  check(
    "power/weight",
    Math.abs(sim.powerToWeightHpPerTonne - state.engine.powerToWeightHpPerTonne) < 1e-9,
    `${sim.powerToWeightHpPerTonne} vs ${state.engine.powerToWeightHpPerTonne}`,
  );

  // Internally consistent and physically plausible.
  check("finite", !hasNaN(state), "contains NaN/Infinity");
  check("axle split", Math.abs(state.mass.frontAxleKg + state.mass.rearAxleKg - state.mass.totalKg) < 1e-9, "axle loads don't sum to total");
  check("wheelbase < length", d.wheelbaseM < d.lengthM, `${d.wheelbaseM} >= ${d.lengthM}`);
  check("tracks < width", d.frontTrackM < d.widthM && d.rearTrackM < d.widthM, "track wider than body");
  check("ride height < height", d.rideHeightM < d.heightM, "ride height above roof");
  check("frontal area <= w*h", a.frontalAreaM2 <= d.widthM * d.heightM, "frontal area exceeds bounding box");
  check("CdA", Math.abs(a.dragAreaM2 - a.dragCoefficient * a.frontalAreaM2) < 1e-12, "CdA != Cd*A");
  check("gear count", state.drivetrain.gearRatios.length === state.drivetrain.gearCount, "ratio list length mismatch");
  const wheelTopM = state.tyres.front.rollingRadiusM * 2;
  check("wheels fit body", wheelTopM < d.heightM + 0.01 || state.identity.bodyType === "f1", `wheel ${wheelTopM.toFixed(2)}m vs body ${d.heightM}m`);
}

const presets: RealCarPreset[] = Object.values(REAL_CAR_PRESETS).flat();
for (const car of presets) {
  const chassis: ChassisConfig = {
    ...DEFAULT_CHASSIS,
    bodyType: car.category,
    ...car.chassis,
    ...defaultTyresFor(car.category),
  };
  const gearbox = gearboxFromPreset(car);
  const state = buildVehicleState(chassis, car.engine, gearbox, car);
  check(`${car.id} identity`, state.identity.presetId === car.id, "preset id lost");
  check(`${car.id} unmodified`, state.modifications.length === 0, "fresh preset reports modifications");
  verify(car.id, state, car.engine, chassis, gearbox);
}

for (const bodyType of Object.keys(BODY_TYPE_PRESETS) as BodyType[]) {
  const chassis: ChassisConfig = {
    ...DEFAULT_CHASSIS,
    bodyType,
    weightKg: BODY_TYPE_PRESETS[bodyType].weightKg,
    ...defaultTyresFor(bodyType),
  };
  const state = buildVehicleState(chassis, DEFAULT_ENGINE, DEFAULT_GEARBOX, null);
  check(`custom ${bodyType} identity`, state.identity.presetId === null, "custom build has a preset id");
  verify(`custom ${bodyType}`, state, DEFAULT_ENGINE, chassis, DEFAULT_GEARBOX);
}

// Modifications are picked up.
const modified: ChassisConfig = { ...DEFAULT_CHASSIS, weightKg: 1600, tyreCompound: "soft", tractionControl: false };
const modState = buildVehicleState(modified, DEFAULT_ENGINE, DEFAULT_GEARBOX, null);
const modFields = modState.modifications.map((m) => m.field).sort().join(",");
check("modifications", modFields === "tractionControl,tyreCompound,weightKg", modFields);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll vehicle state checks passed");
process.exit(failures ? 1 : 0);
