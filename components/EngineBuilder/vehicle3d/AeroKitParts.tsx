"use client";

import { Edges } from "@react-three/drei";
import { ClosedBodySpec, sampleProfile } from "@/lib/physics/bodyShapes";
import { VehicleState } from "@/lib/physics/vehicleState";
import { VEHICLE_COLORS } from "./geometry";

// Schematic bolt-on aero for the closed-body model, driven by the
// vehicle's aero kit. Sizes are visual only - the parts' effect on the
// numbers comes from lib/physics/aeroKit.ts, not from this geometry.

// Wing height above the deck, chord and pitch (negative = trailing edge up,
// the downforce attitude, as on the F1 model).
const WING = {
  low: { heightM: 0.1, chordM: 0.22, pitchRad: -0.12 },
  high: { heightM: 0.3, chordM: 0.3, pitchRad: -0.3 },
} as const;

function Part({
  position,
  size,
  rotationZ = 0,
  color = VEHICLE_COLORS.trim,
}: {
  position: [number, number, number];
  size: [number, number, number];
  rotationZ?: number;
  color?: string;
}) {
  return (
    <mesh position={position} rotation={[0, 0, rotationZ]}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.5} metalness={0.25} />
      <Edges threshold={20} color={VEHICLE_COLORS.edge} />
    </mesh>
  );
}

export default function AeroKitParts({ vehicle, spec }: { vehicle: VehicleState; spec: ClosedBodySpec }) {
  const kit = vehicle.aero.kit;
  if (!kit) return null;
  const { lengthM, widthM, heightM, rideHeightM } = vehicle.dimensions;
  const halfL = lengthM / 2;
  const bodyH = heightM - rideHeightM;
  // Body surface height at a station u (0 nose .. 1 tail), +x is the nose.
  const deckY = (u: number) => rideHeightM + sampleProfile(spec.lowerProfile, u) * bodyH;
  const xAt = (u: number) => halfL - u * lengthM;

  const wing = kit.rearWing !== "none" ? WING[kit.rearWing] : null;
  const wingU = 0.94;
  const wingSpan = widthM * 0.85;
  const wingBaseY = deckY(wingU);
  const wingY = wingBaseY + (wing?.heightM ?? 0);

  return (
    <group>
      {wing && (
        <group>
          <Part position={[xAt(wingU), wingY, 0]} size={[wing.chordM, 0.025, wingSpan]} rotationZ={wing.pitchRad} />
          {[1, -1].map((side) => (
            <Part
              key={`upright-${side}`}
              position={[xAt(wingU), (wingBaseY + wingY) / 2, side * wingSpan * 0.3]}
              size={[0.06, Math.max(0.02, wingY - wingBaseY), 0.02]}
            />
          ))}
          {kit.rearWing === "high" &&
            [1, -1].map((side) => (
              <Part
                key={`endplate-${side}`}
                position={[xAt(wingU), wingY, (side * wingSpan) / 2]}
                size={[wing.chordM + 0.08, 0.18, 0.012]}
              />
            ))}
        </group>
      )}
      {kit.frontSplitter && (
        <Part position={[halfL + 0.02, rideHeightM + 0.01, 0]} size={[0.2, 0.015, widthM * 0.9]} />
      )}
      {kit.underbody === "diffuser" && (
        <group>
          {/* Ramp rising toward the tail, with two strakes. */}
          <Part position={[-halfL + 0.3, rideHeightM + 0.05, 0]} size={[0.6, 0.012, widthM * 0.7]} rotationZ={-0.18} />
          {[1, -1].map((side) => (
            <Part
              key={`strake-${side}`}
              position={[-halfL + 0.3, rideHeightM + 0.06, side * widthM * 0.15]}
              size={[0.55, 0.1, 0.01]}
            />
          ))}
        </group>
      )}
    </group>
  );
}
