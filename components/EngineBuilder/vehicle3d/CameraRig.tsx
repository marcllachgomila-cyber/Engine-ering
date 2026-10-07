"use client";

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

export type ViewPreset = "iso" | "front" | "side" | "top";

// Camera direction for each preset as spherical angles around the target:
// polar from straight up, azimuth from +Z (the car's left side) toward +X
// (its nose). Iso is a front three-quarter view; front and side sit just
// above the horizon so the ground grid still reads; top stops at the orbit
// controls' minimum polar angle, nose to the right.
const VIEW_ANGLES: Record<ViewPreset, { polar: number; azimuth: number; distanceScale: number }> = {
  iso: { polar: 1.245, azimuth: 0.71, distanceScale: 1 },
  front: { polar: 1.45, azimuth: Math.PI / 2, distanceScale: 0.8 },
  // Side and top views show the full length across the panel's width, so
  // they need to stand further back than the end-on front view.
  side: { polar: 1.45, azimuth: 0, distanceScale: 1.2 },
  top: { polar: 0.15, azimuth: 0, distanceScale: 1.15 },
};

// Far enough back to frame the whole body in the preview panel, which is
// about as tall as it is wide.
export function viewDistance(lengthM: number): number {
  return Math.max(8, lengthM * 2.2);
}

export function viewTarget(heightM: number): THREE.Vector3 {
  return new THREE.Vector3(0, heightM * 0.4, 0);
}

export function viewPosition(view: ViewPreset, lengthM: number, heightM: number): THREE.Vector3 {
  const { polar, azimuth, distanceScale } = VIEW_ANGLES[view];
  const offset = new THREE.Vector3().setFromSphericalCoords(viewDistance(lengthM) * distanceScale, polar, azimuth);
  return viewTarget(heightM).add(offset);
}

// Eases the camera to a preset view whenever `requestId` changes (a view
// button press - pressing the current one again re-centres it) or the car's
// size changes. Body dimensions only change with the body type, so that's
// a different-sized car needing reframing - slider tweaks (weight, wheels)
// never move the camera. With the demand frameloop, frames are only
// requested while the move is in progress; grabbing the controls cancels it.
export default function CameraRig({
  view,
  requestId,
  lengthM,
  heightM,
}: {
  view: ViewPreset;
  requestId: number;
  lengthM: number;
  heightM: number;
}) {
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls) as unknown as {
    target: THREE.Vector3;
    update: () => void;
    addEventListener: (type: string, listener: () => void) => void;
    removeEventListener: (type: string, listener: () => void) => void;
  } | null;
  const invalidate = useThree((s) => s.invalidate);
  const goal = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);

  useEffect(() => {
    goal.current = {
      position: viewPosition(view, lengthM, heightM),
      target: viewTarget(heightM),
    };
    invalidate();
  }, [view, requestId, lengthM, heightM, invalidate]);

  useEffect(() => {
    if (!controls) return;
    const cancel = () => {
      goal.current = null;
    };
    controls.addEventListener("start", cancel);
    return () => controls.removeEventListener("start", cancel);
  }, [controls]);

  useFrame((_, delta) => {
    if (!goal.current || !controls) return;
    const t = 1 - Math.exp(-delta * 9);
    camera.position.lerp(goal.current.position, t);
    controls.target.lerp(goal.current.target, t);
    controls.update();
    if (
      camera.position.distanceTo(goal.current.position) < 1e-3 &&
      controls.target.distanceTo(goal.current.target) < 1e-3
    ) {
      goal.current = null;
    } else {
      invalidate();
    }
  });

  return null;
}
