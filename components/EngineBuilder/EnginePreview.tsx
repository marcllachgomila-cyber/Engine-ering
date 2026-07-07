"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
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
      <EngineMesh engine={engine} />
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
