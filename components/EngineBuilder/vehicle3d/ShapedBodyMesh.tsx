"use client";

import { useEffect } from "react";
import { ShapedBody, VEHICLE_COLORS } from "./geometry";

// A shapeWidth() body: the surface plus its precomputed feature lines.
export default function ShapedBodyMesh({ body, children }: { body: ShapedBody; children: React.ReactNode }) {
  // These geometries are rebuilt whenever the dimensions/wheels change (e.g.
  // dragging a wheel-size slider) and R3F doesn't free geometry passed in
  // as a prop, so release each one's GPU buffers once it's replaced.
  useEffect(
    () => () => {
      body.geometry.dispose();
      body.edges.dispose();
    },
    [body],
  );

  return (
    <>
      <mesh geometry={body.geometry}>{children}</mesh>
      <lineSegments geometry={body.edges}>
        <lineBasicMaterial color={VEHICLE_COLORS.edge} />
      </lineSegments>
    </>
  );
}
