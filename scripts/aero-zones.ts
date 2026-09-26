import { findRealCarPreset, gearboxFromPreset } from "../lib/physics/realCars";
import { simulate } from "../lib/physics/simulate";
import { DEFAULT_CHASSIS, DEFAULT_TEST_CONFIG, defaultTyresFor } from "../lib/physics/defaults";
const f1 = findRealCarPreset("f1-2026")!;
const chassis = { ...DEFAULT_CHASSIS, ...f1.chassis, bodyType: f1.category, ...defaultTyresFor(f1.category) };
const lap = simulate(f1.engine, chassis, gearboxFromPreset(f1), { ...DEFAULT_TEST_CONFIG, testType: "hotLap", circuitId: "albert-park" });
const tel = lap.telemetry;
let start = -1;
for (let i = 0; i <= tel.length; i++) {
  const on = i < tel.length && tel[i].aeroMode === "straight";
  if (on && start < 0) start = i;
  if (!on && start >= 0) {
    const seg = tel.slice(start, i);
    const next = tel[i % tel.length];
    console.log(`${seg[0].distanceM.toFixed(0).padStart(5)}-${seg[seg.length - 1].distanceM.toFixed(0).padStart(5)} m  ${(seg[seg.length - 1].t - seg[0].t + 0.001).toFixed(2).padStart(5)} s  ${seg[0].speedKph.toFixed(0)}->${Math.max(...seg.map((s) => s.speedKph)).toFixed(0)} kph  exit: brake ${(next.brakeInput ?? 0).toFixed(2)} thr ${(next.throttle ?? 0).toFixed(2)} R ${(1 / Math.abs(next.curvature ?? 1e-9)).toFixed(0)}m`);
    start = -1;
  }
}
