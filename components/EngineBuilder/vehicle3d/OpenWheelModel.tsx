"use client";

import { useMemo } from "react";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import { openWheelSpineChains, openWheelStations } from "@/lib/physics/bodyShapes";
import { AeroMode } from "@/lib/physics/types";
import { VehicleState } from "@/lib/physics/vehicleState";
import { axleLayout, extrudeAcross, lerpKnots, pointsShape, shapeWidth, VEHICLE_COLORS } from "./geometry";
import ShapedBodyMesh from "./ShapedBodyMesh";
import Wheels from "./Wheels";

// Generic single-seater: nose and tub, sidepods, floor, front and rear
// wings, halo and exposed wheels on wishbones. Positions are laid out
// relative to the axles and the overall height, so the same model scales
// with the vehicle data. It's a schematic of the layout every modern F1 car
// shares, not any team's or season's car.

const SPINE_MAX_WIDTH_M = 0.9;
const SIDEPOD_MAX_WIDTH_M = 1.45;
const TUBE_RADIUS_M = 0.025;

// Wing flap pitch (negative = trailing edge up, the downforce-making attitude
// of an inverted wing). Straight mode lays the flaps nearly flat - the
// low-drag position of the 2026 active aero (see ActiveAeroConfig). These
// angles are illustrative, not regulation figures; only the coefficients
// they stand for feed the simulation. Cars without active aero always show
// corner mode.
// The rear flap also lifts clear of the main plane in straight mode, opening
// the slot between them.
const FLAP_POSE: Record<AeroMode, { frontRad: number; rearRad: number; rearLiftM: number }> = {
  corner: { frontRad: -0.35, rearRad: -0.5, rearLiftM: 0 },
  straight: { frontRad: -0.03, rearRad: 0, rearLiftM: 0.06 },
};

function BodyMaterial() {
  return <meshStandardMaterial color={VEHICLE_COLORS.body} roughness={0.65} metalness={0.05} />;
}

function TrimMaterial() {
  return <meshStandardMaterial color={VEHICLE_COLORS.trim} roughness={0.5} metalness={0.3} />;
}

// A thin plate (wing element, endplate, floor) as an axis-aligned box.
function Plate({ position, size, rotationZ = 0 }: { position: [number, number, number]; size: [number, number, number]; rotationZ?: number }) {
  return (
    <mesh position={position} rotation={[0, 0, rotationZ]}>
      <boxGeometry args={size} />
      <BodyMaterial />
      <Edges threshold={20} color={VEHICLE_COLORS.edge} />
    </mesh>
  );
}

// A round bar between two points (suspension arms).
function Strut({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const { position, quaternion, length } = useMemo(() => {
    const dir = new THREE.Vector3().subVectors(to, from);
    return {
      position: new THREE.Vector3().addVectors(from, to).multiplyScalar(0.5),
      quaternion: new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize()),
      length: dir.length(),
    };
  }, [from, to]);
  return (
    <mesh position={position} quaternion={quaternion}>
      <cylinderGeometry args={[0.012, 0.012, length, 6]} />
      <TrimMaterial />
    </mesh>
  );
}

