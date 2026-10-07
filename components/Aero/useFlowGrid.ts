"use client";

import { useEffect, useMemo, useState } from "react";
import { BodyOutline, vehicleBodyOutline } from "@/lib/aero/bodyOutline";
import { FlowGrid } from "@/lib/aero/flowField";
import { cachedFlow, solveFlow } from "@/lib/aero/flowSolve";
import { VehicleState } from "@/lib/physics/vehicleState";

// The vehicle's body outline and its solved flow field. A cached solution
// is returned straight away; otherwise the solve runs just after the first
// paint (so whatever opened the view can show a "solving" state instead of
// freezing) and the grid arrives on the next render. Pass enabled = false
// to skip solving entirely until it's needed.
export function useFlowGrid(vehicle: VehicleState, enabled = true): { body: BodyOutline; grid: FlowGrid | null } {
  // Building the outline is cheap; the solve is cached by its key (body
  // type + dimensions), so weight, engine or tyre tweaks never re-solve.
  const body = useMemo(() => vehicleBodyOutline(vehicle), [vehicle]);
  const [solved, setSolved] = useState<{ key: string; grid: FlowGrid } | null>(null);
  const grid = cachedFlow(body) ?? (solved?.key === body.key ? solved.grid : null);

  useEffect(() => {
    if (grid || !enabled) return;
    const id = setTimeout(() => setSolved({ key: body.key, grid: solveFlow(body) }), 30);
    return () => clearTimeout(id);
  }, [body, grid, enabled]);

  return { body, grid };
}
