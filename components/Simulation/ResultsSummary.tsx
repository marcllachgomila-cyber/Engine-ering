import { EngineConfig, SimulationResult } from "@/lib/physics/types";
import { resultHeadline } from "@/lib/testResultLabel";
import PowerGraph from "./PowerGraph";

interface ResultsSummaryProps {
  engine: EngineConfig;
  result: SimulationResult;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4">
      <div className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-mono font-bold text-slate-50 tabular-nums">
        {value}
      </div>
    </div>
  );
}

export default function ResultsSummary({ engine, result }: ResultsSummaryProps) {
  const headline = resultHeadline(result);

  let subtext = headline.sub;
  if (result.testType === "tenSecond") {
    subtext =
      result.reachedHundredAtS !== null
        ? `0–100 kph in ${result.reachedHundredAtS.toFixed(2)}s`
        : "Didn't reach 100 kph in the run";
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <div className="text-sm uppercase tracking-widest text-amber-400">
          {headline.label}
        </div>
        <div className="text-6xl font-mono font-black text-slate-50 mt-1">
          {headline.value}
        </div>
        {subtext && (
          <div className="mt-2 text-sm font-mono text-slate-400">{subtext}</div>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat
          label="Peak Power"
          value={`${Math.round(result.peakHp)} hp @ ${Math.round(
            result.peakHpRpm,
          ).toLocaleString()} rpm`}
        />
        <Stat
          label="Peak Torque"
          value={`${Math.round(result.peakTorqueNm)} Nm @ ${Math.round(
            result.peakTorqueRpm,
          ).toLocaleString()} rpm`}
        />
        <Stat
          label="Power / Weight"
          value={`${Math.round(result.powerToWeightHpPerTonne)} hp/t`}
        />
        <Stat
          label="Est. Weight"
          value={`${Math.round(result.weightKg).toLocaleString()} kg`}
        />
        <Stat
          label="Theoretical Top Speed"
          value={`${Math.round(result.theoreticalTopSpeedKph)} kph`}
        />
        <Stat
          label="Configuration"
          value={`${engine.cylinders}-cyl ${engine.layout}, ${engine.displacementL.toFixed(1)}L`}
        />
      </div>
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 px-5 py-4">
        <PowerGraph
          telemetry={result.telemetry}
          currentT={result.telemetry[result.telemetry.length - 1]?.t ?? 0}
          peakHp={result.peakHp}
        />
      </div>
    </div>
  );
}
