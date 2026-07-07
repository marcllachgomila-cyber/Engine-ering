import { Telemetry } from "@/lib/physics/types";

interface LiveStatsPanelProps {
  telemetry: Telemetry | null;
}

function StatTile({
  label,
  value,
  unit,
}: {
  label: string;
  value: string;
  unit?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-mono font-semibold text-slate-50 tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm text-slate-400">{unit}</span>}
      </div>
    </div>
  );
}

export default function LiveStatsPanel({ telemetry }: LiveStatsPanelProps) {
  return (
    <div className="grid grid-cols-3 gap-3 w-full">
      <StatTile label="Elapsed" value={(telemetry?.t ?? 0).toFixed(2)} unit="s" />
      <StatTile label="Gear" value={`${telemetry?.gear ?? 1}`} />
      <StatTile
        label="Power"
        value={Math.round(telemetry?.hp ?? 0).toString()}
        unit="hp"
      />
      <StatTile
        label="Torque"
        value={Math.round(telemetry?.torqueNm ?? 0).toString()}
        unit="Nm"
      />
      <StatTile
        label="G-Force"
        value={(telemetry?.gForce ?? 0).toFixed(2)}
        unit="g"
      />
      <StatTile
        label="Distance"
        value={Math.round(telemetry?.distanceM ?? 0).toString()}
        unit="m"
      />
    </div>
  );
}
