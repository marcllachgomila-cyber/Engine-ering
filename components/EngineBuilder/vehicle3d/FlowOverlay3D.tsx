"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FlowGrid, traceStreamline, velocityAt } from "@/lib/aero/flowField";
import { Vec2 } from "@/lib/aero/panelMethod";
import { PlanFlowGrid, planVelocityAt } from "@/lib/aero/planFlow";
import { speedColorRgb } from "@/lib/aero/speedColors";

// 3D view of the flow model, from two 2D solutions (lib/aero) drawn as
// streamlines and animated particles:
// - over and under the car: the side section on a few vertical slices
//   across the middle of the car;
// - around its sides: the plan-view section on horizontal sheets at flank
//   height (lib/aero/planFlow.ts).
// Each sheet is a 2D solution placed in 3D space - the two don't interact,
// and there's no 3D wake or trailing vortices - so it illustrates the 2D
// models, not a 3D solution.
//
// Both 2D fields have the nose upstream at -x; the 3D car faces +x, so x is
// mirrored between them.

// Side-section slices sit within the cabin width, where the centreline
// section is a fair stand-in for the body below it.
const SLICE_SPAN_FRACTION = 0.7;
const SLICES = 5;
const STREAMLINES_PER_SLICE = 9;
// Plan-view streamlines per side of the car, per sheet.
const PLAN_STREAMLINES_PER_SIDE = 7;
const PARTICLES_PER_SHEET = 80;
// Particles cross the whole tunnel in about this many seconds at
// freestream speed (visual pacing only - the field is in freestream units).
const CROSSING_TIME_S = 3.5;
const RANDOM_RESPAWN_SHARE = 0.25;

// Vertex colours are read as linear values, while the shared scale is
// defined in sRGB (like every colour on the page) - convert once per scale
// entry so the 3D view shows the same colours as the 2D tunnel.
const linearCache = new Map<number[], [number, number, number]>();
function linearSpeedColor(speed: number): [number, number, number] {
  const srgb = speedColorRgb(speed);
  let linear = linearCache.get(srgb);
  if (!linear) {
    const c = new THREE.Color().setRGB(srgb[0] / 255, srgb[1] / 255, srgb[2] / 255, THREE.SRGBColorSpace);
    linear = [c.r, c.g, c.b];
    linearCache.set(srgb, linear);
  }
  return linear;
}

// One 2D flow placed in the scene. (a, b) are its 2D coordinates: a
// downstream, b up (side slices) or across (plan sheets).
interface Sheet {
  xMin: number;
  xMax: number;
  lookup: (a: number, b: number, out: Vec2) => boolean;
  toWorld: (a: number, b: number) => [number, number, number];
  // Where a particle (re)enters across the sheet.
  randomB: () => number;
}

function sliceZ(widthM: number): number[] {
  const span = widthM * SLICE_SPAN_FRACTION;
  return Array.from({ length: SLICES }, (_, i) => -span / 2 + (span * i) / (SLICES - 1));
}

function buildSheets(grid: FlowGrid, plan: PlanFlowGrid | null, widthM: number): Sheet[] {
  const sheets: Sheet[] = sliceZ(widthM).map((z) => ({
    xMin: grid.xMin,
    xMax: grid.xMax,
    lookup: (a, b, out) => velocityAt(grid, a, b, out),
    toWorld: (a, b) => [-a, b, z],
    randomB: () => Math.random() * grid.yMax * 0.6,
  }));
  if (plan) {
    const reach = plan.outline.maxHalfWidthM + 0.8;
    for (const level of plan.outline.levelsM) {
      sheets.push({
        xMin: plan.xMin,
        xMax: plan.xMax,
        lookup: (a, b, out) => planVelocityAt(plan, a, b, out),
        toWorld: (a, b) => [-a, level, b],
        randomB: () => (Math.random() * 2 - 1) * reach,
      });
    }
  }
  return sheets;
}

