"use client";

const START_ANGLE = -135;
const END_ANGLE = 135;
const SWEEP = END_ANGLE - START_ANGLE;
const CX = 100;
const CY = 90;
const R = 70;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

interface GaugeProps {
  value: number;
  max: number;
  label: string;
  unit: string;
  redlineFrom?: number;
  accentColor?: string;
}

export function Gauge({
  value,
  max,
  label,
  unit,
  redlineFrom,
  accentColor = "#f59e0b",
}: GaugeProps) {
  const clamped = Math.min(Math.max(value, 0), max);
  const fraction = clamped / max;
  const needleAngle = START_ANGLE + fraction * SWEEP;
  const redlineStartFraction = redlineFrom ? redlineFrom / max : null;
  const tip = polarToCartesian(CX, CY, R - 10, needleAngle);

  return (
    <div className="flex flex-col items-center">
      <svg width={200} height={160} viewBox="0 0 200 160">
        <path
          d={describeArc(CX, CY, R, START_ANGLE, END_ANGLE)}
          fill="none"
          stroke="#1e293b"
          strokeWidth={14}
          strokeLinecap="round"
        />
        {redlineStartFraction !== null && (
          <path
            d={describeArc(
              CX,
              CY,
              R,
              START_ANGLE + redlineStartFraction * SWEEP,
              END_ANGLE,
            )}
            fill="none"
            stroke="#ef4444"
            strokeWidth={14}
            strokeLinecap="round"
            opacity={0.55}
          />
        )}
        <path
          d={describeArc(CX, CY, R, START_ANGLE, needleAngle)}
          fill="none"
          stroke={accentColor}
          strokeWidth={14}
          strokeLinecap="round"
        />
        <line
          x1={CX}
          y1={CY}
          x2={tip.x}
          y2={tip.y}
          stroke="#e2e8f0"
          strokeWidth={3}
          strokeLinecap="round"
        />
        <circle cx={CX} cy={CY} r={6} fill="#e2e8f0" />
      </svg>
      <div className="-mt-6 text-center">
        <div className="text-2xl font-mono font-bold text-slate-50 tabular-nums">
          {Math.round(value).toLocaleString()}
        </div>
        <div className="text-xs uppercase tracking-wider text-slate-400">
          {label} {unit}
        </div>
      </div>
    </div>
  );
}

interface GaugesProps {
  rpm: number;
  redlineRpm: number;
  speedKph: number;
  maxSpeedKph?: number;
}

export default function Gauges({ rpm, redlineRpm, speedKph, maxSpeedKph = 180 }: GaugesProps) {
  return (
    <div className="flex gap-6 sm:gap-10">
      <Gauge
        value={rpm}
        max={redlineRpm}
        redlineFrom={redlineRpm * 0.9}
        label="RPM"
        unit=""
        accentColor="#f59e0b"
      />
      <Gauge value={speedKph} max={maxSpeedKph} label="Speed" unit="kph" accentColor="#38bdf8" />
    </div>
  );
}
