"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { isRotary } from "@/lib/physics/engineLayout";
import { EngineConfig, EngineLayout } from "@/lib/physics/types";

interface Bank {
  angleDeg: number;
  count: number;
}

function splitEvenly(total: number, banks: number): number[] {
  const base = Math.floor(total / banks);
  const remainder = total - base * banks;
  return Array.from({ length: banks }, (_, i) => base + (i < remainder ? 1 : 0));
}

// Bank angle is measured from the +Y (up) axis, rotating toward +Z.
function computeBanks(cylinders: number, layout: EngineLayout): Bank[] {
  switch (layout) {
    case "inline":
      return [{ angleDeg: 0, count: cylinders }];
    case "flat": {
      const [a, b] = splitEvenly(cylinders, 2);
      return [
        { angleDeg: -90, count: a },
        { angleDeg: 90, count: b },
      ];
    }
    case "v": {
      const [a, b] = splitEvenly(cylinders, 2);
      return [
        { angleDeg: -32, count: a },
        { angleDeg: 32, count: b },
      ];
    }
    case "w": {
      const [a, b, c, d] = splitEvenly(cylinders, 4);
      return [
        { angleDeg: -55, count: a },
        { angleDeg: -20, count: b },
        { angleDeg: 20, count: c },
        { angleDeg: 55, count: d },
      ];
    }
    case "rotary":
      // No cylinder banks - rotaries are drawn by RotaryMesh instead.
      return [];
  }
}

const CYL_SPACING = 0.5;
const CYL_RADIUS = 0.2;
const CYL_HEIGHT = 0.85;
const BLOCK_HALF_HEIGHT = 0.45;

function EngineMesh({ engine }: { engine: EngineConfig }) {
  const flywheelRef = useRef<THREE.Mesh>(null);

  const banks = useMemo(
    () => computeBanks(engine.cylinders, engine.layout),
    [engine.cylinders, engine.layout],
  );
  const maxCount = Math.max(...banks.map((b) => b.count));
  const blockLength = maxCount * CYL_SPACING + 0.7;
  // Normalizes overall model size so it stays well within the camera's
  // frame at every orbit angle, regardless of cylinder count/layout.
  const scale = Math.min(1.05, Math.max(0.4, 2.5 / blockLength));

  useFrame((_, delta) => {
    const rotationsPerSecond = 0.25 + engine.redlineRpm / 9000;
    if (flywheelRef.current) {
      flywheelRef.current.rotation.z += delta * rotationsPerSecond * Math.PI * 2;
    }
  });

  return (
    <group scale={scale}>
      {/* engine block */}
      <mesh castShadow receiveShadow>
        <boxGeometry args={[blockLength, BLOCK_HALF_HEIGHT * 2, 0.95]} />
        <meshStandardMaterial color="#82868f" metalness={0.25} roughness={0.55} />
      </mesh>

      {/* cylinder banks */}
      {banks.map((bank, bankIndex) => {
        const angleRad = (bank.angleDeg * Math.PI) / 180;
        const dirY = Math.cos(angleRad);
        const dirZ = Math.sin(angleRad);
        const startX = -((bank.count - 1) * CYL_SPACING) / 2;
        return (
          <group key={bankIndex}>
            {Array.from({ length: bank.count }, (_, i) => {
              const x = startX + i * CYL_SPACING;
              const midDist = BLOCK_HALF_HEIGHT + CYL_HEIGHT / 2;
              const y = dirY * midDist;
              const z = dirZ * midDist;
              const capDist = BLOCK_HALF_HEIGHT + CYL_HEIGHT + 0.05;
              return (
                <group key={i} position={[x, y, z]} rotation={[angleRad, 0, 0]}>
                  <mesh castShadow>
                    <cylinderGeometry args={[CYL_RADIUS, CYL_RADIUS, CYL_HEIGHT, 20]} />
                    <meshStandardMaterial color="#71767f" metalness={0.3} roughness={0.5} />
                  </mesh>
                  <mesh position={[0, capDist - midDist, 0]}>
                    <cylinderGeometry
                      args={[CYL_RADIUS * 1.08, CYL_RADIUS * 1.08, 0.08, 20]}
                    />
                    <meshStandardMaterial color="#f59e0b" metalness={0.3} roughness={0.45} />
                  </mesh>
                </group>
              );
            })}
          </group>
        );
      })}

      {/* flywheel */}
      <mesh ref={flywheelRef} position={[-blockLength / 2 - 0.12, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.12, 32]} />
        <meshStandardMaterial color="#54585f" metalness={0.35} roughness={0.45} />
      </mesh>
      <mesh position={[-blockLength / 2 - 0.19, 0.32, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.06, 0.16, 0.02]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.3} roughness={0.45} />
      </mesh>

      {/* turbo/supercharger accessory */}
      {engine.aspiration !== "na" && (
        <mesh position={[blockLength / 2 + 0.28, -0.15, 0.3]} castShadow>
          <sphereGeometry args={[0.24, 16, 16]} />
          <meshStandardMaterial color="#d4d7dc" metalness={0.4} roughness={0.35} />
        </mesh>
      )}
    </group>
  );
}