export default function OpenWheelModel({ vehicle, aeroMode }: { vehicle: VehicleState; aeroMode: AeroMode }) {
  const { lengthM, widthM, heightM, rideHeightM, frontTrackM, rearTrackM } = vehicle.dimensions;
  const axles = axleLayout(vehicle);
  const { frontX, rearX } = axles;
  const frontR = vehicle.tyres.front.rollingRadiusM;
  const rearR = vehicle.tyres.rear.rollingRadiusM;
  const halfL = lengthM / 2;

  // Key stations along the car (shared with the 2D wind tunnel's section).
  const { noseTipX, cockpitFrontX, rollHoopX, sidepodFrontX, sidepodRearX, gearboxEndX } = openWheelStations(
    lengthM,
    axles,
  );

  // Nose, monocoque, airbox and engine cover in one side profile, narrowed
  // in plan from the slim nose to the tub and back down to the gearbox.
  const spineBody = useMemo(() => {
    const { upper, lower } = openWheelSpineChains(lengthM, heightM, { frontX, rearX });
    const shape = pointsShape([...upper, ...[...lower].reverse()]);
    const knots: [number, number][] = [
      [gearboxEndX, 0.3],
      [rearX + 0.6, 0.45],
      [rollHoopX - 0.2, 0.55],
      [rollHoopX + 0.1, 0.85],
      [cockpitFrontX, 0.85],
      [frontX, 0.42],
      [noseTipX, 0.22],
    ];
    return shapeWidth(extrudeAcross(shape, SPINE_MAX_WIDTH_M, 0.03), (x) => lerpKnots(knots, x) / SPINE_MAX_WIDTH_M);
  }, [lengthM, heightM, noseTipX, frontX, cockpitFrontX, rollHoopX, rearX, gearboxEndX]);

  // Sidepods: radiator inlets behind the front wheels, tapering in plan
  // and height toward the rear ("coke bottle").
  const sidepodBody = useMemo(() => {
    const shape = pointsShape([
      [sidepodFrontX, 0.12],
      [sidepodFrontX, 0.5],
      [sidepodFrontX - 0.6, 0.55],
      [sidepodRearX + 0.4, 0.38],
      [sidepodRearX, 0.25],
      [sidepodRearX, 0.12],
    ]);
    const knots: [number, number][] = [
      [sidepodRearX, 0.55],
      [sidepodRearX + 0.6, 0.9],
      [sidepodFrontX - 0.5, SIDEPOD_MAX_WIDTH_M],
      [sidepodFrontX, 1.35],
    ];
    return shapeWidth(
      extrudeAcross(shape, SIDEPOD_MAX_WIDTH_M, 0.04),
      (x) => lerpKnots(knots, x) / SIDEPOD_MAX_WIDTH_M,
    );
  }, [sidepodFrontX, sidepodRearX]);

  const halo = useMemo(() => {
    const attachX = rollHoopX + 0.05;
    const hoop = new THREE.CatmullRomCurve3([
      new THREE.Vector3(attachX, 0.62, 0.27),
      new THREE.Vector3(attachX + 0.25, 0.79, 0.27),
      new THREE.Vector3(cockpitFrontX - 0.22, 0.8, 0.13),
      new THREE.Vector3(cockpitFrontX - 0.13, 0.8, 0),
      new THREE.Vector3(cockpitFrontX - 0.22, 0.8, -0.13),
      new THREE.Vector3(attachX + 0.25, 0.79, -0.27),
      new THREE.Vector3(attachX, 0.62, -0.27),
    ]);
    const pillar = new THREE.CatmullRomCurve3([
      new THREE.Vector3(cockpitFrontX + 0.05, 0.58, 0),
      new THREE.Vector3(cockpitFrontX - 0.06, 0.72, 0),
      new THREE.Vector3(cockpitFrontX - 0.13, 0.8, 0),
    ]);
    return {
      hoop: new THREE.TubeGeometry(hoop, 40, TUBE_RADIUS_M, 8, false),
      pillar: new THREE.TubeGeometry(pillar, 12, TUBE_RADIUS_M, 8, false),
    };
  }, [rollHoopX, cockpitFrontX]);

  // Upper and lower wishbone per corner, body side to wheel hub.
  const struts = useMemo(() => {
    const corners = [
      { x: frontX, track: frontTrackM, r: frontR, bodyHalfWidth: 0.2 },
      { x: rearX, track: rearTrackM, r: rearR, bodyHalfWidth: 0.25 },
    ];
    return corners.flatMap(({ x, track, r, bodyHalfWidth }) =>
      [1, -1].flatMap((side) =>
        [
          [0.3, r + 0.08],
          [0.15, r - 0.08],
        ].map(([bodyY, hubY]) => ({
          from: new THREE.Vector3(x, bodyY, side * bodyHalfWidth),
          to: new THREE.Vector3(x, hubY, (side * track) / 2),
        })),
      ),
    );
  }, [frontX, rearX, frontTrackM, rearTrackM, frontR, rearR]);

  const floorFrontX = frontX - frontR - 0.15;
  const floorRearX = rearX + rearR + 0.1;
  const floorWidth = Math.min(1.4, widthM - 0.2);
  const frontWingX = halfL - 0.22;
  const rearWingX = rearX - 0.55;
  const rearWingSpan = Math.min(1.0, widthM / 2);
  const rearWingY = heightM - 0.2;

  return (
    <group>
      <ShapedBodyMesh body={spineBody}>
        <BodyMaterial />
      </ShapedBodyMesh>
      <ShapedBodyMesh body={sidepodBody}>
        <BodyMaterial />
      </ShapedBodyMesh>
      {/* floor */}
      <Plate
        position={[(floorFrontX + floorRearX) / 2, rideHeightM + 0.02, 0]}
        size={[floorFrontX - floorRearX, 0.04, floorWidth]}
      />
      {/* front wing: main plane, flap, endplates */}
      <Plate position={[frontWingX, 0.08, 0]} size={[0.4, 0.025, widthM]} />
      <Plate position={[frontWingX - 0.1, 0.16, 0]} size={[0.22, 0.02, widthM - 0.3]} rotationZ={FLAP_POSE[aeroMode].frontRad} />
      {[1, -1].map((side) => (
        <Plate key={side} position={[frontWingX, 0.15, side * (widthM / 2 - 0.01)]} size={[0.45, 0.22, 0.015]} />
      ))}
      {/* rear wing: main plane, flap, endplates, pillar */}
      <Plate position={[rearWingX, rearWingY, 0]} size={[0.32, 0.025, rearWingSpan]} rotationZ={-0.1} />
      <Plate
        position={[rearWingX + 0.05, rearWingY + 0.11 + FLAP_POSE[aeroMode].rearLiftM, 0]}
        size={[0.18, 0.02, rearWingSpan]}
        rotationZ={FLAP_POSE[aeroMode].rearRad}
      />
      {[1, -1].map((side) => (
        <Plate key={side} position={[rearWingX, rearWingY, (side * rearWingSpan) / 2]} size={[0.45, 0.38, 0.015]} />
      ))}
      <Plate position={[rearWingX + 0.08, (0.35 + rearWingY) / 2, 0]} size={[0.08, rearWingY - 0.35, 0.03]} />
      {/* halo */}
      <mesh geometry={halo.hoop}>
        <TrimMaterial />
      </mesh>
      <mesh geometry={halo.pillar}>
        <TrimMaterial />
      </mesh>
      {struts.map((s, i) => (
        <Strut key={i} from={s.from} to={s.to} />
      ))}
      <Wheels vehicle={vehicle} axles={axles} />
    </group>
  );
}
