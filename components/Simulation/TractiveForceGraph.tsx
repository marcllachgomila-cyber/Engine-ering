"use client";

import { PointerEvent, useState } from "react";
import { ForcePoint, TractiveForceData } from "@/lib/physics/types";
import { niceMax } from "./TimeSeriesGraph";

const HOVER_LINE_COLOR = "#e2e8f0";

const GEAR_COLORS = [
  "#38bdf8",
  "#34d399",
  "#fbbf24",
  "#a78bfa",
  "#f87171",
  "#f472b6",
  "#fb923c",
  "#94a3b8",
];
const RESISTANCE_COLOR = "#64748b";
const GRID_COLOR = "#2c2f36";
const AXIS_TEXT_COLOR = "#898781";

const WIDTH = 400;
const HEIGHT = 200;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;

interface TractiveForceGraphProps {
  data: TractiveForceData;
}

export default function TractiveForceGraph({ data }: TractiveForceGraphProps) {
  const [hoverSpeedKph, setHoverSpeedKph] = useState<number | null>(null);

  const allPoints = data.gearCurves.flatMap((g) => g.points);
  if (allPoints.length === 0) return null;

  const maxSpeedKph = Math.max(...allPoints.map((p) => p.speedKph));
  const maxForceN = niceMax(Math.max(...allPoints.map((p) => p.forceN)) * 1.05);

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xFor = (speedKph: number) =>
    PAD_LEFT + (Math.min(speedKph, maxSpeedKph) / maxSpeedKph) * plotWidth;
  const yFor = (forceN: number) =>
    PAD_TOP + plotHeight - (Math.max(0, forceN) / maxForceN) * plotHeight;

  const pathFor = (points: ForcePoint[]) =>
    points
      .map(
        (p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.speedKph).toFixed(1)} ${yFor(p.forceN).toFixed(1)}`,
      )
      .join(" ");

  const resistancePath = pathFor(
    data.resistanceCurve.filter((p) => p.speedKph <= maxSpeedKph),
  );

  const baseline = PAD_TOP + plotHeight;
  const gridFractions = [0, 0.5, 1];

  const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const speedKph = Math.min(
      maxSpeedKph,
      Math.max(0, ((svgX - PAD_LEFT) / plotWidth) * maxSpeedKph),
    );
    setHoverSpeedKph(speedKph);
  };

  const handlePointerLeave = () => setHoverSpeedKph(null);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-x-3 gap-y-1">
        <div className="text-xs uppercase tracking-wider text-zinc-500">
          Tractive Force vs Speed (by Gear)
        </div>
        <div className="flex items-center gap-2.5 text-xs font-mono flex-wrap">
          {data.gearCurves.map((g, i) => (
            <span key={g.gear} className="flex items-center gap-1 text-zinc-300">
              <span
                className="inline-block w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: GEAR_COLORS[i % GEAR_COLORS.length] }}
              />
              G{g.gear}
            </span>
          ))}
          <span className="flex items-center gap-1 text-zinc-400">
            <span
              className="inline-block w-2.5 h-0.5"
              style={{ backgroundColor: RESISTANCE_COLOR }}
            />
            Resistance
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
          {Math.round(maxForceN).toLocaleString()}N
        </text>
        <text x={2} y={baseline + 4} fontSize={10} fill={AXIS_TEXT_COLOR}>
          0
        </text>
        <text x={PAD_LEFT} y={HEIGHT - 4} fontSize={10} fill={AXIS_TEXT_COLOR}>
          0 kph
        </text>
        <text
          x={WIDTH - PAD_RIGHT}
          y={HEIGHT - 4}
          fontSize={10}
          fill={AXIS_TEXT_COLOR}
          textAnchor="end"
        >
          {Math.round(maxSpeedKph)} kph
        </text>

        <path
          d={resistancePath}
          fill="none"
          stroke={RESISTANCE_COLOR}
          strokeWidth={1.5}
          strokeDasharray="4 3"
        />

        {data.gearCurves.map((g, i) => (
          <path
            key={g.gear}
            d={pathFor(g.points)}
            fill="none"
            stroke={GEAR_COLORS[i % GEAR_COLORS.length]}
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}

        {hoverSpeedKph !== null && (
          <>
            <line
              x1={xFor(hoverSpeedKph)}
              x2={xFor(hoverSpeedKph)}
              y1={PAD_TOP}
              y2={baseline}
              stroke={HOVER_LINE_COLOR}
              strokeWidth={1}
              strokeDasharray="4 3"
            />
            <text
              x={Math.min(xFor(hoverSpeedKph) + 4, WIDTH - PAD_RIGHT - 46)}
              y={PAD_TOP + 10}
              fontSize={11}
              fontFamily="ui-monospace, monospace"
              fill={HOVER_LINE_COLOR}
            >
              {Math.round(hoverSpeedKph)} kph
            </text>
          </>
        )}
      </svg>
    </div>
  );
}