// Wankel geometry: rotor apex radius R and eccentricity E (the eccentric
// shaft's throw). Real engines run R/E around 7; 6.4 here just makes the
// orbit easier to see at preview size.
const ROTOR_R = 0.7;
const ROTOR_E = 0.11;
const ROTOR_DEPTH = 0.26;
const HOUSING_DEPTH = 0.32;
const ROTOR_SPACING = 0.4;
const HOUSING_SEGMENTS = 96;

// The bore traced by the rotor's apexes: x = E·cos3θ + R·cosθ,
// y = E·sin3θ + R·sinθ.
function epitrochoidPoints(): THREE.Vector2[] {
  return Array.from({ length: HOUSING_SEGMENTS }, (_, i) => {
    const t = (i / HOUSING_SEGMENTS) * Math.PI * 2;
    return new THREE.Vector2(
      ROTOR_E * Math.cos(3 * t) + ROTOR_R * Math.cos(t),
      ROTOR_E * Math.sin(3 * t) + ROTOR_R * Math.sin(t),
    );
  });
}

function buildHousingGeometry(): THREE.ExtrudeGeometry {
  const outer = new THREE.Shape();
  outer.absellipse(0, 0, ROTOR_R + ROTOR_E + 0.2, ROTOR_R - ROTOR_E + 0.3, 0, Math.PI * 2);
  outer.holes.push(new THREE.Path(epitrochoidPoints()));
  const geometry = new THREE.ExtrudeGeometry(outer, { depth: HOUSING_DEPTH, bevelEnabled: false });
  geometry.translate(0, 0, -HOUSING_DEPTH / 2);
  return geometry;
}

// Three apexes joined by gently bulging flanks - close enough to a real
// rotor's profile to read correctly while staying clear of the bore.
function buildRotorGeometry(): THREE.ExtrudeGeometry {
  const apex = (i: number) => {
    const a = (i * 2 * Math.PI) / 3;
    return new THREE.Vector2(ROTOR_R * Math.cos(a), ROTOR_R * Math.sin(a));
  };
  const shape = new THREE.Shape();
  const first = apex(0);
  shape.moveTo(first.x, first.y);
  for (let i = 0; i < 3; i++) {
    const next = apex(i + 1);
    const mid = ((2 * i + 1) * Math.PI) / 3;
    shape.quadraticCurveTo(
      ROTOR_R * 0.72 * Math.cos(mid),
      ROTOR_R * 0.72 * Math.sin(mid),
      next.x,
      next.y,
    );
  }
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: ROTOR_DEPTH, bevelEnabled: false });
  geometry.translate(0, 0, -ROTOR_DEPTH / 2);
  return geometry;
}

