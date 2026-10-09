"use client";

import { useEffect, useMemo, useState } from "react";
import { BodyOutline, vehicleBodyOutline } from "@/lib/aero/bodyOutline";
import { FlowGrid } from "@/lib/aero/flowField";
import { cachedFlow, cachedPlanFlow, solveFlow, solvePlanFlow } from "@/lib/aero/flowSolve";
import { PlanFlowGrid, PlanOutline, vehiclePlanOutline } from "@/lib/aero/planFlow";
import { VehicleState } from "@/lib/physics/vehicleState";

// A cached solution is returned straight away; otherwise the solve runs
// just after the first paint (so whatever opened the view can show a
// "solving" state instead of freezing) and the grid arrives on the next
// render. With enabled = false nothing is solved until it's needed.
function useSolved<Shape extends { key: string }, Grid>(
  shape: Shape,
  cached: (shape: Shape) => Grid | null,
  solve: (shape: Shape) => Grid,
  enabled: boolean,
): Grid | null {
  const [solved, setSolved] = useState<{ key: string; grid: Grid } | null>(null);
  const grid = cached(shape) ?? (solved?.key === shape.key ? solved.grid : null);

  useEffect(() => {
    if (grid || !enabled) return;
    const id = setTimeout(() => setSolved({ key: shape.key, grid: solve(shape) }), 30);
    return () => clearTimeout(id);
  }, [shape, grid, enabled, solve]);

  return grid;
}

// The vehicle's side-section outline and its solved flow field. Building
// the outline is cheap; the solve is cached by its key (body type +
// dimensions), so weight, engine or tyre tweaks never re-solve.
export function useFlowGrid(vehicle: VehicleState, enabled = true): { body: BodyOutline; grid: FlowGrid | null } {
  const body = useMemo(() => vehicleBodyOutline(vehicle), [vehicle]);
  const grid = useSolved(body, cachedFlow, solveFlow, enabled);
  return { body, grid };
}

// The same for the plan view (the flow around the car's sides).
export function usePlanFlowGrid(
  vehicle: VehicleState,
  enabled = true,
): { outline: PlanOutline; grid: PlanFlowGrid | null } {
  const outline = useMemo(() => vehiclePlanOutline(vehicle), [vehicle]);
  const grid = useSolved(outline, cachedPlanFlow, solvePlanFlow, enabled);
  return { outline, grid };
}
