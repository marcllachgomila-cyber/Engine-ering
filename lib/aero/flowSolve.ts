import { BodyOutline } from "./bodyOutline";
import { domainFor, FlowGrid, sampleField, sampleFlow } from "./flowField";
import { densifyPolygon, solvePotentialFlow } from "./panelMethod";
import { planDomain, PlanFlowGrid, PlanOutline } from "./planFlow";

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

// The plan view (see planFlow.ts), cached the same way. No ground plane:
// the outline is the whole footprint, symmetric about y = 0.
const planCache = new Map<string, PlanFlowGrid>();

export function cachedPlanFlow(outline: PlanOutline): PlanFlowGrid | null {
  return planCache.get(outline.key) ?? null;
}

export function solvePlanFlow(outline: PlanOutline): PlanFlowGrid {
  const cached = planCache.get(outline.key);
  if (cached) return cached;
  const flow = solvePotentialFlow(densifyPolygon(outline.polygon, PANEL_SPACING_M), { ground: false });
  const grid = { ...sampleField(flow, outline.polygon, outline.wake, planDomain(outline)), outline };
  planCache.set(outline.key, grid);
  return grid;
}
