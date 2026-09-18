import { Circuit } from "@/lib/physics/types";

// Curvature magnitude above which a point counts as "in a corner" rather
// than a straight, purely for picking where the flying-lap lead-in
// animation should start - roughly a 500m-radius kink or tighter, well
// inside what the friction-ellipse model (speedProfile.ts) would treat as a
// real constraint rather than noise.
const CORNER_CURVATURE_THRESHOLD = 1 / 500;

// How far before the corner's own entry to start the animation, so the car
// is seen carrying speed into the corner rather than already mid-apex.
const LEAD_IN_APPROACH_M = 60;
const MIN_LEAD_IN_M = 150;
const MAX_LEAD_IN_FRACTION = 0.22;

// Where, as a 0..1 fraction of lap distance, a flying lap's lead-in
// animation should start on the circuit map - scanning back from the
// start/finish line for the last real corner, so the car is shown carrying
// speed through it and onto the approach straight before crossing the line,
// rather than simply appearing on the line already at speed.
export function flyingLapLeadInFraction(circuit: Circuit): number {
  const { points, lengthM } = circuit;
  const n = points.length;
  if (n < 3 || lengthM <= 0) return 0.9;

  // Walk back from the line to the last point that's actually in a corner.
  let i = n - 1;
  while (i > 0 && Math.abs(points[i].curvature) < CORNER_CURVATURE_THRESHOLD) i--;
  if (i <= 0) return 0.9; // no real corner near the end - fall back to a flat lead-in

  // Keep walking back to that corner's entry (where curvature drops off).
  while (i > 0 && Math.abs(points[i].curvature) >= CORNER_CURVATURE_THRESHOLD) i--;

  const cornerEntryM = points[i].distanceM;
  const leadInStartM = Math.max(0, cornerEntryM - LEAD_IN_APPROACH_M);
  const distanceFromLineM = lengthM - leadInStartM;
  const cappedDistanceM = Math.min(
    Math.max(distanceFromLineM, MIN_LEAD_IN_M),
    lengthM * MAX_LEAD_IN_FRACTION,
  );
  return Math.max(0, 1 - cappedDistanceM / lengthM);
}
