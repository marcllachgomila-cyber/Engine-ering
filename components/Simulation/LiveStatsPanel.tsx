import { Telemetry } from "@/lib/physics/types";
import { formatLapTime } from "@/lib/testResultLabel";

interface LiveStatsPanelProps {
  telemetry: Telemetry | null;
  useLapTimeFormat?: boolean;
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
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/85 backdrop-blur-md px-4 py-3">
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-mono font-semibold text-zinc-50 tabular-nums">
        {value}
        {unit && <span className="ml-1 text-sm text-zinc-400">{unit}</span>}
      </div>
    </div>
  );
}

export default function LiveStatsPanel({ telemetry, useLapTimeFormat }: LiveStatsPanelProps) {
  const isBraking = telemetry?.brakeTempC !== undefined;
  return (
    <div className="grid grid-cols-3 gap-3 w-full">
      {useLapTimeFormat ? (
        <StatTile label="Elapsed" value={formatLapTime(telemetry?.t ?? 0)} />
      ) : (
        <StatTile label="Elapsed" value={(telemetry?.t ?? 0).toFixed(2)} unit="s" />
      )}
      <StatTile label="Gear" value={`${telemetry?.gear ?? 1}`} />
      {isBraking ? (
        <StatTile
          label="Brake Temp"
          value={Math.round(telemetry?.brakeTempC ?? 0).toString()}
          unit="°C"
        />
      ) : (
        <StatTile
          label="Power"
          value={Math.round(telemetry?.hp ?? 0).toString()}
          unit="hp"
        />
      )}
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
