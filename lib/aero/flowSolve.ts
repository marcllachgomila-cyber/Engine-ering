import { BodyOutline } from "./bodyOutline";
import { domainFor, FlowGrid, sampleFlow } from "./flowField";
import { densifyPolygon, solvePotentialFlow } from "./panelMethod";

// The sampled flow around a body outline, solved once per body shape and
// shared by every view of it (the 2D tunnel and the 3D flow view), so
// switching between them never redoes the work.

const PANEL_SPACING_M = 0.1;
const cache = new Map<string, FlowGrid>();

export function cachedFlow(body: BodyOutline): FlowGrid | null {
  return cache.get(body.key) ?? null;
}

export function solveFlow(body: BodyOutline): FlowGrid {
  const cached = cache.get(body.key);
  if (cached) return cached;
  const flow = solvePotentialFlow(densifyPolygon(body.polygon, PANEL_SPACING_M), { ground: true });
  const grid = sampleFlow(flow, body, domainFor(body));
  cache.set(body.key, grid);
  return grid;
}
