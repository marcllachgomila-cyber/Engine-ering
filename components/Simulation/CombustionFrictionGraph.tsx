"use client";

import { PointerEvent, useState } from "react";
import { EngineCurves } from "@/lib/physics/types";
import { niceMax } from "./TimeSeriesGraph";

const COMBUSTION_COLOR = "#f59e0b";
const FRICTION_COLOR = "#ef4444";
const GRID_COLOR = "#2c2f36";
const AXIS_TEXT_COLOR = "#898781";
const HOVER_LINE_COLOR = "#e2e8f0";

const WIDTH = 400;
const HEIGHT = 170;
const PAD_LEFT = 40;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const STEPS = 60;

interface CombustionFrictionGraphProps {
  curves: EngineCurves;
}

export default function CombustionFrictionGraph({ curves }: CombustionFrictionGraphProps) {
  const [hoverRpm, setHoverRpm] = useState<number | null>(null);

  const points = Array.from({ length: STEPS + 1 }, (_, i) => {
    const rpm = curves.idleRpm + ((curves.maxRevRpm - curves.idleRpm) * i) / STEPS;
    return {
      rpm,
      combustion: curves.combustionTorqueAt(rpm),
      friction: curves.frictionTorqueAt(rpm),
    };
  });

  const maxValue = niceMax(Math.max(...points.map((p) => p.combustion)) * 1.08);
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xFor = (rpm: number) =>
    PAD_LEFT +
    ((rpm - curves.idleRpm) / (curves.maxRevRpm - curves.idleRpm)) * plotWidth;
  const yFor = (value: number) =>
    PAD_TOP + plotHeight - (Math.max(0, value) / maxValue) * plotHeight;

  const pathFor = (key: "combustion" | "friction") =>
    points
      .map(
        (p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.rpm).toFixed(1)} ${yFor(p[key]).toFixed(1)}`,
      )
      .join(" ");

  const baseline = PAD_TOP + plotHeight;
  const gridFractions = [0, 0.5, 1];

  const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const rpm = Math.min(
      curves.maxRevRpm,
      Math.max(curves.idleRpm, curves.idleRpm + ((svgX - PAD_LEFT) / plotWidth) * (curves.maxRevRpm - curves.idleRpm)),
    );
    setHoverRpm(rpm);
  };

  const handlePointerLeave = () => setHoverRpm(null);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Combustion vs Friction Torque
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-zinc-300">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: COMBUSTION_COLOR }}
            />
            Combustion
          </span>
          <span className="flex items-center gap-1.5 text-zinc-300">
            <span
              className="inline-block w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: FRICTION_COLOR }}
            />
            Friction
          </span>
        </div>
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto cursor-crosshair"
        preserveAspectRatio="none"
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
      >
        {gridFractions.map((g) => {
          const y = PAD_TOP + plotHeight - g * plotHeight;
          return (
            <line
              key={g}
              x1={PAD_LEFT}
              x2={WIDTH - PAD_RIGHT}
              y1={y}
              y2={y}
              stroke={GRID_COLOR}
              strokeWidth={1}
            />
          );
        })}
        <text x={2} y={PAD_TOP + 8} fontSize={10} fill={AXIS_TEXT_COLOR}>
          {Math.round(maxValue)}
        </text>
        <text x={2} y={baseline + 4} fontSize={10} fill={AXIS_TEXT_COLOR}>
          0
        </text>
        <text x={PAD_LEFT} y={HEIGHT - 4} fontSize={10} fill={AXIS_TEXT_COLOR}>
          {Math.round(curves.idleRpm).toLocaleString()} rpm
        </text>
        <text
          x={WIDTH - PAD_RIGHT}
          y={HEIGHT - 4}
          fontSize={10}
          fill={AXIS_TEXT_COLOR}
          textAnchor="end"
        >
          {Math.round(curves.maxRevRpm).toLocaleString()} rpm
        </text>

        <path
          d={pathFor("combustion")}
          fill="none"
          stroke={COMBUSTION_COLOR}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={pathFor("friction")}
          fill="none"
          stroke={FRICTION_COLOR}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {hoverRpm !== null && (
          <>
            <line
              x1={xFor(hoverRpm)}
              x2={xFor(hoverRpm)}
              y1={PAD_TOP}
              y2={baseline}
              stroke={HOVER_LINE_COLOR}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text
              x={Math.min(xFor(hoverRpm) + 4, WIDTH - PAD_RIGHT - 60)}
              y={PAD_TOP + 10}
              fontSize={11}
              fontFamily="ui-monospace, monospace"
              fill={HOVER_LINE_COLOR}
            >
              {Math.round(hoverRpm).toLocaleString()} rpm
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
