"use client";

import { useMemo } from "react";
import { ClosedBodySpec } from "@/lib/physics/bodyShapes";
import { VehicleState } from "@/lib/physics/vehicleState";
import {
  ARCH_CLEARANCE_M,
  axleLayout,
  bodySideShape,
  extrudeAcross,
  profilePolygonShape,
  shapeWidth,
  smoothstep,
  VEHICLE_COLORS,
} from "./geometry";
import ShapedBodyMesh from "./ShapedBodyMesh";
import Wheels from "./Wheels";

// Generic closed-bodywork car: a full-width lower body (bonnet, flanks,
// boot/deck) with the wheel arches cut in, plus a narrower glasshouse on
// top. Every road body style is this one model fed a different spec (see
// lib/physics/bodyShapes.ts, shared with the 2D wind tunnel).
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