function Streamlines({ grid, plan, widthM }: { grid: FlowGrid; plan: PlanFlowGrid | null; widthM: number }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const addLine = (line: { x: number; y: number; speed: number }[], toWorld: Sheet["toWorld"]) => {
      for (let i = 1; i < line.length; i++) {
        const [r, g, b] = linearSpeedColor(line[i].speed);
        positions.push(...toWorld(line[i - 1].x, line[i - 1].y), ...toWorld(line[i].x, line[i].y));
        colors.push(r, g, b, r, g, b);
      }
    };

    // Side section: seeds concentrate near the body, where the flow does
    // something.
    const step = (grid.xMax - grid.xMin) / 300;
    const topSeed = Math.min(grid.yMax * 0.9, grid.body.heightM * 2.4);
    for (const z of sliceZ(widthM)) {
      for (let s = 0; s < STREAMLINES_PER_SLICE; s++) {
        const y0 = 0.05 + (topSeed * (s + 0.5)) / STREAMLINES_PER_SLICE;
        addLine(traceStreamline(grid, grid.xMin, y0, step), (a, b) => [-a, b, z]);
      }
    }

    // Plan view: traced in the sampled half and drawn on both sides.
    if (plan) {
      const planStep = (plan.xMax - plan.xMin) / 300;
      const reach = plan.outline.maxHalfWidthM + 0.6;
      for (let s = 0; s < PLAN_STREAMLINES_PER_SIDE; s++) {
        const b0 = (reach * (s + 0.5)) / PLAN_STREAMLINES_PER_SIDE;
        const line = traceStreamline(plan, plan.xMin, b0, planStep);
        for (const level of plan.outline.levelsM) {
          addLine(line, (a, b) => [-a, level, b]);
          addLine(line, (a, b) => [-a, level, -b]);
        }
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, [grid, plan, widthM]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial vertexColors transparent opacity={0.35} depthWrite={false} />
    </lineSegments>
  );
}

// Particle state as a plain object outside React: created lazily from the
// frame loop and advanced there, writing straight into the points' buffers.
interface ParticleSim {
  sheets: Sheet[];
  step: (dt: number, positions: THREE.BufferAttribute, colors: THREE.BufferAttribute) => void;
}

function createParticleSim(sheets: Sheet[], count: number): ParticleSim {
  const pa = new Float32Array(count);
  const pb = new Float32Array(count);
  const age = new Float32Array(count);
  const life = new Float32Array(count);
  const vel: Vec2 = { x: 0, y: 0 };
  const sheetOf = (i: number) => sheets[i % sheets.length];
  const spawn = (i: number, anywhere: boolean) => {
    const sheet = sheetOf(i);
    pa[i] = anywhere ? sheet.xMin + Math.random() * (sheet.xMax - sheet.xMin) : sheet.xMin;
    pb[i] = sheet.randomB();
    age[i] = 0;
    life[i] = CROSSING_TIME_S * (1.2 + Math.random());
  };
  for (let i = 0; i < count; i++) spawn(i, true);
  return {
    sheets,
    step(dt, positions, colors) {
      for (let i = 0; i < count; i++) {
        const sheet = sheetOf(i);
        const metresPerS = (sheet.xMax - sheet.xMin) / CROSSING_TIME_S;
        age[i] += dt;
        if (!sheet.lookup(pa[i], pb[i], vel) || age[i] > life[i]) {
          spawn(i, Math.random() < RANDOM_RESPAWN_SHARE);
          sheet.lookup(pa[i], pb[i], vel);
        }
        pa[i] += vel.x * metresPerS * dt;
        pb[i] += vel.y * metresPerS * dt;
        positions.setXYZ(i, ...sheet.toWorld(pa[i], pb[i]));
        const [r, g, b] = linearSpeedColor(Math.hypot(vel.x, vel.y));
        colors.setXYZ(i, r, g, b);
      }
      positions.needsUpdate = true;
      colors.needsUpdate = true;
    },
  };
}

function Particles({ sheets }: { sheets: Sheet[] }) {
  const invalidate = useThree((s) => s.invalidate);
  const count = sheets.length * PARTICLES_PER_SHEET;
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    return geo;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const sim = useRef<ParticleSim | null>(null);
  useFrame((_, delta) => {
    if (!sim.current || sim.current.sheets !== sheets) {
      sim.current = createParticleSim(sheets, count);
    }
    sim.current.step(
      Math.min(1 / 30, delta),
      geometry.getAttribute("position") as THREE.BufferAttribute,
      geometry.getAttribute("color") as THREE.BufferAttribute,
    );
    // The viewer renders on demand; keep frames coming only while the
    // particles are on screen.
    invalidate();
  });

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial vertexColors size={3} sizeAttenuation={false} transparent opacity={0.9} depthWrite={false} />
    </points>
  );
}

export default function FlowOverlay3D({
  grid,
  plan,
  widthM,
  animate,
}: {
  grid: FlowGrid;
  // The plan-view flow around the sides; drawn once it's solved.
  plan: PlanFlowGrid | null;
  widthM: number;
  animate: boolean;
}) {
  const sheets = useMemo(() => buildSheets(grid, plan, widthM), [grid, plan, widthM]);
  return (
    <group>
      <Streamlines grid={grid} plan={plan} widthM={widthM} />
      {animate && <Particles sheets={sheets} />}
    </group>
  );
}
