"use client";

import { useEffect, useRef, useState } from "react";
import { Circuit } from "@/lib/physics/types";

const TRACK_COLOR = "#3f3f46";
const SURFACE_COLOR = "#14171d";
const DOT_COLOR = "#f59e0b";

export function CircuitOutlineIcon({
  circuit,
  className,
}: {
  circuit: Circuit;
  className?: string;
}) {
  return (
    <svg viewBox={circuit.viewBox} className={className}>
      <path
        d={circuit.outlinePath}
        fill="none"
        stroke={TRACK_COLOR}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

interface CircuitMapProps {
  circuit: Circuit;
  progress: number;
  label?: string;
}

export default function CircuitMap({ circuit, progress, label }: CircuitMapProps) {
  const pathRef = useRef<SVGPathElement>(null);
  const [dot, setDot] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const totalLength = path.getTotalLength();
    const clamped = Math.min(1, Math.max(0, progress));
    const point = path.getPointAtLength(clamped * totalLength);
    setDot({ x: point.x, y: point.y });
  }, [circuit, progress]);

  return (
    <div className="w-full">
      <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
        {label ?? circuit.name}
      </div>
      <svg viewBox={circuit.viewBox} className="w-full h-auto">
        <path
          ref={pathRef}
          d={circuit.outlinePath}
          fill="none"
          stroke={TRACK_COLOR}
          strokeWidth={8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {dot && (
          <>
            <circle cx={dot.x} cy={dot.y} r={8} fill={SURFACE_COLOR} />
            <circle cx={dot.x} cy={dot.y} r={5.5} fill={DOT_COLOR} />
          </>
        )}
      </svg>
    </div>
  );
}
