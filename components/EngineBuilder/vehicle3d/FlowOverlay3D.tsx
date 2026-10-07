"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { FlowGrid, traceStreamline, velocityAt } from "@/lib/aero/flowField";
import { Vec2 } from "@/lib/aero/panelMethod";
import { speedColorRgb } from "@/lib/aero/speedColors";

// 3D view of the flow model: the 2D centreline solution (lib/aero) drawn on
// a few vertical slices across the car, as streamlines and animated
// particles. It's the same 2D section extended across the width - there is
// no flow around the sides, no 3D wake and no trailing vortices - so it
// illustrates the 2D model in 3D space, not a 3D solution.
//
// The 2D field has the nose upstream at -x; the 3D car faces +x, so x is
// mirrored between the two.

// Slices sit within the cabin width, where the centreline section is a
// fair stand-in for the body below it.
const SLICE_SPAN_FRACTION = 0.7;
const SLICES = 5;
const STREAMLINES_PER_SLICE = 9;
const PARTICLES_PER_SLICE = 80;
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

function sliceZ(widthM: number): number[] {
  const span = widthM * SLICE_SPAN_FRACTION;
  return Array.from({ length: SLICES }, (_, i) => -span / 2 + (span * i) / (SLICES - 1));
}

function Streamlines({ grid, widthM }: { grid: FlowGrid; widthM: number }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    const colors: number[] = [];
    const step = (grid.xMax - grid.xMin) / 300;
    // Seeds concentrate near the body, where the flow does something.
    const topSeed = Math.min(grid.yMax * 0.9, grid.body.heightM * 2.4);
    for (const z of sliceZ(widthM)) {
      for (let s = 0; s < STREAMLINES_PER_SLICE; s++) {
        const y0 = 0.05 + (topSeed * (s + 0.5)) / STREAMLINES_PER_SLICE;
        const line = traceStreamline(grid, grid.xMin, y0, step);
        for (let i = 1; i < line.length; i++) {
          const [r, g, b] = linearSpeedColor(line[i].speed);
          positions.push(-line[i - 1].x, line[i - 1].y, z, -line[i].x, line[i].y, z);
          colors.push(r, g, b, r, g, b);
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return geo;
  }, [grid, widthM]);

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
  grid: FlowGrid;
  widthM: number;
  step: (dt: number, positions: THREE.BufferAttribute, colors: THREE.BufferAttribute) => void;
}

function createParticleSim(grid: FlowGrid, widthM: number, count: number): ParticleSim {
  const zs = sliceZ(widthM);
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const pz = new Float32Array(count);
  const age = new Float32Array(count);
  const life = new Float32Array(count);
  const span = grid.xMax - grid.xMin;
  const metresPerS = span / CROSSING_TIME_S;
  const vel: Vec2 = { x: 0, y: 0 };
  const spawn = (i: number, anywhere: boolean) => {
    px[i] = anywhere ? grid.xMin + Math.random() * span : grid.xMin;
    py[i] = Math.random() * grid.yMax * 0.6;
    age[i] = 0;
    life[i] = CROSSING_TIME_S * (1.2 + Math.random());
  };
  for (let i = 0; i < count; i++) {
    pz[i] = zs[i % SLICES];
    spawn(i, true);
  }
  return {
    grid,
    widthM,
    step(dt, positions, colors) {
      for (let i = 0; i < count; i++) {
        age[i] += dt;
        if (!velocityAt(grid, px[i], py[i], vel) || age[i] > life[i]) {
          spawn(i, Math.random() < RANDOM_RESPAWN_SHARE);
          velocityAt(grid, px[i], py[i], vel);
        }
        px[i] += vel.x * metresPerS * dt;
        py[i] += vel.y * metresPerS * dt;
        positions.setXYZ(i, -px[i], py[i], pz[i]);
        const [r, g, b] = linearSpeedColor(Math.hypot(vel.x, vel.y));
        colors.setXYZ(i, r, g, b);
      }
      positions.needsUpdate = true;
      colors.needsUpdate = true;
    },
  };
}

const PARTICLE_COUNT = SLICES * PARTICLES_PER_SLICE;

function Particles({ grid, widthM }: { grid: FlowGrid; widthM: number }) {
  const invalidate = useThree((s) => s.invalidate);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(PARTICLE_COUNT * 3), 3));
    return geo;
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const sim = useRef<ParticleSim | null>(null);
  useFrame((_, delta) => {
    if (!sim.current || sim.current.grid !== grid || sim.current.widthM !== widthM) {
      sim.current = createParticleSim(grid, widthM, PARTICLE_COUNT);
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

export default function FlowOverlay3D({ grid, widthM, animate }: { grid: FlowGrid; widthM: number; animate: boolean }) {
  return (
    <group>
      <Streamlines grid={grid} widthM={widthM} />
      {animate && <Particles grid={grid} widthM={widthM} />}
    </group>
  );
}
