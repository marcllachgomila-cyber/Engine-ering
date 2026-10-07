"use client";

import { VehicleAxleTyre, VehicleState } from "@/lib/physics/vehicleState";
import { AxleLayout, VEHICLE_COLORS } from "./geometry";

function Wheel({ x, z, tyre, driven }: { x: number; z: number; tyre: VehicleAxleTyre; driven: boolean }) {
  const radiusM = tyre.rollingRadiusM;
  const widthM = tyre.widthMm / 1000;
  const rimRadiusM = Math.min((tyre.rimDiameterIn * 0.0254) / 2, radiusM * 0.92);
  return (
    <group position={[x, radiusM, z]} rotation={[Math.PI / 2, 0, 0]}>
      <mesh>
        <cylinderGeometry args={[radiusM, radiusM, widthM, 32]} />
        <meshStandardMaterial color={VEHICLE_COLORS.tyre} roughness={0.9} metalness={0} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[rimRadiusM, rimRadiusM, widthM + 0.004, 24]} />
        <meshStandardMaterial color={driven ? VEHICLE_COLORS.edge : VEHICLE_COLORS.rim} roughness={0.45} metalness={0.4} />
      </mesh>
    </group>
  );
}

// All four wheels, sized from the vehicle's tyres and placed on its track
// widths at the given axle positions. The driven wheels (per the gearbox's
// drivetrain) get accent-coloured rims.
export default function Wheels({ vehicle, axles }: { vehicle: VehicleState; axles: AxleLayout }) {
  const { frontTrackM, rearTrackM } = vehicle.dimensions;
  const { layout } = vehicle.drivetrain;
  const placements = [
    { x: axles.frontX, trackM: frontTrackM, tyre: vehicle.tyres.front, axle: "front", driven: layout !== "rwd" },
    { x: axles.rearX, trackM: rearTrackM, tyre: vehicle.tyres.rear, axle: "rear", driven: layout !== "fwd" },
  ];
  return (
    <>
      {placements.flatMap(({ x, trackM, tyre, axle, driven }) =>
        [1, -1].map((side) => <Wheel key={`${axle}-${side}`} x={x} z={(side * trackM) / 2} tyre={tyre} driven={driven} />),
      )}
    </>
  );
}
