"use client";

import { useEffect, useRef, useState } from "react";
import { densifyPolygon, solvePotentialFlow, Vec2 } from "@/lib/aero/panelMethod";
import { domainFor, FlowGrid, sampleFlow, traceStreamline, velocityAt, wakeOutline } from "@/lib/aero/flowField";
import { BodyOutline, REFERENCE_BODY } from "@/lib/aero/referenceBody";

// 2D wind tunnel: a side-on view of the potential-flow field around a body
// (lib/aero), drawn with the plain 2D canvas API rather than WebGL so it
// never competes with the 3D viewer for a GPU context.
//
// Colour encodes local speed relative to the freestream, on a diverging
// scale around 1.0 (validated against the panel surface with the dataviz
// palette checker): slower flow toward blue, faster toward the brand amber,
// freestream a neutral grey. The legend carries numeric ticks so colour is
// never the only cue.

const SLOW = [0x4c, 0x8d, 0xf6];
const NEUTRAL = [0x85, 0x82, 0x7a];
const FAST = [0xf5, 0xa0, 0x00];
// Speed ratios that map to the two poles.
const SLOW_POLE = 0.4;
const FAST_POLE = 1.6;
const COLOR_STEPS = 64;

function mix(a: number[], b: number[], t: number): string {
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// Precomputed colour lookup over speed ratios SLOW_POLE..FAST_POLE.
const SPEED_COLORS = Array.from({ length: COLOR_STEPS }, (_, i) => {
  const s = SLOW_POLE + ((FAST_POLE - SLOW_POLE) * i) / (COLOR_STEPS - 1);
  return s < 1 ? mix(NEUTRAL, SLOW, (1 - s) / (1 - SLOW_POLE)) : mix(NEUTRAL, FAST, (s - 1) / (FAST_POLE - 1));
});

function speedColor(speed: number): string {
  const t = (speed - SLOW_POLE) / (FAST_POLE - SLOW_POLE);
  return SPEED_COLORS[Math.max(0, Math.min(COLOR_STEPS - 1, Math.round(t * (COLOR_STEPS - 1))))];
}

const rgb = (c: number[]) => `rgb(${c.join(",")})`;
const LEGEND_GRADIENT = `linear-gradient(to right, ${rgb(SLOW)}, ${rgb(NEUTRAL)}, ${rgb(FAST)})`;

// Panel spacing for the solver, and the tunnel's visual pacing: particles
// cross the whole tunnel in about this many seconds at freestream speed.
// (The field is in freestream units, so the real speed doesn't change it.)
const PANEL_SPACING_M = 0.1;
const CROSSING_TIME_S = 3.5;
const PARTICLE_COUNT = 260;
const STREAMLINE_COUNT = 16;
const RANDOM_RESPAWN_SHARE = 0.25;

// The solve is cached per body, so flipping between preview modes doesn't
// redo it.
const fieldCache = new Map<string, FlowGrid>();
// Known without solving, so the panel can reserve the tunnel's space up front.
const TUNNEL_DOMAIN = domainFor(REFERENCE_BODY);

function solveField(body: BodyOutline): FlowGrid {
  const cached = fieldCache.get(body.name);
  if (cached) return cached;
  const flow = solvePotentialFlow(densifyPolygon(body.polygon, PANEL_SPACING_M), { ground: true });
  const grid = sampleFlow(flow, body, domainFor(body));
  fieldCache.set(body.name, grid);
  return grid;
}

interface View {
  scale: number; // px per metre
  height: number; // css px
  toX: (x: number) => number;
  toY: (y: number) => number;
}

function makeView(grid: FlowGrid, widthPx: number): View {
  const scale = widthPx / (grid.xMax - grid.xMin);
  const height = grid.yMax * scale;
  return { scale, height, toX: (x) => (x - grid.xMin) * scale, toY: (y) => height - y * scale };
}

function drawStatic(ctx: CanvasRenderingContext2D, grid: FlowGrid, view: View, widthPx: number) {
  const { toX, toY } = view;
  ctx.clearRect(0, 0, widthPx, view.height);

  // Streamlines, seeded evenly up the inlet.
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.5;
  for (let s = 0; s < STREAMLINE_COUNT; s++) {
    const y0 = grid.yMax * ((s + 0.5) / STREAMLINE_COUNT) * 0.95;
    const line = traceStreamline(grid, grid.xMin, y0, (grid.xMax - grid.xMin) / 400);
    for (let i = 1; i < line.length; i++) {
      ctx.strokeStyle = speedColor(line[i].speed);
      ctx.beginPath();
      ctx.moveTo(toX(line[i - 1].x), toY(line[i - 1].y));
      ctx.lineTo(toX(line[i].x), toY(line[i].y));
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // Wake outline - dashed, because it's a sketch rather than a solution.
  const { upper, lower } = wakeOutline(grid.wake, grid.xMax);
  ctx.setLineDash([3, 3]);
  ctx.strokeStyle = "#9e9b94";
  for (const edge of [upper, lower]) {
    ctx.beginPath();
    edge.forEach((p, i) => (i ? ctx.lineTo(toX(p.x), toY(p.y)) : ctx.moveTo(toX(p.x), toY(p.y))));
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // Body.
  ctx.beginPath();
  grid.body.polygon.forEach((p: Vec2, i) => (i ? ctx.lineTo(toX(p.x), toY(p.y)) : ctx.moveTo(toX(p.x), toY(p.y))));
  ctx.closePath();
  ctx.fillStyle = "#b8b5ae";
  ctx.fill();
  ctx.strokeStyle = "#f5a000";
  ctx.stroke();

  // Ground plane.
  ctx.strokeStyle = "#6b6860";
  ctx.beginPath();
  ctx.moveTo(0, toY(0) - 0.5);
  ctx.lineTo(widthPx, toY(0) - 0.5);
  ctx.stroke();

  // Assumed separation points.
  ctx.fillStyle = "#171614";
  ctx.strokeStyle = "#f5a000";
  ctx.lineWidth = 1.5;
  for (const p of [grid.body.separationTop, grid.body.separationBottom]) {
    ctx.beginPath();
    ctx.arc(toX(p.x), toY(p.y), 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}

export default function WindTunnel2D() {
  const containerRef = useRef<HTMLDivElement>(null);
  const staticRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<HTMLCanvasElement>(null);
  const [grid, setGrid] = useState<FlowGrid | null>(() => fieldCache.get(REFERENCE_BODY.name) ?? null);

  // Solve off the first paint so the panel shows its "solving" state
  // instead of freezing on the click that opened it.
  useEffect(() => {
    if (grid) return;
    const id = setTimeout(() => setGrid(solveField(REFERENCE_BODY)), 30);
    return () => clearTimeout(id);
  }, [grid]);

  useEffect(() => {
    const container = containerRef.current;
    const staticCanvas = staticRef.current;
    const particleCanvas = particlesRef.current;
    if (!grid || !container || !staticCanvas || !particleCanvas) return;
    const staticCtx = staticCanvas.getContext("2d");
    const ctx = particleCanvas.getContext("2d");
    if (!staticCtx || !ctx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let view = makeView(grid, container.clientWidth);
    let widthPx = container.clientWidth;

    const layout = () => {
      widthPx = container.clientWidth;
      view = makeView(grid, widthPx);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const canvas of [staticCanvas, particleCanvas]) {
        canvas.width = Math.round(widthPx * dpr);
        canvas.height = Math.round(view.height * dpr);
        canvas.style.width = `${widthPx}px`;
        canvas.style.height = `${view.height}px`;
      }
      staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawStatic(staticCtx, grid, view, widthPx);
    };
    layout();
    const resizeObserver = new ResizeObserver(layout);
    resizeObserver.observe(container);

    // Particles: positions in metres, respawned at the inlet when they leave
    // the tunnel, hit the body, or stall in the recirculation for too long.
    const span = grid.xMax - grid.xMin;
    const px = new Float32Array(PARTICLE_COUNT);
    const py = new Float32Array(PARTICLE_COUNT);
    const age = new Float32Array(PARTICLE_COUNT);
    const life = new Float32Array(PARTICLE_COUNT);
    const spawn = (i: number, anywhere: boolean) => {
      px[i] = anywhere ? grid.xMin + Math.random() * span : grid.xMin;
      py[i] = Math.random() * grid.yMax;
      age[i] = 0;
      life[i] = CROSSING_TIME_S * (1.2 + Math.random());
    };
    for (let i = 0; i < PARTICLE_COUNT; i++) spawn(i, true);

    let visible = true;
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (visible) schedule();
    });
    intersection.observe(container);

    let frame = 0;
    let last = 0;
    const vel: Vec2 = { x: 0, y: 0 };
    const step = (now: number) => {
      frame = 0;
      const dt = Math.min(1 / 30, last ? (now - last) / 1000 : 1 / 60);
      last = now;
      const metresPerS = span / CROSSING_TIME_S;
      // Fade the previous frame so each particle leaves a short trail.
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0,0,0,0.16)";
      ctx.fillRect(0, 0, widthPx, view.height);
      ctx.globalCompositeOperation = "source-over";
      ctx.lineWidth = 1.5;
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        age[i] += dt;
        if (!velocityAt(grid, px[i], py[i], vel) || age[i] > life[i]) {
          // Mostly from the inlet; some anywhere, so slow regions the inlet
          // flow rarely reaches (the wake) still show particles.
          spawn(i, Math.random() < RANDOM_RESPAWN_SHARE);
          continue;
        }
        const x0 = px[i];
        const y0 = py[i];
        px[i] += vel.x * metresPerS * dt;
        py[i] += vel.y * metresPerS * dt;
        const color = speedColor(Math.hypot(vel.x, vel.y));
        ctx.strokeStyle = color;
        ctx.beginPath();
        ctx.moveTo(view.toX(x0), view.toY(y0));
        ctx.lineTo(view.toX(px[i]), view.toY(py[i]));
        ctx.stroke();
        // A dot at the head too: slow particles (the wake) barely move per
        // frame, so their trail alone would be invisible.
        ctx.fillStyle = color;
        ctx.fillRect(view.toX(px[i]) - 0.75, view.toY(py[i]) - 0.75, 1.5, 1.5);
      }
      schedule();
    };
    const schedule = () => {
      if (!reducedMotion && visible && !frame) {
        frame = requestAnimationFrame(step);
      } else if (!visible) {
        last = 0;
      }
    };
    schedule();

    return () => {
      if (frame) cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      intersection.disconnect();
    };
  }, [grid]);

  return (
    <div className="absolute inset-0 flex flex-col font-mono text-[10px] text-zinc-500">
      <div className="px-4 pt-3 pb-2 uppercase tracking-wider text-zinc-400">
        {REFERENCE_BODY.name} · side section · illustrative
      </div>
      {/* The tunnel's height is fixed by the panel width and the domain's
          aspect ratio; it sits centred in whatever height is left. */}
      <div className="flex min-h-0 flex-1 items-center overflow-hidden">
        <div
          ref={containerRef}
          className="relative w-full shrink-0"
          style={{ aspectRatio: `${TUNNEL_DOMAIN.xMax - TUNNEL_DOMAIN.xMin} / ${TUNNEL_DOMAIN.yMax}` }}
        >
          <canvas ref={staticRef} className="absolute inset-0" aria-hidden />
          <canvas
            ref={particlesRef}
            className="absolute inset-0"
            role="img"
            aria-label="Animated airflow around a reference car side profile, coloured by local speed relative to the freestream"
          />
          {!grid && (
            <div className="absolute inset-0 flex items-center justify-center uppercase tracking-wider text-zinc-400">
              Solving flow…
            </div>
          )}
        </div>
      </div>
      <div className="max-h-[45%] shrink-0 space-y-2 overflow-y-auto px-4 pt-2 pb-3">
        <div>
          <div className="mb-1 text-zinc-400">Local air speed ÷ freestream</div>
          <div className="h-1.5 w-full rounded-full" style={{ background: LEGEND_GRADIENT }} />
          <div className="mt-0.5 flex justify-between">
            <span>≤{SLOW_POLE.toFixed(1)}× slower</span>
            <span>1.0×</span>
            <span>≥{FAST_POLE.toFixed(1)}× faster</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full border border-amber-500 bg-zinc-950" />
            Separation (assumed)
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 border-t border-dashed border-zinc-500" />
            Wake (empirical sketch)
          </span>
        </div>
        <details className="text-zinc-500">
          <summary className="cursor-pointer text-zinc-400">Model &amp; assumptions · not CFD</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 leading-snug">
            <li>
              2D incompressible potential flow (source-panel method) around a fixed reference profile, with the
              road as a mirror-image ground plane. Inviscid: no boundary layer, no drag or lift from this solution.
            </li>
            <li>
              Separation points and the wake are an empirical sketch, not solved. A real wake is unsteady and 3D.
            </li>
            <li>
              2D flow can&rsquo;t go around the car&rsquo;s sides, so roof speeds are higher than on a real car.
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
}
