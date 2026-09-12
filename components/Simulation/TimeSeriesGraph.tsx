"use client";

import { Telemetry } from "@/lib/physics/types";

const SURFACE_COLOR = "#14171d";
const GRID_COLOR = "#2c2f36";
const AXIS_TEXT_COLOR = "#898781";

const WIDTH = 400;
const HEIGHT = 150;
const PAD_LEFT = 34;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 10;

export function niceMax(value: number): number {
  if (value <= 0) return 100;
  const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
  const normalized = value / magnitude;
  let niceNormalized: number;
  if (normalized <= 1) niceNormalized = 1;
  else if (normalized <= 2) niceNormalized = 2;
  else if (normalized <= 5) niceNormalized = 5;
  else niceNormalized = 10;
  return niceNormalized * magnitude;
}

interface TimeSeriesGraphProps {
  telemetry: Telemetry[];
  currentT: number;
  getValue: (sample: Telemetry) => number;
  peakValue: number;
  color: string;
  label: string;
  formatValue?: (value: number) => string;
}

export default function TimeSeriesGraph({
  telemetry,
  currentT,
  getValue,
  peakValue,
  color,
  label,
  formatValue = (v) => Math.round(v).toString(),
}: TimeSeriesGraphProps) {
  if (telemetry.length === 0) return null;

  const totalDuration = telemetry[telemetry.length - 1].t;
  const maxValue = niceMax(peakValue * 1.08);
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xFor = (t: number) => PAD_LEFT + (t / totalDuration) * plotWidth;
  const yFor = (value: number) =>
    PAD_TOP + plotHeight - (Math.max(0, value) / maxValue) * plotHeight;

  const visible = telemetry.filter((s) => s.t <= currentT);
  const points = visible.length > 0 ? visible : [telemetry[0]];

  const linePath = points
    .map(
      (s, i) =>
        `${i === 0 ? "M" : "L"} ${xFor(s.t).toFixed(1)} ${yFor(getValue(s)).toFixed(1)}`,
    )
    .join(" ");

  const baseline = PAD_TOP + plotHeight;
  const areaPath = `${linePath} L ${xFor(points[points.length - 1].t).toFixed(1)} ${baseline} L ${xFor(points[0].t).toFixed(1)} ${baseline} Z`;

  const last = points[points.length - 1];
  const gridFractions = [0, 0.5, 1];

  return (
    <div className="w-full">
      <div className="text-xs uppercase tracking-wider text-zinc-500 mb-1">
        {label}
      </div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full h-auto"
        preserveAspectRatio="none"
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
          {formatValue(maxValue)}
        </text>
        <text x={2} y={baseline + 4} fontSize={10} fill={AXIS_TEXT_COLOR}>
          0
        </text>

        <path d={areaPath} fill={color} opacity={0.1} />
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <circle cx={xFor(last.t)} cy={yFor(getValue(last))} r={6} fill={SURFACE_COLOR} />
        <circle cx={xFor(last.t)} cy={yFor(getValue(last))} r={4} fill={color} />
        <text
          x={Math.min(xFor(last.t) + 8, WIDTH - PAD_RIGHT - 28)}
          y={Math.max(yFor(getValue(last)) - 8, PAD_TOP + 8)}
          fontSize={12}
          fontFamily="ui-monospace, monospace"
          fill="#e2e8f0"
        >
          {formatValue(getValue(last))}
        </text>
      </svg>
    </div>
  );
}
