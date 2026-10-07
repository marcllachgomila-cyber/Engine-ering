"use client";

import { PointerEvent, useState } from "react";
import { niceMax } from "../Simulation/TimeSeriesGraph";

// A force-vs-speed line chart in the same SVG style as the results
// screen's other graphs: thin lines, recessive grid, a legend for two or
// more series, and a hover crosshair that reads every series out at that
// speed. Handles negative values (aero lift) with a zero line.

export interface ForceSeries {
  label: string;
  color: string;
  dashed?: boolean;
  // Force in newtons at a speed in km/h.
  forceAt: (speedKph: number) => number;
}

const GRID_COLOR = "#2c2f36";
const AXIS_TEXT_COLOR = "#898781";
const HOVER_COLOR = "#e4e1db";
const REFERENCE_COLOR = "#85827a";
const WIDTH = 400;
const HEIGHT = 190;
const PAD_LEFT = 44;
const PAD_RIGHT = 12;
const PAD_TOP = 14;
const PAD_BOTTOM = 22;
const SAMPLES = 60;

const kN = (n: number) => `${(n / 1000).toFixed(n !== 0 && Math.abs(n) < 10000 ? 2 : 1)} kN`;

export default function AeroForceChart({
  title,
  series,
  maxSpeedKph,
  reference,
}: {
  title: string;
  series: ForceSeries[];
  maxSpeedKph: number;
  // A horizontal reference line, e.g. the car's weight.
  reference?: { label: string; forceN: number };
}) {
  const [hoverKph, setHoverKph] = useState<number | null>(null);

  const speeds = Array.from({ length: SAMPLES + 1 }, (_, i) => (maxSpeedKph * i) / SAMPLES);
  const values = series.map((s) => speeds.map((v) => s.forceAt(v)));
  const all = values.flat().concat(reference ? [reference.forceN] : []);
  const maxN = niceMax(Math.max(0, ...all) * 1.05);
  const minRaw = Math.min(0, ...all);
  const minN = minRaw < 0 ? -niceMax(-minRaw * 1.05) : 0;

  const plotW = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xFor = (kph: number) => PAD_LEFT + (kph / maxSpeedKph) * plotW;
  const yFor = (n: number) => PAD_TOP + plotH - ((n - minN) / (maxN - minN)) * plotH;
  const pathFor = (vals: number[]) =>
    vals.map((n, i) => `${i ? "L" : "M"} ${xFor(speeds[i]).toFixed(1)} ${yFor(n).toFixed(1)}`).join(" ");

  const handleMove = (e: PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (rect.width === 0) return;
    const svgX = ((e.clientX - rect.left) / rect.width) * WIDTH;
    setHoverKph(Math.min(maxSpeedKph, Math.max(0, ((svgX - PAD_LEFT) / plotW) * maxSpeedKph)));
  };

  const gridValues = [maxN, minN < 0 ? 0 : maxN / 2, minN].filter((v, i, a) => a.indexOf(v) === i);

  return (
    <div className="w-full">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="text-xs uppercase tracking-wider text-zinc-500">{title}</div>
        {series.length > 1 && (
          <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs text-zinc-300">
            {series.map((s) => (
              <span key={s.label} className="flex items-center gap-1">
                <svg width="14" height="4" aria-hidden>
                  <line
                    x1="0"
                    x2="14"
                    y1="2"
                    y2="2"
                    stroke={s.color}
                    strokeWidth="2"
                    strokeDasharray={s.dashed ? "3 2" : undefined}
                  />
                </svg>
                {s.label}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="h-auto w-full cursor-crosshair touch-none"
          preserveAspectRatio="none"
          onPointerMove={handleMove}
          onPointerDown={handleMove}
          onPointerLeave={() => setHoverKph(null)}
          role="img"
          aria-label={`${title}: ${series.map((s) => `${s.label} ${kN(s.forceAt(maxSpeedKph))} at ${Math.round(maxSpeedKph)} km/h`).join(", ")}`}
        >
          {gridValues.map((v) => (
            <g key={v}>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={yFor(v)}
                y2={yFor(v)}
                stroke={v === 0 && minN < 0 ? REFERENCE_COLOR : GRID_COLOR}
                strokeWidth={1}
              />
              <text x={2} y={yFor(v) + 3} fontSize={10} fill={AXIS_TEXT_COLOR}>
                {kN(v)}
              </text>
            </g>
          ))}
          <text x={PAD_LEFT} y={HEIGHT - 4} fontSize={10} fill={AXIS_TEXT_COLOR}>
            0 km/h
          </text>
          <text x={WIDTH - PAD_RIGHT} y={HEIGHT - 4} fontSize={10} fill={AXIS_TEXT_COLOR} textAnchor="end">
            {Math.round(maxSpeedKph)} km/h
          </text>
          {reference && (
            <g>
              <line
                x1={PAD_LEFT}
                x2={WIDTH - PAD_RIGHT}
                y1={yFor(reference.forceN)}
                y2={yFor(reference.forceN)}
                stroke={REFERENCE_COLOR}
                strokeWidth={1}
                strokeDasharray="2 3"
              />
              <text
                x={PAD_LEFT + 4}
                y={yFor(reference.forceN) - 4}
                fontSize={10}
                fill={AXIS_TEXT_COLOR}
              >
                {reference.label}
              </text>
            </g>
          )}
          {values.map((vals, i) => (
            <path
              key={series[i].label}
              d={pathFor(vals)}
              fill="none"
              stroke={series[i].color}
              strokeWidth={2}
              strokeDasharray={series[i].dashed ? "5 4" : undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {hoverKph !== null && (
            <g>
              <line
                x1={xFor(hoverKph)}
                x2={xFor(hoverKph)}
                y1={PAD_TOP}
                y2={PAD_TOP + plotH}
                stroke={HOVER_COLOR}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              {series.map((s) => (
                <circle
                  key={s.label}
                  cx={xFor(hoverKph)}
                  cy={yFor(s.forceAt(hoverKph))}
                  r={3.5}
                  fill={s.color}
                  stroke="#171614"
                  strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>
        {hoverKph !== null && (
          <div
            className="pointer-events-none absolute top-2 rounded-md border border-zinc-700 bg-zinc-950/90 px-2 py-1 font-mono text-[11px] text-zinc-200"
            style={
              xFor(hoverKph) / WIDTH > 0.55
                ? { right: `${(1 - xFor(hoverKph) / WIDTH) * 100 + 2}%` }
                : { left: `${(xFor(hoverKph) / WIDTH) * 100 + 2}%` }
            }
          >
            <div className="text-zinc-400">{Math.round(hoverKph)} km/h</div>
            {series.map((s) => (
              <div key={s.label} className="flex items-center gap-1.5 tabular-nums">
                <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                {series.length > 1 && <span className="text-zinc-400">{s.label}</span>}
                {kN(s.forceAt(hoverKph))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
