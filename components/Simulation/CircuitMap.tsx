"use client";

import { useEffect, useRef, useState } from "react";
import { Circuit } from "@/lib/physics/types";

const TRACK_COLOR = "#a1a1aa";
const SURFACE_COLOR = "#14171d";
const DOT_COLOR = "#f59e0b";
// Thin enough that tight real-world sections (parallel straights, hairpins a
// few metres apart - Baku, Jeddah, Marina Bay all have these) read as close
// but separate lines rather than merging into a single blob at this scale.
const TRACK_STROKE_WIDTH = 3;

interface StartFinishMarker {
  x: number;
  y: number;
  // Unit vector perpendicular to the direction of travel at the start/finish
  // point, i.e. which way the flag is nudged off the line.
  nx: number;
  ny: number;
}

// Where the start/finish line sits on a circuit's outline path - always the
// path's own start (length 0), since outlinePath is built directly from the
// source coordinates, whose first point is the start/finish line - plus the
// local perpendicular direction there, derived from the path geometry itself
// rather than any separately-tracked heading.
function useStartFinishMarker(
  pathRef: React.RefObject<SVGPathElement | null>,
  circuit: Circuit,
): StartFinishMarker | null {
  const [marker, setMarker] = useState<StartFinishMarker | null>(null);

  useEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const totalLength = path.getTotalLength();
    const p0 = path.getPointAtLength(0);
    const p1 = path.getPointAtLength(Math.min(totalLength, 1));
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const len = Math.hypot(dx, dy) || 1;
    setMarker({ x: p0.x, y: p0.y, nx: -dy / len, ny: dx / len });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circuit]);

  return marker;
}

// A start/finish gantry - two posts straddling the track with a checkered
// banner strung between them - laid out along the local perpendicular
// (marker.nx/ny) so it reads as crossing the racing line rather than running
// along it, the same way a real gantry spans the track.
const CHECKER_LIGHT = "#e4e4e7";
const CHECKER_DARK = "#18181b";
const POST_COLOR = "#3f3f46";
const POST_RING_COLOR = "#a1a1aa";
const POST_RADIUS = 2;
const GANTRY_SPAN = TRACK_STROKE_WIDTH * 8;
// Explicit fixed squares rather than a tiled <pattern>: at the map's small
// scale a repeating pattern lands on inconsistent, partial squares (the
// banner's own length rarely divides evenly into tile-widths), where fixed
// squares always read as a clean checkerboard regardless of size. Two rows
// of small, near-square cells (rather than one row of wide rectangles) is
// what actually reads as a checkered pattern rather than a striped one.
const BANNER_ROWS = 2;
const BANNER_LENGTH = GANTRY_SPAN - POST_RADIUS * 3;
const BANNER_THICKNESS = TRACK_STROKE_WIDTH + 1.5;
const BANNER_CELL_SIZE = BANNER_THICKNESS / BANNER_ROWS;
const BANNER_COLS = Math.round(BANNER_LENGTH / BANNER_CELL_SIZE);

function StartFinishGantry({ marker }: { marker: StartFinishMarker }) {
  const angleDeg = (Math.atan2(marker.ny, marker.nx) * 180) / Math.PI;
  const cells = [];
  for (let row = 0; row < BANNER_ROWS; row++) {
    for (let col = 0; col < BANNER_COLS; col++) {
      cells.push(
        <rect
          key={`${row}-${col}`}
          x={-BANNER_LENGTH / 2 + col * BANNER_CELL_SIZE}
          y={-BANNER_THICKNESS / 2 + row * BANNER_CELL_SIZE}
          width={BANNER_CELL_SIZE}
          height={BANNER_CELL_SIZE}
          fill={(row + col) % 2 === 0 ? CHECKER_LIGHT : CHECKER_DARK}
        />,
      );
    }
  }
  return (
    <g transform={`translate(${marker.x} ${marker.y}) rotate(${angleDeg})`}>
      {cells}
      <circle cx={-GANTRY_SPAN / 2} cy={0} r={POST_RADIUS} fill={POST_COLOR} stroke={POST_RING_COLOR} strokeWidth={0.6} />
      <circle cx={GANTRY_SPAN / 2} cy={0} r={POST_RADIUS} fill={POST_COLOR} stroke={POST_RING_COLOR} strokeWidth={0.6} />
    </g>
  );
}

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
        strokeWidth={TRACK_STROKE_WIDTH}
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
  const startFinish = useStartFinishMarker(pathRef, circuit);

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
          strokeWidth={TRACK_STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {startFinish && <StartFinishGantry marker={startFinish} />}
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