function RotaryMesh({ engine }: { engine: EngineConfig }) {
  const rotors = engine.cylinders;
  const flywheelRef = useRef<THREE.Mesh>(null);
  const rotorRefs = useRef<(THREE.Mesh | null)[]>([]);
  const shaftAngle = useRef(0);

  const housingGeometry = useMemo(() => buildHousingGeometry(), []);
  const rotorGeometry = useMemo(() => buildRotorGeometry(), []);

  const stackLength = rotors * ROTOR_SPACING + 0.7;
  const scale = Math.min(1.05, Math.max(0.4, 2.5 / stackLength));
  const startX = -((rotors - 1) * ROTOR_SPACING) / 2;

  useFrame((_, delta) => {
    // Rotaries rev higher, so the shared piston formula would spin them
    // faster than is readable - slowed a little so the rotor motion stays
    // easy to follow.
    const rotationsPerSecond = 0.2 + engine.redlineRpm / 12000;
    shaftAngle.current += delta * rotationsPerSecond * Math.PI * 2;
    if (flywheelRef.current) flywheelRef.current.rotation.z = shaftAngle.current;
    rotorRefs.current.forEach((rotor, i) => {
      if (!rotor) return;
      // Rotors are phased evenly around the shaft (180° apart on a
      // 2-rotor) so their power strokes are evenly spaced.
      const alpha = shaftAngle.current + (i * 2 * Math.PI) / rotors;
      rotor.position.set(ROTOR_E * Math.cos(alpha), ROTOR_E * Math.sin(alpha), 0);
      rotor.rotation.z = alpha / 3;
    });
  });

  return (
    <group scale={scale}>
      {/* rotor stack - each housing/rotor pair lies in the local XY plane,
          turned so the eccentric shaft runs along world X like the piston
          engine's crank */}
      {Array.from({ length: rotors }, (_, i) => (
        <group key={i} position={[startX + i * ROTOR_SPACING, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <mesh geometry={housingGeometry}>
            <meshStandardMaterial
              color="#82868f"
              metalness={0.25}
              roughness={0.55}
              transparent
              opacity={0.35}
              depthWrite={false}
            />
          </mesh>
          <mesh
            ref={(el) => {
              rotorRefs.current[i] = el;
            }}
            geometry={rotorGeometry}
            castShadow
          >
            <meshStandardMaterial color="#f59e0b" metalness={0.3} roughness={0.45} />
          </mesh>
        </group>
      ))}

      {/* eccentric shaft */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.08, 0.08, stackLength + 0.2, 16]} />
        <meshStandardMaterial color="#54585f" metalness={0.4} roughness={0.4} />
      </mesh>

      {/* flywheel */}
      <mesh ref={flywheelRef} position={[-stackLength / 2 - 0.12, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 0.12, 32]} />
        <meshStandardMaterial color="#54585f" metalness={0.35} roughness={0.45} />
      </mesh>

      {/* turbo/supercharger accessory */}
      {engine.aspiration !== "na" && (
        <mesh position={[stackLength / 2 + 0.28, -0.15, 0.3]} castShadow>
          <sphereGeometry args={[0.24, 16, 16]} />
          <meshStandardMaterial color="#d4d7dc" metalness={0.4} roughness={0.35} />
        </mesh>
      )}
    </group>
  );
}

export default function EnginePreview({ engine }: { engine: EngineConfig }) {
  return (
    <Canvas
      shadows
      camera={{ position: [4.8, 3.1, 4.8], fov: 34 }}
      gl={{ alpha: true }}
    >
      <ambientLight intensity={0.9} />
      <directionalLight position={[4, 6, 4]} intensity={1.8} castShadow />
      <directionalLight position={[-3, 2, -3]} intensity={0.6} />
      <pointLight position={[0, 2.5, 1]} color="#f59e0b" intensity={1.0} />
      {isRotary(engine) ? <RotaryMesh engine={engine} /> : <EngineMesh engine={engine} />}
      <OrbitControls
        enablePan={false}
        enableZoom={false}
        autoRotate
        autoRotateSpeed={2.4}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 1.7}
      />
    </Canvas>
  );
}
