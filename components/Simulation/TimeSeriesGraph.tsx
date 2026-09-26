"use client";

import { PointerEvent, useState } from "react";
import { Telemetry } from "@/lib/physics/types";

const SURFACE_COLOR = "#14171d";
const GRID_COLOR = "#2c2f36";
const AXIS_TEXT_COLOR = "#898781";
const HOVER_LINE_COLOR = "#e2e8f0";
const SHADE_COLOR = "#34d399";

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
  /** Most negative value to make room for (e.g. motor power while harvesting). Omit for a zero-based axis. */
  troughValue?: number;
  color: string;
  label: string;
  formatValue?: (value: number) => string;
  /** Shades the background wherever this is true (e.g. active aero in straight mode), labelled in a legend. */
  shadeWhen?: (sample: Telemetry) => boolean;
  shadeLabel?: string;
  /** Controlled hover position (seconds), shared across multiple graphs. Omit for standalone use. */
  hoverT?: number | null;
  onHoverTChange?: (t: number | null) => void;
}

export default function TimeSeriesGraph({
  telemetry,
  currentT,
  getValue,
  peakValue,
  troughValue = 0,
  color,
  label,
  formatValue = (v) => Math.round(v).toString(),
  shadeWhen,
  shadeLabel,
  hoverT: controlledHoverT,
  onHoverTChange,
}: TimeSeriesGraphProps) {
  const [internalHoverT, setInternalHoverT] = useState<number | null>(null);
  const hoverT = controlledHoverT !== undefined ? controlledHoverT : internalHoverT;
  const setHoverT = onHoverTChange ?? setInternalHoverT;

  if (telemetry.length === 0) return null;

  const totalDuration = telemetry[telemetry.length - 1].t;
  const maxValue = niceMax(peakValue * 1.08);
  const minValue = troughValue < 0 ? -niceMax(-troughValue * 1.08) : 0;
  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const xFor = (t: number) => PAD_LEFT + (t / totalDuration) * plotWidth;
  const yFor = (value: number) =>
    PAD_TOP + plotHeight - ((Math.max(minValue, value) - minValue) / (maxValue - minValue)) * plotHeight;

  const handlePointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const t = Math.min(totalDuration, Math.max(0, ((svgX - PAD_LEFT) / plotWidth) * totalDuration));
    setHoverT(t);
  };

  const handlePointerLeave = () => setHoverT(null);

  const visible = telemetry.filter((s) => s.t <= currentT);
  const points = visible.length > 0 ? visible : [telemetry[0]];

  const linePath = points
    .map(
      (s, i) =>
        `${i === 0 ? "M" : "L"} ${xFor(s.t).toFixed(1)} ${yFor(getValue(s)).toFixed(1)}`,
    )
    .join(" ");

  const baseline = PAD_TOP + plotHeight;
  const zeroY = yFor(0);
  const areaPath = `${linePath} L ${xFor(points[points.length - 1].t).toFixed(1)} ${zeroY} L ${xFor(points[0].t).toFixed(1)} ${zeroY} Z`;

  const last = points[points.length - 1];
  const gridFractions = [0, 0.5, 1];

  // Each sample covers the time since the one before it; merge consecutive
  // shaded samples into [start, end] bands.
  const shadeBands: [number, number][] = [];
  if (shadeWhen) {
    points.forEach((s, i) => {
      if (!shadeWhen(s)) return;
      const start = i > 0 ? points[i - 1].t : 0;
      const band = shadeBands[shadeBands.length - 1];
      if (band && band[1] === start) band[1] = s.t;
      else shadeBands.push([start, s.t]);
    });
  }
  const showShadeLegend = !!shadeWhen && !!shadeLabel && telemetry.some(shadeWhen);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wider text-zinc-500 mb-1">
        <span>{label}</span>
        {showShadeLegend && (
          <span className="flex items-center gap-1.5 normal-case tracking-normal">
            <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: SHADE_COLOR, opacity: 0.35 }} />
            {shadeLabel}
          </span>
        )}
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
        {shadeBands.map(([start, end]) => (
          <rect
            key={start}
            x={xFor(start)}
            y={PAD_TOP}
            width={Math.max(0.5, xFor(end) - xFor(start))}
            height={plotHeight}
            fill={SHADE_COLOR}
            opacity={0.14}
          />
        ))}
        <text x={2} y={PAD_TOP + 8} fontSize={10} fill={AXIS_TEXT_COLOR}>
          {formatValue(maxValue)}
        </text>
        <text x={2} y={baseline + 4} fontSize={10} fill={AXIS_TEXT_COLOR}>
          {minValue < 0 ? formatValue(minValue) : 0}
        </text>
        {minValue < 0 && (
          <>
            <line x1={PAD_LEFT} x2={WIDTH - PAD_RIGHT} y1={zeroY} y2={zeroY} stroke={AXIS_TEXT_COLOR} strokeWidth={1} />
            <text x={2} y={zeroY + 4} fontSize={10} fill={AXIS_TEXT_COLOR}>
              0
            </text>
          </>
        )}

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

        {hoverT !== null && (() => {
          const hoverSample = telemetry.reduce((closest, s) =>
            Math.abs(s.t - hoverT) < Math.abs(closest.t - hoverT) ? s : closest,
          );
          const hoverValue = getValue(hoverSample);
          return (
            <>
              <line
                x1={xFor(hoverT)}
                x2={xFor(hoverT)}
                y1={PAD_TOP}
                y2={baseline}
                stroke={HOVER_LINE_COLOR}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <circle cx={xFor(hoverSample.t)} cy={yFor(hoverValue)} r={3.5} fill={HOVER_LINE_COLOR} />
              <text
                x={Math.min(xFor(hoverT) + 4, WIDTH - PAD_RIGHT - 34)}
                y={PAD_TOP + 10}
                fontSize={11}
                fontFamily="ui-monospace, monospace"
                fill={HOVER_LINE_COLOR}
              >
                {hoverT.toFixed(2)}s · {formatValue(hoverValue)}
              </text>
            </>
          );
        })()}
      </svg>
    </div>
  );
}
