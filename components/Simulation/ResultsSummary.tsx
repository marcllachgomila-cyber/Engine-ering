"use client";

import { useMemo } from "react";
import { EngineConfig, SimulationResult } from "@/lib/physics/types";
import { buildEngineCurves } from "@/lib/physics/engineModel";
import { getCircuit } from "@/lib/physics/circuits";
import { resultHeadline } from "@/lib/testResultLabel";
import CircuitMap from "./CircuitMap";
import TimeSeriesGraph from "./TimeSeriesGraph";
import CombustionFrictionGraph from "./CombustionFrictionGraph";

interface ResultsSummaryProps {
  engine: EngineConfig;
  result: SimulationResult;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/85 backdrop-blur-md px-5 py-4">
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-mono font-bold text-zinc-50 tabular-nums">
        {value}
      </div>
    </div>
  );
}

function GraphCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/85 backdrop-blur-md px-5 py-4">
      {children}
    </div>
  );
}

export default function ResultsSummary({ engine, result }: ResultsSummaryProps) {
  const headline = resultHeadline(result);

  let subtext = headline.sub;
  if (result.testType === "tenSecond") {
    if (result.initialSpeedKph > 0) {
      subtext = `Started from ${Math.round(result.initialSpeedKph)} kph`;
    } else {
      subtext =
        result.reachedHundredAtS !== null
          ? `0–100 kph in ${result.reachedHundredAtS.toFixed(2)}s`
          : "Didn't reach 100 kph in the run";
    }
  }

  const curves = useMemo(() => buildEngineCurves(engine), [engine]);

  const finalT = result.telemetry[result.telemetry.length - 1]?.t ?? 0;

  const peakBrakeForceN = useMemo(
    () => Math.max(0, ...result.telemetry.map((s) => s.brakeForceN ?? 0)),
    [result.telemetry],
  );
  const peakBrakeTempC = useMemo(
    () => Math.max(0, ...result.telemetry.map((s) => s.brakeTempC ?? 0)),
    [result.telemetry],
  );
  const peakLateralGForce = useMemo(
    () => Math.max(0.1, ...result.telemetry.map((s) => Math.abs(s.lateralGForce ?? 0))),
    [result.telemetry],
  );

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <div className="text-sm uppercase tracking-widest text-amber-400">
          {headline.label}
        </div>
        <div className="text-6xl font-mono font-black text-zinc-50 mt-1">
          {headline.value}
        </div>
        {subtext && (
          <div className="mt-2 text-sm font-mono text-zinc-400">{subtext}</div>
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

      {result.testType === "hotLap" && result.circuitId && (
        <GraphCard>
          <CircuitMap circuit={getCircuit(result.circuitId)} progress={1} label="Completed Lap" />
        </GraphCard>
      )}

      <GraphCard>
        <TimeSeriesGraph
          telemetry={result.telemetry}
          currentT={finalT}
          getValue={(s) => s.rpm}
          peakValue={engine.maxRevRpm}
          color="#f59e0b"
          label="RPM vs Time"
        />
      </GraphCard>
      <GraphCard>
        <TimeSeriesGraph
          telemetry={result.telemetry}
          currentT={finalT}
          getValue={(s) => s.hp}
          peakValue={result.peakHp}
          color="#9085e9"
          label="Power (hp) vs Time"
        />
      </GraphCard>
      <GraphCard>
        <TimeSeriesGraph
          telemetry={result.telemetry}
          currentT={finalT}
          getValue={(s) => s.torqueNm}
          peakValue={result.peakTorqueNm}
          color="#38bdf8"
          label="Engine Torque (Nm) vs Time"
        />
      </GraphCard>
      <GraphCard>
        <CombustionFrictionGraph curves={curves} />
      </GraphCard>

      {result.testType === "hotLap" && (
        <>
          <GraphCard>
            <TimeSeriesGraph
              telemetry={result.telemetry}
              currentT={finalT}
              getValue={(s) => Math.abs(s.lateralGForce ?? 0)}
              peakValue={peakLateralGForce}
              color="#34d399"
              label="Lateral G (cornering load) vs Time"
              formatValue={(v) => v.toFixed(2)}
            />
          </GraphCard>
          <GraphCard>
            <TimeSeriesGraph
              telemetry={result.telemetry}
              currentT={finalT}
              getValue={(s) => (s.tyreUtilization ?? 0) * 100}
              peakValue={100}
              color="#a78bfa"
              label="Tyre Utilisation (% of friction circle) vs Time"
              formatValue={(v) => `${Math.round(v)}%`}
            />
          </GraphCard>
          <GraphCard>
            <TimeSeriesGraph
              telemetry={result.telemetry}
              currentT={finalT}
              getValue={(s) => s.brakeForceN ?? 0}
              peakValue={peakBrakeForceN}
              color="#f87171"
              label="Braking Force (N) vs Time"
            />
          </GraphCard>
          <GraphCard>
            <TimeSeriesGraph
              telemetry={result.telemetry}
              currentT={finalT}
              getValue={(s) => s.brakeTempC ?? 0}
              peakValue={peakBrakeTempC}
              color="#fb923c"
              label="Brake Temp (°C) vs Time"
            />
          </GraphCard>
        </>
      )}
    </div>
  );
}
