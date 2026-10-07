"use client";

import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { VehicleModelRef } from "@/lib/physics/types";
import { VehicleState } from "@/lib/physics/vehicleState";

// basePath isn't applied to plain asset URLs (see next.config.ts), so the
// GitHub Pages prefix has to be added by hand.
export function vehicleModelUrl(ref: VehicleModelRef): string {
  return `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/models/${ref.file}`;
}

// A preset's own GLB, fitted to the vehicle data: turned nose-forward (+X),
// scaled uniformly so its length matches the preset's body length, centred
// and set down on the ground plane. Suspends while loading - render it
// inside <Suspense> and a FallbackBoundary.
//
// Draco is off: drei would fetch its decoder from Google's CDN at runtime.
// Meshopt's decoder ships with three, so meshopt is the compression to use
// for these files.
export default function DedicatedModel({
  vehicle,
  modelRef,
  onReady,
}: {
  vehicle: VehicleState;
  modelRef: VehicleModelRef;
  onReady: () => void;
}) {
  const gltf = useGLTF(vehicleModelUrl(modelRef), false, true);
  const { lengthM } = vehicle.dimensions;
  const yawRad = THREE.MathUtils.degToRad(modelRef.yawDeg ?? 0);

  const fitted = useMemo(() => {
    // Clone so the cached original stays untouched for the next mount.
    // Nesting: root (scale) > offset (centre on ground) > turned (yaw).
    const turned = new THREE.Group().add(gltf.scene.clone(true));
    turned.rotation.y = yawRad;
    turned.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(turned);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const offset = new THREE.Group().add(turned);
    offset.position.set(-center.x, -box.min.y, -center.z);
    const root = new THREE.Group().add(offset);
    root.scale.setScalar(size.x > 0 ? lengthM / size.x : 1);
    return root;
  }, [gltf, yawRad, lengthM]);

  useEffect(() => {
    onReady();
  }, [fitted, onReady]);

  return <primitive object={fitted} />;
}

