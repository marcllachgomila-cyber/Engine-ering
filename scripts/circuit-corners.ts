// Prints each corner the lap physics sees on a circuit - tightest radius
// and apex speed - to sanity-check the circuit geometry pipeline.
// Run with: npx tsx scripts/circuit-corners.ts [circuitId|all] [carId]
import { CIRCUITS } from "../lib/physics/circuits";
import { debugCircuitCorners } from "../lib/physics/circuitDebug";

const [circuitArg = "albert-park", carId] = process.argv.slice(2);
const ids = circuitArg === "all" ? CIRCUITS.map((c) => c.id) : [circuitArg];
for (const id of ids) {
  debugCircuitCorners(id, carId);
  console.log();
}
