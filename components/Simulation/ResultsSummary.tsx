"use client";

import { useMemo, useState } from "react";
import { EngineConfig, SimulationResult, WeightComponent } from "@/lib/physics/types";
import { engineSizeLabel } from "@/lib/physics/engineLayout";
import { getCircuit } from "@/lib/physics/circuits";
import { resultHeadline } from "@/lib/testResultLabel";
import { CornerMarks, FOCUS_RING, formatUnitValue, Panel, SectionTag } from "@/components/EngineBuilder/FormControls";
import CircuitMap from "./CircuitMap";
import TimeSeriesGraph from "./TimeSeriesGraph";

interface ResultsSummaryProps {
  engine: EngineConfig;
  result: SimulationResult;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Panel>
      <div className="text-xs uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 text-xl font-mono font-bold text-zinc-50 tabular-nums">
        {value}
      </div>
    </Panel>
  );
}

function WeightBreakdownPanel({
  components,
  totalKg,
}: {
  components: WeightComponent[];
  totalKg: number;
}) {
  const sorted = [...components].sort((a, b) => b.kg - a.kg);
  return (
    <Panel>
      <div className="flex items-baseline justify-between text-xs uppercase tracking-wider text-zinc-500">
        <span>Weight Breakdown</span>
        <span className="normal-case tracking-normal">estimated</span>
      </div>
      <ul className="mt-3 space-y-2.5">
        {sorted.map((c) => {
          const pct = totalKg > 0 ? (c.kg / totalKg) * 100 : 0;
          return (
            <li key={c.label}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="text-zinc-300">{c.label}</span>
                <span className="font-mono tabular-nums text-zinc-50">
                  {formatUnitValue(Math.round(c.kg), "kg")}
                  <span className="ml-2 inline-block w-12 text-right text-zinc-500">
                    {pct.toFixed(1)}%
                  </span>
                </span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-zinc-800">
                <div
                  className="h-full rounded-full bg-amber-500/70"
                  style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex justify-between border-t border-zinc-800 pt-2 text-sm">
        <span className="text-zinc-400">Total</span>
        <span className="font-mono font-bold tabular-nums text-zinc-50">
          {formatUnitValue(Math.round(totalKg), "kg")}
        </span>
      </div>
    </Panel>
  );
}

export default function ResultsSummary({ engine, result }: ResultsSummaryProps) {
  const [hoverT, setHoverT] = useState<number | null>(null);
  const [weightOpen, setWeightOpen] = useState(false);
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
  const peakGear = useMemo(
    () => Math.max(1, ...result.telemetry.map((s) => s.gear)),
    [result.telemetry],
  );
  const peakSpeedKph = useMemo(
    () => Math.max(1, ...result.telemetry.map((s) => s.speedKph)),
    [result.telemetry],
  );

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8">
      <div className="relative rounded-2xl border border-zinc-800 bg-zinc-900/85 backdrop-blur-md p-6 sm:p-8 space-y-6">
        <CornerMarks className="border-amber-500/40" />
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
            value={`${formatUnitValue(Math.round(result.peakHp), "hp")} @ ${formatUnitValue(Math.round(result.peakHpRpm), "rpm")}`}
          />
          <Stat
            label="Peak Torque"
            value={`${formatUnitValue(Math.round(result.peakTorqueNm), "Nm")} @ ${formatUnitValue(Math.round(result.peakTorqueRpm), "rpm")}`}
          />
          <Stat
            label="Power / Weight"
            value={formatUnitValue(Math.round(result.powerToWeightHpPerTonne), "hp/t")}
          />
          <button
            type="button"
            onClick={() => setWeightOpen((open) => !open)}
            aria-expanded={weightOpen}
            aria-controls="weight-breakdown"
            className={`text-left rounded-xl ${FOCUS_RING}`}
          >
            <Panel
              className={`h-full transition-colors hover:border-zinc-600 ${weightOpen ? "ring-1 ring-amber-500/50" : ""}`}
            >
              <div className="flex items-center justify-between gap-2 text-xs uppercase tracking-wider text-zinc-500">
                <span>Est. Weight</span>
                <svg
                  aria-hidden
                  viewBox="0 0 12 12"
                  className={`h-3 w-3 shrink-0 transition-transform ${weightOpen ? "rotate-180 text-amber-400" : ""}`}
                >
                  <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                </svg>
              </div>
              <div className="mt-1 text-xl font-mono font-bold text-zinc-50 tabular-nums">
                {formatUnitValue(Math.round(result.weightKg), "kg")}
              </div>
            </Panel>
          </button>
          <Stat
            label="Theoretical Top Speed"
            value={formatUnitValue(Math.round(result.theoreticalTopSpeedKph), "kph")}
          />
          <Stat
            label="Configuration"
            value={`${engineSizeLabel(engine)},${engine.displacementL.toFixed(1)}L`}
          />
        </div>
        {weightOpen && (
          <div id="weight-breakdown">
            <WeightBreakdownPanel components={result.weightBreakdown} totalKg={result.weightKg} />
          </div>
        )}
      </div>

      {result.testType === "hotLap" && result.circuitId && (
        <Panel>
          <CircuitMap circuit={getCircuit(result.circuitId)} progress={1} label="Completed Lap" />
        </Panel>
      )}

      <div>
        <SectionTag>Performance Over Time</SectionTag>
        <div className="mt-3 space-y-3">
          <Panel>
            <TimeSeriesGraph
              telemetry={result.telemetry}
              currentT={finalT}
              getValue={(s) => s.speedKph}
              peakValue={peakSpeedKph}
              color="#22d3ee"
              label="Speed (kph) vs Time"
              hoverT={hoverT}
              onHoverTChange={setHoverT}
            />
          </Panel>
          <Panel>
            <TimeSeriesGraph
              telemetry={result.telemetry}
              currentT={finalT}
              getValue={(s) => s.rpm}
              peakValue={engine.maxRevRpm}
              color="#f59e0b"
              label="RPM vs Time"
              hoverT={hoverT}
              onHoverTChange={setHoverT}
            />
          </Panel>
          <Panel>
            <TimeSeriesGraph
              telemetry={result.telemetry}
              currentT={finalT}
              getValue={(s) => s.hp}
              peakValue={result.peakHp}
              color="#9085e9"
              label="Power (hp) vs Time"
              hoverT={hoverT}
              onHoverTChange={setHoverT}
            />
          </Panel>
          <Panel>
            <TimeSeriesGraph
              telemetry={result.telemetry}
              currentT={finalT}
              getValue={(s) => s.torqueNm}
              peakValue={result.peakTorqueNm}
              color="#38bdf8"
              label="Engine Torque (Nm) vs Time"
              hoverT={hoverT}
              onHoverTChange={setHoverT}
            />
          </Panel>
          {result.testType !== "braking" && (
            <Panel>
              <TimeSeriesGraph
                telemetry={result.telemetry}
                currentT={finalT}
                getValue={(s) => s.wheelSpinPercent ?? 0}
                peakValue={Math.max(20, result.peakWheelSpinPercent)}
                color="#f472b6"
                label={`Wheel Spin (% slip) vs Time, peak ${Math.round(result.peakWheelSpinPercent)}%`}
                formatValue={(v) => `${Math.round(v)}%`}
                hoverT={hoverT}
                onHoverTChange={setHoverT}
              />
            </Panel>
          )}
        </div>
      </div>

      {result.testType === "hotLap" && (
        <div>
          <SectionTag>Hot Lap Telemetry</SectionTag>
          <div className="mt-3 space-y-3">
            <Panel>
              <TimeSeriesGraph
                telemetry={result.telemetry}
                currentT={finalT}
                getValue={(s) => s.gear}
                peakValue={peakGear}
                color="#2dd4bf"
                label="Gear vs Time"
                hoverT={hoverT}
                onHoverTChange={setHoverT}
              />
            </Panel>
            <Panel>
              <TimeSeriesGraph
                telemetry={result.telemetry}
                currentT={finalT}
                getValue={(s) => (s.throttle ?? 0) * 100}
                peakValue={100}
                color="#4ade80"
                label="Throttle (%) vs Time"
                formatValue={(v) => `${Math.round(v)}%`}
                hoverT={hoverT}
                onHoverTChange={setHoverT}
              />
            </Panel>
            <Panel>
              <TimeSeriesGraph
                telemetry={result.telemetry}
                currentT={finalT}
                getValue={(s) => (s.brakeInput ?? 0) * 100}
                peakValue={100}
                color="#ef4444"
                label="Brake (%) vs Time"
                formatValue={(v) => `${Math.round(v)}%`}
                hoverT={hoverT}
                onHoverTChange={setHoverT}
              />
            </Panel>
            <Panel>
              <TimeSeriesGraph
                telemetry={result.telemetry}
                currentT={finalT}
                getValue={(s) => Math.abs(s.lateralGForce ?? 0)}
                peakValue={peakLateralGForce}
                color="#34d399"
                label="Lateral G (cornering load) vs Time"
                formatValue={(v) => v.toFixed(2)}
                hoverT={hoverT}
                onHoverTChange={setHoverT}
              />
            </Panel>
            <Panel>
              <TimeSeriesGraph
                telemetry={result.telemetry}
                currentT={finalT}
                getValue={(s) => (s.tyreUtilization ?? 0) * 100}
                peakValue={100}
                color="#a78bfa"
                label="Tyre Utilisation (% of friction circle) vs Time"
                formatValue={(v) => `${Math.round(v)}%`}
                hoverT={hoverT}
                onHoverTChange={setHoverT}
              />
            </Panel>
            <Panel>
              <TimeSeriesGraph
                telemetry={result.telemetry}
                currentT={finalT}
                getValue={(s) => s.brakeForceN ?? 0}
                peakValue={peakBrakeForceN}
                color="#f87171"
                label="Braking Force (N) vs Time"
                hoverT={hoverT}
                onHoverTChange={setHoverT}
              />
            </Panel>
            <Panel>
              <TimeSeriesGraph
                telemetry={result.telemetry}
                currentT={finalT}
                getValue={(s) => s.brakeTempC ?? 0}
                peakValue={peakBrakeTempC}
                color="#fb923c"
                label="Brake Temp (°C) vs Time"
                hoverT={hoverT}
                onHoverTChange={setHoverT}
              />
            </Panel>
          </div>
        </div>
      )}
    </div>
  );
}
