// Checks the aero force model (lib/aero/forces.ts): hand-calculated values,
// the V^2 / V^3 scaling laws, and exact agreement with what the simulation
// itself uses (lib/physics/aeroModel.ts) for every preset and aero mode.
// Prints the headline figures per body type. Exits non-zero on failure.
// Run with: npx tsx scripts/aero-check.ts
import {
  aeroCoefficients,
  aeroForcesAt,
  AIR_DENSITY,
  downforceToWeight,
  speedForDownforceEqualWeightKph,
} from "../lib/aero/forces";
import { aeroModeVehicle, downforceN, dragForceN } from "../lib/physics/aeroModel";
import { BODY_TYPE_PRESETS, DEFAULT_CHASSIS, DEFAULT_ENGINE, DEFAULT_GEARBOX, defaultTyresFor } from "../lib/physics/defaults";
import { buildEngineCurves } from "../lib/physics/engineModel";
import { gearboxFromPreset, REAL_CAR_PRESETS } from "../lib/physics/realCars";
import { AeroMode, BodyType, ChassisConfig } from "../lib/physics/types";
import { deriveVehicle } from "../lib/physics/vehicleModel";
import { buildVehicleState } from "../lib/physics/vehicleState";

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  if (!ok) {
    failures++;
    console.log(`  FAIL ${name}: ${detail}`);
  }
}
const close = (a: number, b: number, rel = 1e-9) => Math.abs(a - b) <= rel * Math.max(1, Math.abs(a), Math.abs(b));

// 1. Hand calculation: Cd 0.30, Cl 0.50, A 2.0 m^2 at 100 km/h, rho 1.225.
//    V = 27.7778 m/s, q = 0.6125 * 771.605 = 472.608 Pa,
//    D = q * 0.6 = 283.565 N, L = q * 1.0 = 472.608 N, P = D V = 7.8768 kW.
console.log("Hand calculation (Cd 0.30, Cl 0.50, A 2.0 m^2, 100 km/h)");
const hand = aeroForcesAt({ dragCoefficient: 0.3, liftCoefficient: 0.5, frontalAreaM2: 2 }, 100);
check("rho", AIR_DENSITY === 1.225, `${AIR_DENSITY}`);
check("q", close(hand.dynamicPressurePa, 472.608, 1e-5), `${hand.dynamicPressurePa.toFixed(3)} Pa`);
check("drag", close(hand.dragN, 283.565, 1e-5), `${hand.dragN.toFixed(3)} N`);
check("downforce", close(hand.downforceN, 472.608, 1e-5), `${hand.downforceN.toFixed(3)} N`);
check("drag power", close(hand.dragPowerKw, 7.8768, 1e-4), `${hand.dragPowerKw.toFixed(4)} kW`);
const doubled = aeroForcesAt({ dragCoefficient: 0.3, liftCoefficient: 0.5, frontalAreaM2: 2 }, 200);
check("force ~ V^2", close(doubled.dragN / hand.dragN, 4), `${(doubled.dragN / hand.dragN).toFixed(6)}x`);
check("power ~ V^3", close(doubled.dragPowerKw / hand.dragPowerKw, 8), `${(doubled.dragPowerKw / hand.dragPowerKw).toFixed(6)}x`);
const still = aeroForcesAt({ dragCoefficient: 0.3, liftCoefficient: 0.5, frontalAreaM2: 2 }, 0);
check("zero speed", still.dragN === 0 && still.downforceN === 0, "forces at rest");
console.log(`  q ${hand.dynamicPressurePa.toFixed(1)} Pa, drag ${hand.dragN.toFixed(1)} N, downforce ${hand.downforceN.toFixed(1)} N, ${hand.dragPowerKw.toFixed(2)} kW`);

// 2. Agreement with the simulation for every preset (and both aero modes
//    where the preset has active aero), across a range of speeds.
console.log("\nAgreement with the simulation's aero model (every preset)");
let compared = 0;
for (const car of Object.values(REAL_CAR_PRESETS).flat()) {
  const chassis: ChassisConfig = { ...DEFAULT_CHASSIS, bodyType: car.category, ...car.chassis, ...defaultTyresFor(car.category) };
  const gearbox = gearboxFromPreset(car);
  const state = buildVehicleState(chassis, car.engine, gearbox, car);
  const spec = deriveVehicle(car.engine, buildEngineCurves(car.engine), chassis, gearbox);
  const modes: AeroMode[] = car.chassis.activeAero ? ["corner", "straight"] : ["corner"];
  for (const mode of modes) {
    const simVehicle = aeroModeVehicle(spec, mode);
    const coefficients = aeroCoefficients(state, mode);
    for (const kph of [50, 150, 250, 350]) {
      const ours = aeroForcesAt(coefficients, kph);
      const sim = { drag: dragForceN(kph / 3.6, simVehicle), down: downforceN(kph / 3.6, simVehicle) };
      check(`${car.id} ${mode} ${kph} drag`, close(ours.dragN, sim.drag), `${ours.dragN} vs ${sim.drag}`);
      check(`${car.id} ${mode} ${kph} downforce`, close(ours.downforceN, sim.down), `${ours.downforceN} vs ${sim.down}`);
      compared++;
    }
  }
}
console.log(`  ${compared} preset/mode/speed combinations compared`);

// 3. Headline figures per body type (custom build at its default weight).
console.log("\nPer body type (representative coefficients, still air, rho 1.225)");
console.log("  body      Cd    Cl     A     @200 km/h: drag   down/lift  /weight  drag power   downforce = weight at");
for (const bodyType of Object.keys(BODY_TYPE_PRESETS) as BodyType[]) {
  const preset = BODY_TYPE_PRESETS[bodyType];
  const state = buildVehicleState(
    { ...DEFAULT_CHASSIS, bodyType, weightKg: preset.weightKg, ...defaultTyresFor(bodyType) },
    DEFAULT_ENGINE,
    DEFAULT_GEARBOX,
    null,
  );
  const c = aeroCoefficients(state);
  const f = aeroForcesAt(c, 200);
  const ratio = downforceToWeight(f, state.mass.totalKg);
  const vEqual = speedForDownforceEqualWeightKph(c, state.mass.totalKg);
  if (vEqual) {
    const atEqual = aeroForcesAt(c, vEqual);
    check(`${bodyType} downforce = weight speed`, close(downforceToWeight(atEqual, state.mass.totalKg), 1, 1e-9), `${vEqual}`);
  }
  console.log(
    `  ${bodyType.padEnd(9)} ${c.dragCoefficient.toFixed(2)}  ${c.liftCoefficient.toFixed(2).padStart(5)}  ${c.frontalAreaM2.toFixed(2)}   ${(f.dragN / 1000).toFixed(2).padStart(6)} kN  ${(f.downforceN / 1000).toFixed(2).padStart(6)} kN  ${(ratio * 100).toFixed(0).padStart(5)}%  ${f.dragPowerKw.toFixed(0).padStart(6)} kW   ${vEqual ? `${vEqual.toFixed(0)} km/h` : "never (makes lift)"}`,
  );
}

console.log(failures ? `\n${failures} check(s) failed` : "\nAll aero checks passed");
process.exit(failures ? 1 : 0);
