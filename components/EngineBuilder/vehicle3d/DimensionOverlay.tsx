"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html, Line } from "@react-three/drei";
import * as THREE from "three";
import { VehicleState } from "@/lib/physics/vehicleState";
import { axleLayout, VEHICLE_COLORS } from "./geometry";

type Point = [number, number, number];

// Gap between the body and its dimension lines, and the length of the
// end ticks - drawing-sheet conventions, nothing physical.
const OFFSET_M = 0.35;
const TICK_M = 0.12;
const GROUND_Y = 0.01;
// A dimension seen within ~25 degrees of end-on collapses to a stub with
// its label piled onto the others, so it's hidden until the view turns.
const EDGE_ON_COS = 0.9;

// A dimension line from a to b with end ticks along `tickDir` and a
// centred label.
function Dimension({ a, b, tickDir, label }: { a: Point; b: Point; tickDir: Point; label: string }) {
  const groupRef = useRef<THREE.Group>(null);
  const labelRef = useRef<HTMLSpanElement>(null);
  const tick = (p: Point): Point[] => [
    [p[0] - tickDir[0] * TICK_M, p[1] - tickDir[1] * TICK_M, p[2] - tickDir[2] * TICK_M],
    [p[0] + tickDir[0] * TICK_M, p[1] + tickDir[1] * TICK_M, p[2] + tickDir[2] * TICK_M],
  ];
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];

  // Runs only on rendered frames (the viewer renders on demand).
  useFrame(({ camera }) => {
    const along = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize();
    const toCamera = camera.position.clone().sub(new THREE.Vector3(...mid)).normalize();
    const visible = Math.abs(along.dot(toCamera)) < EDGE_ON_COS;
    if (groupRef.current) groupRef.current.visible = visible;
    if (labelRef.current) labelRef.current.style.visibility = visible ? "visible" : "hidden";
  });

  return (
    <group ref={groupRef}>
      <Line points={[a, b]} color={VEHICLE_COLORS.edge} lineWidth={1} />
      <Line points={tick(a)} color={VEHICLE_COLORS.edge} lineWidth={1} />
      <Line points={tick(b)} color={VEHICLE_COLORS.edge} lineWidth={1} />
      <Html position={mid} center zIndexRange={[10, 0]} style={{ pointerEvents: "none" }}>
        <span
          ref={labelRef}
          className="whitespace-nowrap rounded bg-zinc-950/80 px-1 font-mono text-[10px] text-amber-400"
        >
          {label}
        </span>
      </Html>
    </group>
  );
}

// Overall length, wheelbase, height and width, from the vehicle data -
// the same numbers the physics and the info panel use, not measured off
// the mesh. Axle positions use the viewer's representative overhang split
// (see axleLayout), since the data only fixes the wheelbase itself.
export default function DimensionOverlay({ vehicle }: { vehicle: VehicleState }) {
  const { lengthM, widthM, heightM, wheelbaseM, frontTrackM } = vehicle.dimensions;
  const { frontX, rearX } = axleLayout(vehicle);
  const halfL = lengthM / 2;
  const halfW = widthM / 2;
  // Wheelbase is drawn hub to hub at axle height, just outboard of the
  // tyres - so it doesn't overlap the overall length in side view.
  const hubY = vehicle.tyres.front.rollingRadiusM;
  const hubZ = Math.max(halfW, frontTrackM / 2 + vehicle.tyres.front.widthMm / 2000) + 0.1;

  return (
    <group>
      <Dimension
        a={[-halfL, GROUND_Y, halfW + OFFSET_M]}
        b={[halfL, GROUND_Y, halfW + OFFSET_M]}
        tickDir={[0, 0, 1]}
        label={`L ${lengthM.toFixed(2)} m`}
      />
      <Dimension
        a={[rearX, hubY, hubZ]}
        b={[frontX, hubY, hubZ]}
        tickDir={[0, 1, 0]}
        label={`WB ${wheelbaseM.toFixed(2)} m`}
      />
      <Dimension
        a={[halfL + OFFSET_M, 0, halfW]}
        b={[halfL + OFFSET_M, heightM, halfW]}
        tickDir={[1, 0, 0]}
        label={`H ${heightM.toFixed(2)} m`}
      />
      <Dimension
        a={[-halfL - OFFSET_M, GROUND_Y, -halfW]}
        b={[-halfL - OFFSET_M, GROUND_Y, halfW]}
        tickDir={[1, 0, 0]}
        label={`W ${widthM.toFixed(2)} m`}
      />
    </group>
  );
}
