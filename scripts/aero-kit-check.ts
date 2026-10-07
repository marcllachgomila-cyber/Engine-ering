// Checks the bolt-on aero kit (lib/physics/aeroKit.ts) end to end: that no
// kit changes nothing, that each part moves drag/downforce the right way,
// that the aero readout and the simulation agree with a kit fitted, and
// what the kit does to a straight-line run and a hot lap.
// Exits non-zero on any failed check.
// Run with: npx tsx scripts/aero-kit-check.ts
import { aeroCoefficients, aeroForcesAt } from "../lib/aero/forces";
import { applyAeroKit, STOCK_AERO_KIT } from "../lib/physics/aeroKit";
import { dragForceN, downforceN } from "../lib/physics/aeroModel";
import { BODY_TYPE_PRESETS, DEFAULT_CHASSIS, DEFAULT_ENGINE, DEFAULT_GEARBOX, DEFAULT_TEST_CONFIG, defaultTyresFor } from "../lib/physics/defaults";
import { buildEngineCurves } from "../lib/physics/engineModel";
import { simulate } from "../lib/physics/simulate";
import { AeroKitConfig, BodyType, ChassisConfig, EngineConfig } from "../lib/physics/types";
import { deriveVehicle } from "../lib/physics/vehicleModel";
import { buildVehicleState } from "../lib/physics/vehicleState";

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}: ${detail}`);
  if (!ok) failures++;
}

const chassisFor = (bodyType: BodyType, aeroKit?: AeroKitConfig): ChassisConfig => ({
  ...DEFAULT_CHASSIS,
  bodyType,
  weightKg: BODY_TYPE_PRESETS[bodyType].weightKg,
  ...defaultTyresFor(bodyType),
  aeroKit,
});
const curves = buildEngineCurves(DEFAULT_ENGINE);
const spec = (chassis: ChassisConfig, engine: EngineConfig = DEFAULT_ENGINE) =>
  deriveVehicle(engine, engine === DEFAULT_ENGINE ? curves : buildEngineCurves(engine), chassis, DEFAULT_GEARBOX);

// 1. No kit, or the stock kit, changes nothing; F1 ignores any kit.
console.log("Neutral cases");
for (const bodyType of Object.keys(BODY_TYPE_PRESETS) as BodyType[]) {
  const none = spec(chassisFor(bodyType));
  const stock = spec(chassisFor(bodyType, STOCK_AERO_KIT));
  const same = (["dragCoefficient", "liftCoefficient", "frontalAreaM2", "cgHeightM", "finalDrive"] as const).every(
    (k) => none[k] === stock[k],
  );
  check(`${bodyType} stock kit = no kit`, same, `Cd ${stock.dragCoefficient} Cl ${stock.liftCoefficient}`);
}
const f1Kit = spec(chassisFor("f1", { rideHeightOffsetMm: -40, rearWing: "high", frontSplitter: true, underbody: "diffuser" }));
const f1 = spec(chassisFor("f1"));
check("f1 ignores the kit", f1Kit.dragCoefficient === f1.dragCoefficient && f1Kit.liftCoefficient === f1.liftCoefficient, "");

// 2. Each part moves the numbers the way it should.
console.log("\nEach part, on a supercar (base Cd 0.39, Cl 0.90)");
const base = BODY_TYPE_PRESETS.supercar;
const withKit = (patch: Partial<AeroKitConfig>) => applyAeroKit(base, { ...STOCK_AERO_KIT, ...patch });
const low = withKit({ rearWing: "low" });
const high = withKit({ rearWing: "high" });
const ld = (k: ReturnType<typeof withKit>) => (k.liftCoefficient - base.liftCoefficient) / (k.dragCoefficient - base.dragCoefficient);
check("wing adds drag and downforce", low.dragCoefficient > base.dragCoefficient && low.liftCoefficient > base.liftCoefficient, `low Cd ${low.dragCoefficient.toFixed(2)} Cl ${low.liftCoefficient.toFixed(2)}`);
check("high wing > low wing", high.dragCoefficient > low.dragCoefficient && high.liftCoefficient > low.liftCoefficient, `high Cd ${high.dragCoefficient.toFixed(2)} Cl ${high.liftCoefficient.toFixed(2)}`);
check("high wing less efficient", ld(high) < ld(low), `L/D low ${ld(low).toFixed(1)}, high ${ld(high).toFixed(1)}`);
const splitter = withKit({ frontSplitter: true });
check("splitter: downforce, little drag", splitter.liftCoefficient > base.liftCoefficient && splitter.dragCoefficient - base.dragCoefficient <= 0.015, `dCd ${(splitter.dragCoefficient - base.dragCoefficient).toFixed(3)}`);
const diffuser = withKit({ underbody: "diffuser" });
check("diffuser: less drag, more downforce", diffuser.dragCoefficient < base.dragCoefficient && diffuser.liftCoefficient > base.liftCoefficient, `Cd ${diffuser.dragCoefficient.toFixed(2)} Cl ${diffuser.liftCoefficient.toFixed(2)}`);
const diffLow = withKit({ underbody: "diffuser", rideHeightOffsetMm: -30 });
const diffHigh = withKit({ underbody: "diffuser", rideHeightOffsetMm: 30 });
check("diffuser gains when lowered", diffLow.liftCoefficient > diffuser.liftCoefficient && diffuser.liftCoefficient > diffHigh.liftCoefficient, `Cl -30mm ${diffLow.liftCoefficient.toFixed(3)}, 0 ${diffuser.liftCoefficient.toFixed(3)}, +30mm ${diffHigh.liftCoefficient.toFixed(3)}`);
const lowered = withKit({ rideHeightOffsetMm: -20 });
check("lowering: less drag, more downforce", lowered.dragCoefficient < base.dragCoefficient && lowered.liftCoefficient > base.liftCoefficient, `Cd ${lowered.dragCoefficient.toFixed(3)} Cl ${lowered.liftCoefficient.toFixed(3)}`);
check("lowering moves the CG", Math.abs(lowered.cgHeightM - (base.cgHeightM - 0.02)) < 1e-12, `${base.cgHeightM} -> ${lowered.cgHeightM.toFixed(3)} m`);
const state = buildVehicleState(chassisFor("supercar", { ...STOCK_AERO_KIT, rideHeightOffsetMm: -20 }), DEFAULT_ENGINE, DEFAULT_GEARBOX, null);
check("body drops on its wheels", Math.abs(state.dimensions.rideHeightM - (base.dimensions.rideHeightM - 0.02)) < 1e-12, `ride ${state.dimensions.rideHeightM.toFixed(3)} m`);

// 3. Readout and simulation agree with a kit fitted.
console.log("\nReadout vs simulation, full kit");
const fullKit: AeroKitConfig = { rideHeightOffsetMm: -30, rearWing: "high", frontSplitter: true, underbody: "diffuser" };
for (const bodyType of ["minivan", "suv", "supercar"] as BodyType[]) {
  const chassis = chassisFor(bodyType, fullKit);
  const v = buildVehicleState(chassis, DEFAULT_ENGINE, DEFAULT_GEARBOX, null);
  const sim = spec(chassis);
  const f = aeroForcesAt(aeroCoefficients(v), 200);
  const close = (a: number, b: number) => Math.abs(a - b) < 1e-9 * Math.max(1, Math.abs(b));
  check(`${bodyType} drag/downforce agree`, close(f.dragN, dragForceN(200 / 3.6, sim)) && close(f.downforceN, downforceN(200 / 3.6, sim)), `Cd ${v.aero.dragCoefficient.toFixed(3)} Cl ${v.aero.liftCoefficient.toFixed(3)}`);
  const sum = v.aero.baseDragCoefficient + v.aero.kitContributions.reduce((s, c) => s + c.dCd, 0);
  check(`${bodyType} breakdown sums to total`, close(sum, v.aero.dragCoefficient), `${sum.toFixed(3)}`);
}

// 4. What it does in the simulation: a 500 hp supercar, stock vs kits.
//    Expected trade-off: more downforce = lower top speed, faster through
//    corners (so a quicker lap on a twisty circuit).
console.log("\nSimulation effect (supercar, 4.0 V8 twin-turbo, Monaco hot lap)");
const engine: EngineConfig = { cylinders: 8, layout: "v", displacementL: 4, redlineRpm: 8000, maxRevRpm: 8300, aspiration: "turbo", fuelType: "petrol" };
const kits: [string, AeroKitConfig | undefined][] = [
  ["stock", undefined],
  ["low wing", { ...STOCK_AERO_KIT, rearWing: "low" }],
  ["high wing", { ...STOCK_AERO_KIT, rearWing: "high" }],
  ["full kit", fullKit],
];
const results = kits.map(([name, kit]) => {
  const chassis = chassisFor("supercar", kit);
  const run = simulate(engine, chassis, DEFAULT_GEARBOX, { ...DEFAULT_TEST_CONFIG, testType: "zeroToHundred" });
  const lap = simulate(engine, chassis, DEFAULT_GEARBOX, { ...DEFAULT_TEST_CONFIG, testType: "hotLap", circuitId: "monaco" });
  console.log(`  ${name.padEnd(10)} top speed ${run.theoreticalTopSpeedKph.toFixed(0)} km/h   Monaco ${lap.elapsedS.toFixed(2)} s`);
  return { name, top: run.theoreticalTopSpeedKph, lap: lap.elapsedS };
});
check("downforce costs top speed", results[2].top < results[1].top && results[1].top < results[0].top, results.map((r) => r.top.toFixed(0)).join(" > "));
check("downforce helps a twisty lap", results[3].lap < results[0].lap, `${results[0].lap.toFixed(2)} s -> ${results[3].lap.toFixed(2)} s`);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll aero kit checks passed");
process.exit(failures ? 1 : 0);
