// Checks the 2D potential-flow solver (lib/aero/panelMethod.ts) against
// known answers, then reports on the wind tunnel's sampled field.
// Exits non-zero on any failed check.
// Run with: npx tsx scripts/flow-check.ts
import { densifyPolygon, solvePotentialFlow, Vec2 } from "../lib/aero/panelMethod";
import { domainFor, sampleFlow, traceStreamline } from "../lib/aero/flowField";
import { REFERENCE_BODY } from "../lib/aero/referenceBody";

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`  ${ok ? "ok  " : "FAIL"} ${name}: ${detail}`);
  if (!ok) failures++;
}

function surfaceSpeeds(flow: ReturnType<typeof solvePotentialFlow>): number[] {
  // Evaluated a hair outside each control point (on it, the closed form is
  // singular in the tangential direction only through rounding).
  return flow.panels.map((p) => {
    const vel = flow.velocityAt(p.xc + p.nx * 1e-6, p.yc + p.ny * 1e-6);
    return Math.hypot(vel.x, vel.y);
  });
}

// 1. Cylinder in a free stream: exact potential-flow answer is a surface
// speed of 2 U sin(theta) - peak 2.0 at the top/bottom, 0 at the
// stagnation points.
console.log("Cylinder, no ground (exact peak surface speed = 2.000 U)");
const circle: Vec2[] = Array.from({ length: 120 }, (_, i) => {
  const t = (2 * Math.PI * i) / 120;
  return { x: Math.cos(t), y: Math.sin(t) };
});
const cyl = solvePotentialFlow(circle, { ground: false });
const cylSpeeds = surfaceSpeeds(cyl);
const peak = Math.max(...cylSpeeds);
check("peak surface speed", Math.abs(peak - 2) < 0.01, `${peak.toFixed(4)} U`);
// Control points sit half a panel off the true stagnation points, so
// compare every one against the exact 2|sin(theta)| at its own angle.
const cylErr = Math.max(...cyl.panels.map((p, i) => Math.abs(cylSpeeds[i] - 2 * Math.abs(Math.sin(Math.atan2(p.yc, p.xc))))));
check("surface speed vs exact 2|sin(theta)|", cylErr < 0.01, `max error ${cylErr.toFixed(4)} U`);
const cylNet = cyl.panels.reduce((s, p, j) => s + cyl.strengths[j] * p.length, 0);
check("net source strength (closed body)", Math.abs(cylNet) < 1e-6, cylNet.toExponential(2));

// 2. Reference body over the ground plane.
console.log(`\n${REFERENCE_BODY.name} over a ground plane`);
const polygon = densifyPolygon(REFERENCE_BODY.polygon, 0.1);
let t0 = performance.now();
const flow = solvePotentialFlow(polygon, { ground: true });
const solveMs = performance.now() - t0;
const maxNormal = Math.max(
  ...flow.panels.map((p) => {
    const vel = flow.velocityAt(p.xc + p.nx * 1e-6, p.yc + p.ny * 1e-6);
    return Math.abs(vel.x * p.nx + vel.y * p.ny);
  }),
);
check("flow tangency at panels", maxNormal < 1e-3, `max |V.n| ${maxNormal.toExponential(2)} U over ${flow.panels.length} panels`);
const groundV = Math.max(...[-6, -2, 0, 2, 6].map((x) => Math.abs(flow.velocityAt(x, 0).y)));
check("ground is a streamline", groundV < 1e-9, `max |v| at y=0 ${groundV.toExponential(2)} U`);
const far = flow.velocityAt(-200, 1);
check("far upstream = freestream", Math.abs(far.x - 1) < 1e-3 && Math.abs(far.y) < 1e-3, `(${far.x.toFixed(4)}, ${far.y.toFixed(4)}) U`);
// Should be zero for a closed body; relative to the total source
// magnitude, the residual is discretisation error around the sharp corners.
const net = flow.panels.reduce((s, p, j) => s + flow.strengths[j] * p.length, 0);
const gross = flow.panels.reduce((s, p, j) => s + Math.abs(flow.strengths[j]) * p.length, 0);
check("net source strength (closed body)", Math.abs(net) / gross < 0.01, `${((100 * Math.abs(net)) / gross).toFixed(2)}% of total`);
// Potential flow is singular at sharp convex corners (the tail edges,
// where a real flow separates instead), so the roof peak is reported away
// from them.
const speeds = surfaceSpeeds(flow);
const halfL = REFERENCE_BODY.lengthM / 2;
let roofIdx = -1;
flow.panels.forEach((p, i) => {
  const awayFromEnds = Math.abs(p.xc) < halfL - 0.2;
  const onTop = p.ny > 0.3;
  if (awayFromEnds && onTop && (roofIdx < 0 || speeds[i] > speeds[roofIdx])) roofIdx = i;
});
console.log(
  `  roof peak surface speed ${speeds[roofIdx].toFixed(2)} U at x=${flow.panels[roofIdx].xc.toFixed(2)} m, y=${flow.panels[roofIdx].yc.toFixed(2)} m; solve ${solveMs.toFixed(0)} ms`,
);

// 3. Sampled field used by the tunnel.
console.log("\nSampled field");
const domain = domainFor(REFERENCE_BODY);
t0 = performance.now();
const grid = sampleFlow(flow, REFERENCE_BODY, domain);
const sampleMs = performance.now() - t0;
console.log(`  grid ${grid.nx} x ${grid.ny}, sampled in ${sampleMs.toFixed(0)} ms`);
check("sampling cost", sampleMs < 1500, `${sampleMs.toFixed(0)} ms (Node; a phone is slower)`);
const line = traceStreamline(grid, domain.xMin, 0.5 * REFERENCE_BODY.heightM + 1.5, 0.05);
check("streamline crosses the tunnel", line.length > 10 && line[line.length - 1].x > REFERENCE_BODY.lengthM / 2, `${line.length} points, ends at x=${line[line.length - 1].x.toFixed(2)} m`);

console.log(failures ? `\n${failures} check(s) failed` : "\nAll flow checks passed");
process.exit(failures ? 1 : 0);
