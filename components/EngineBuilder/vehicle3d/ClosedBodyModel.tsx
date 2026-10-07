"use client";

import { useMemo } from "react";
import { VehicleState } from "@/lib/physics/vehicleState";
import {
  ARCH_CLEARANCE_M,
  axleLayout,
  bodySideShape,
  extrudeAcross,
  Profile,
  profilePolygonShape,
  shapeWidth,
  smoothstep,
  VEHICLE_COLORS,
} from "./geometry";
import ShapedBodyMesh from "./ShapedBodyMesh";
import Wheels from "./Wheels";

// Generic closed-bodywork car: a full-width lower body (bonnet, flanks,
// boot/deck) with the wheel arches cut in, plus a narrower glasshouse on
// top. Every road body style is this one model fed a different spec - the
// numbers below are shape descriptors for a representative car of the
// class, not any manufacturer's surfaces.
export interface ClosedBodySpec {
  // Upper outline of the lower body, nose to tail (see Profile).
  lowerProfile: Profile;
  // The glasshouse as a closed polygon in the same (u, v) space.
  cabin: Profile;
  // Cabin width at its base, as a fraction of body width, and how much
  // narrower it gets by the roof (tumblehome).
  cabinWidthFraction: number;
  tumblehome: number;
  // Plan-view narrowing at the very nose and tail, as a fraction of width.
  noseTaper: number;
  tailTaper: number;
}

// One-box: short bonnet, steep windscreen running straight into a long
// flat roof and a near-vertical tailgate.
export const MINIVAN_SPEC: ClosedBodySpec = {
  lowerProfile: [[0, 0.25], [0.02, 0.42], [0.1, 0.5], [0.2, 0.53], [0.97, 0.56], [1, 0.5]],
  cabin: [[0.12, 0.49], [0.32, 1], [0.95, 0.985], [0.995, 0.62], [0.995, 0.49]],
  cabinWidthFraction: 0.93,
  tumblehome: 0.1,
  noseTaper: 0.08,
  tailTaper: 0.03,
};

// Two-box: tall upright nose and bonnet, high beltline, square tail.
export const SUV_SPEC: ClosedBodySpec = {
  lowerProfile: [[0, 0.3], [0.02, 0.48], [0.2, 0.56], [0.28, 0.58], [0.97, 0.6], [1, 0.52]],
  cabin: [[0.27, 0.55], [0.42, 1], [0.92, 0.98], [0.985, 0.64], [0.985, 0.55]],
  cabinWidthFraction: 0.9,
  tumblehome: 0.12,
  noseTaper: 0.08,
  tailTaper: 0.04,
};

// Mid-engine wedge: low pointed nose, cab-forward canopy, engine deck
// behind the cabin over the rear axle.
export const SUPERCAR_SPEC: ClosedBodySpec = {
  lowerProfile: [[0, 0.3], [0.02, 0.4], [0.12, 0.45], [0.3, 0.52], [0.85, 0.58], [0.96, 0.56], [1, 0.42]],
  cabin: [[0.28, 0.48], [0.45, 1], [0.6, 0.99], [0.86, 0.58], [0.86, 0.48]],
  cabinWidthFraction: 0.8,
  tumblehome: 0.18,
  noseTaper: 0.15,
  tailTaper: 0.06,
};

export default function ClosedBodyModel({ vehicle, spec }: { vehicle: VehicleState; spec: ClosedBodySpec }) {
  const { lengthM, widthM, heightM, rideHeightM } = vehicle.dimensions;
  const axles = axleLayout(vehicle);
  const frontRadius = vehicle.tyres.front.rollingRadiusM;
  const rearRadius = vehicle.tyres.rear.rollingRadiusM;

  const lowerBody = useMemo(() => {
    const halfL = lengthM / 2;
    const shape = bodySideShape(lengthM, rideHeightM, heightM, spec.lowerProfile, [
      { x: axles.frontX, centerY: frontRadius, radius: frontRadius + ARCH_CLEARANCE_M },
      { x: axles.rearX, centerY: rearRadius, radius: rearRadius + ARCH_CLEARANCE_M },
    ]);
    return shapeWidth(
      extrudeAcross(shape, widthM),
      (x) =>
        1 -
        spec.noseTaper * smoothstep(halfL - 0.12 * lengthM, halfL, x) -
        spec.tailTaper * smoothstep(-halfL + 0.08 * lengthM, -halfL, x),
    );
  }, [lengthM, widthM, heightM, rideHeightM, axles.frontX, axles.rearX, frontRadius, rearRadius, spec]);

  const cabinBody = useMemo(() => {
    const shape = profilePolygonShape(lengthM, rideHeightM, heightM, spec.cabin);
    const baseY = rideHeightM + Math.min(...spec.cabin.map(([, v]) => v)) * (heightM - rideHeightM);
    return shapeWidth(
      extrudeAcross(shape, widthM * spec.cabinWidthFraction, 0.04),
      (_, y) => 1 - spec.tumblehome * smoothstep(baseY, heightM, y),
    );
  }, [lengthM, widthM, heightM, rideHeightM, spec]);

  return (
    <group>
      <ShapedBodyMesh body={lowerBody}>
        <meshStandardMaterial color={VEHICLE_COLORS.body} roughness={0.65} metalness={0.05} />
      </ShapedBodyMesh>
      <ShapedBodyMesh body={cabinBody}>
        <meshStandardMaterial color={VEHICLE_COLORS.glass} roughness={0.25} metalness={0.2} />
      </ShapedBodyMesh>
      <Wheels vehicle={vehicle} axles={axles} />
    </group>
  );
}
