import { getCircuit } from "./circuits";
import { DEFAULT_CHASSIS, DEFAULT_TEST_CONFIG, defaultTyresFor } from "./defaults";
import { findRealCarPreset, gearboxFromPreset } from "./realCars";
import { simulateHotLap, solveHotLap } from "./lapSimulate";
import { ChassisConfig, TestConfig } from "./types";

// Dev-only geometry check: prints every corner the physics actually sees on
// a circuit's racing line - where it is, its tightest radius and the speed
// the car carries through its apex - so fake corners (a kink in the source
// data read as a hairpin) or missing ones stand out at a glance. Not wired
// into the app; run it with `npx tsx scripts/circuit-corners.ts <circuitId>`.

// A point is "in a corner" once its radius drops below this; anything
// gentler is a flat-out kink for any car here. Corners closer together
// than CORNER_MERGE_GAP_M (e.g. the two apexes of one chicane) are reported
// as one.
const CORNER_RADIUS_THRESHOLD_M = 250;
const CORNER_MERGE_GAP_M = 20;

export interface CornerReport {
  startM: number;
  endM: number;
  apexM: number;
  minRadiusM: number;
  apexSpeedKph: number;
  direction: "L" | "R";
}

export function debugCircuitCorners(circuitId: string, carId = "f1-2025"): CornerReport[] {
  if (process.env.NODE_ENV === "production") return [];

  const circuit = getCircuit(circuitId);
  const car = findRealCarPreset(carId);
  if (!car) throw new Error(`Unknown car preset "${carId}"`);

  const chassis: ChassisConfig = {
    ...DEFAULT_CHASSIS,
    ...car.chassis,
    bodyType: car.category,
    ...defaultTyresFor(car.category),
  };
  const gearbox = gearboxFromPreset(car);
  const test: TestConfig = { ...DEFAULT_TEST_CONFIG, testType: "hotLap", circuitId: circuit.id };
  const { profile, battery, iterations } = solveHotLap(car.engine, chassis, gearbox, test, circuit);

  const corners: CornerReport[] = [];
  const inCorner = (i: number) => Math.abs(profile[i].curvature) > 1 / CORNER_RADIUS_THRESHOLD_M;
  for (let i = 0; i < profile.length; i++) {
    if (!inCorner(i)) continue;
    const start = i;
    while (i + 1 < profile.length && inCorner(i + 1)) i++;
    let apex = start;
    let tightest = start;
    for (let j = start; j <= i; j++) {
      if (profile[j].speedMs < profile[apex].speedMs) apex = j;
      if (Math.abs(profile[j].curvature) > Math.abs(profile[tightest].curvature)) tightest = j;
    }
    const corner: CornerReport = {
      startM: profile[start].distanceM,
      endM: profile[i].distanceM,
      apexM: profile[apex].distanceM,
      minRadiusM: 1 / Math.abs(profile[tightest].curvature),
      apexSpeedKph: profile[apex].speedMs * 3.6,
      direction: profile[tightest].curvature > 0 ? "L" : "R",
    };
    const prev = corners[corners.length - 1];
    if (prev && corner.startM - prev.endM < CORNER_MERGE_GAP_M) {
      prev.endM = corner.endM;
      if (corner.minRadiusM < prev.minRadiusM) {
        prev.minRadiusM = corner.minRadiusM;
        prev.direction = corner.direction;
      }
      if (corner.apexSpeedKph < prev.apexSpeedKph) {
        prev.apexSpeedKph = corner.apexSpeedKph;
        prev.apexM = corner.apexM;
      }
    } else {
      corners.push(corner);
    }
  }

  const lap = simulateHotLap(car.engine, chassis, gearbox, test, circuit);
  const lapTimeS = lap.elapsedS;
  const minRadiusM = Math.min(...circuit.points.map((p) => 1 / Math.max(Math.abs(p.curvature), 1e-9)));

  console.log(`${circuit.name} (${circuit.id}) with ${carId}: ${corners.length} corners found, ${circuit.corners} official`);
  console.log(
    `lap ${formatLapTime(lapTimeS)}, min radius ${minRadiusM.toFixed(1)} m, ${circuit.points.length} points`,
  );
  if (battery) {
    console.log(
      `battery: ${(battery.deployedJ / 1e6).toFixed(2)} MJ deployed, ${(battery.harvestedJ / 1e6).toFixed(2)} MJ harvested, ` +
        `starts/ends at ${(battery.startSocJ / 1e6).toFixed(2)} MJ (${iterations} solves)`,
    );
  }
  console.log("  #  dir   start m   apex m  min radius m  apex km/h");
  corners.forEach((c, k) => {
    console.log(
      [
        String(k + 1).padStart(3),
        c.direction.padStart(4),
        c.startM.toFixed(0).padStart(9),
        c.apexM.toFixed(0).padStart(8),
        c.minRadiusM.toFixed(1).padStart(13),
        c.apexSpeedKph.toFixed(0).padStart(10),
      ].join(" "),
    );
  });
  return corners;
}

function formatLapTime(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s - m * 60).toFixed(3).padStart(6, "0")}`;
}
