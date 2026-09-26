// F1 2026 hot lap at Albert Park - lap time, speeds at the timing points,
// active-aero and battery usage, slowest corners - plus the straight-line
// tests on every road-car preset, to confirm they don't move.
// Run with: npx tsx scripts/lap-report.ts
import { findRealCarPreset, gearboxFromPreset, REAL_CAR_PRESETS } from "../lib/physics/realCars";
import { simulate } from "../lib/physics/simulate";
import { solveHotLap } from "../lib/physics/lapSimulate";
import { debugCircuitCorners } from "../lib/physics/circuitDebug";
import { getCircuit } from "../lib/physics/circuits";
import { DEFAULT_CHASSIS, DEFAULT_TEST_CONFIG, defaultTyresFor } from "../lib/physics/defaults";
import { ChassisConfig, RealCarPreset, TestConfig } from "../lib/physics/types";

// Albert Park's speed trap sits on the pit straight 520 m before Turn 1
// (Turn 1 starts ~186 m into the lap trace, see circuit-corners.ts).
const SPEED_TRAP_BEFORE_LINE_M = 520 - 186;

function chassisFor(car: RealCarPreset): ChassisConfig {
  return { ...DEFAULT_CHASSIS, ...car.chassis, bodyType: car.category, ...defaultTyresFor(car.category) };
}

const f1 = findRealCarPreset("f1-2026")!;
const circuit = getCircuit("albert-park");
const lapTest: TestConfig = { ...DEFAULT_TEST_CONFIG, testType: "hotLap", circuitId: circuit.id };
const lap = simulate(f1.engine, chassisFor(f1), gearboxFromPreset(f1), lapTest);
const tel = lap.telemetry;
const n = tel.length;
const lapTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, "0")}`;
const at = (d: number) => tel.reduce((a, b) => (Math.abs(b.distanceM - d) < Math.abs(a.distanceM - d) ? b : a));
const lapLengthM = circuit.racingLineLengthM;
const mainStraight = Math.max(...tel.filter((p) => p.distanceM > lapLengthM - 600 || p.distanceM < 186).map((p) => p.speedKph));

console.log(`F1 2026 @ Albert Park: ${lapTime(lap.elapsedS)}`);
console.log(
  `  top ${Math.max(...tel.map((p) => p.speedKph)).toFixed(1)} kph, main straight max ${mainStraight.toFixed(1)} kph, ` +
    `speed trap ${at(lapLengthM - SPEED_TRAP_BEFORE_LINE_M).speedKph.toFixed(1)} kph, finish line ${tel[0].speedKph.toFixed(1)} kph`,
);

let straightTime = 0;
for (let i = 0; i < n; i++) if (tel[i].aeroMode === "straight") straightTime += tel[i].t - (i > 0 ? tel[i - 1].t : 0);
console.log(`  straight-mode aero: ${((100 * straightTime) / lap.elapsedS).toFixed(1)}% of lap time`);

const solution = solveHotLap(f1.engine, chassisFor(f1), gearboxFromPreset(f1), lapTest, circuit);
const battery = solution.battery;
if (battery) {
  console.log(
    `  battery: deployed ${(battery.deployedJ / 1e6).toFixed(3)} MJ, harvested ${(battery.harvestedJ / 1e6).toFixed(3)} MJ, ` +
      `net ${((battery.harvestedJ - battery.deployedJ) / 1e6).toFixed(4)} MJ, lap starts/ends at ` +
      `${(battery.startSocJ / 1e6).toFixed(3)} / ${(battery.socJ[n - 1] / 1e6).toFixed(3)} MJ (${solution.iterations} solves, ${solution.totalIterations} with the super-clip search)`,
  );
  console.log(
    solution.superClipMinKph === null
      ? "  super-clipping: never pays"
      : `  super-clipping above ${solution.superClipMinKph} kph: ${battery.superClipTimeS.toFixed(2)} s, ${(battery.superClipHarvestedJ / 1e6).toFixed(3)} MJ`,
  );
  // Stretches where the driver wanted the motor but the battery was empty.
  let start = -1;
  for (let i = 0; i <= n; i++) {
    const starved = i < n && solution.inputs[i].electricDemandW > 1000 && battery.availability[i] < 0.999;
    if (starved && start < 0) start = i;
    if (!starved && start >= 0) {
      const a = solution.profile[start];
      const b = solution.profile[i - 1];
      if (b.distanceM - a.distanceM >= 10) {
        console.log(
          `    battery empty ${a.distanceM.toFixed(0)}-${b.distanceM.toFixed(0)} m (${(a.speedMs * 3.6).toFixed(0)}->${(b.speedMs * 3.6).toFixed(0)} kph)`,
        );
      }
      start = -1;
    }
  }
}

if (process.argv.includes("--corners")) {
  const corners = debugCircuitCorners(circuit.id, f1.id);
  console.log("  slowest 5 corners:");
  [...corners]
    .map((c, k) => ({ ...c, n: k + 1 }))
    .sort((a, b) => a.apexSpeedKph - b.apexSpeedKph)
    .slice(0, 5)
    .forEach((c) => console.log(`    #${c.n} at ${c.apexM.toFixed(0)} m: ${c.apexSpeedKph.toFixed(1)} kph`));
}

const cars = [...REAL_CAR_PRESETS.minivan, ...REAL_CAR_PRESETS.suv, ...REAL_CAR_PRESETS.supercar];
for (const car of cars) {
  const c = chassisFor(car);
  const g = gearboxFromPreset(car);
  const r100 = simulate(car.engine, c, g, { ...DEFAULT_TEST_CONFIG, testType: "zeroToHundred" });
  const r10 = simulate(car.engine, c, g, { ...DEFAULT_TEST_CONFIG, testType: "tenSecond" });
  console.log(
    `${car.id.padEnd(22)} 0-100 ${r100.reachedHundredAtS?.toFixed(4)}s  10s: ${r10.finalSpeedKph.toFixed(4)} kph ${r10.finalDistanceM.toFixed(3)} m`,
  );
}
