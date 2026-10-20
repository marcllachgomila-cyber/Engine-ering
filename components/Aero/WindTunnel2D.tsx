"use client";

import { useEffect, useMemo, useRef } from "react";
import { Vec2 } from "@/lib/aero/panelMethod";
import { domainFor, FlowGrid, traceStreamline, velocityAt, wakeOutline } from "@/lib/aero/flowField";
import { CRITICAL_REAR_SLANT_DEG } from "@/lib/aero/bodyOutline";
import { FAST_POLE, SLOW_POLE, SPEED_LEGEND_GRADIENT, speedColorCss } from "@/lib/aero/speedColors";
import { VehicleState } from "@/lib/physics/vehicleState";
import AeroReadout from "./AeroReadout";
import { useFlowGrid } from "./useFlowGrid";

// 2D wind tunnel: a side-on view of the potential-flow field around a body
// (lib/aero), drawn with the plain 2D canvas API rather than WebGL so it
// never competes with the 3D viewer for a GPU context. Colour is local
// speed relative to the freestream (lib/aero/speedColors.ts); the legend
// carries numeric ticks so colour is never the only cue.

const speedColor = speedColorCss;
const LEGEND_GRADIENT = SPEED_LEGEND_GRADIENT;

// The tunnel's visual pacing: particles cross the whole tunnel in about
// this many seconds at freestream speed. (The field is in freestream
// units, so the real speed doesn't change it.)
const CROSSING_TIME_S = 3.5;
const PARTICLE_COUNT = 260;
const STREAMLINE_COUNT = 16;
const RANDOM_RESPAWN_SHARE = 0.25;

// No speed figures are read off the solution for display: on these
// placeholder shapes the peak values are dominated by sharp corners (where
// potential flow is singular), so they'd be artefacts, not results.

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
  for (const polygon of [grid.body.polygon, ...grid.body.extraSolids]) {
    tracePolygon(ctx, polygon, view);
    ctx.fillStyle = "#b8b5ae";
    ctx.fill();
    ctx.strokeStyle = "#f5a000";
    ctx.stroke();
  }

  // Ground plane.
  ctx.strokeStyle = "#6b6860";
  ctx.beginPath();
  ctx.moveTo(0, toY(0) - 0.5);
  ctx.lineTo(widthPx, toY(0) - 0.5);
  ctx.stroke();
}

function tracePolygon(ctx: CanvasRenderingContext2D, polygon: Vec2[], { toX, toY }: View) {
  ctx.beginPath();
  polygon.forEach((p, i) => (i ? ctx.lineTo(toX(p.x), toY(p.y)) : ctx.moveTo(toX(p.x), toY(p.y))));
  ctx.closePath();
}

// A dedicated model's side picture (see VehicleModelRef.sideView), spanning
// the model's length from the ground up to heightV of it.
interface SidePicture {
  image: HTMLImageElement;
  heightV: number;
}

// What sits over the particles: a dedicated model's side picture - drawn on
// top so the car reads as itself, wheels and all, with the flow passing
// behind its off-centre parts - outlined with the centreline section the
// air is actually solved around, and the assumed separation points.
function drawOverlay(
  ctx: CanvasRenderingContext2D,
  grid: FlowGrid,
  view: View,
  widthPx: number,
  picture: SidePicture | null,
) {
  const { toX, toY } = view;
  ctx.clearRect(0, 0, widthPx, view.height);

  if (picture && picture.image.complete && picture.image.naturalWidth) {
    const { lengthM } = grid.body;
    const heightM = picture.heightV * lengthM;
    ctx.drawImage(picture.image, toX(-lengthM / 2), toY(heightM), lengthM * view.scale, heightM * view.scale);
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#f5a000";
    for (const polygon of [grid.body.polygon, ...grid.body.extraSolids]) {
      tracePolygon(ctx, polygon, view);
      ctx.stroke();
    }
  }

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

// showReadout: the force readout under the picture - off where the forces
// are already shown alongside (the results screen).
export default function WindTunnel2D({ vehicle, showReadout = true }: { vehicle: VehicleState; showReadout?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const staticRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);

  const { body, grid } = useFlowGrid(vehicle);
  const domain = useMemo(() => domainFor(body), [body]);
  // basePath isn't applied to plain asset URLs (see next.config.ts).
  const sideView = vehicle.identity.model3d?.sideView;
  const sideImageUrl = sideView ? `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/models/${sideView.image}` : null;
  const sideImageHeightV = sideView?.imageHeightV ?? 0;

  useEffect(() => {
    const container = containerRef.current;
    const staticCanvas = staticRef.current;
    const particleCanvas = particlesRef.current;
    const overlayCanvas = overlayRef.current;
    if (!grid || !container || !staticCanvas || !particleCanvas || !overlayCanvas) return;
    const staticCtx = staticCanvas.getContext("2d");
    const ctx = particleCanvas.getContext("2d");
    const overlayCtx = overlayCanvas.getContext("2d");
    if (!staticCtx || !ctx || !overlayCtx) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let view = makeView(grid, container.clientWidth);
    let widthPx = container.clientWidth;

    // Until (or unless) the picture loads, the static layer's plain section
    // stands in for it.
    let picture: SidePicture | null = null;
    if (sideImageUrl) {
      const image = new Image();
      image.onload = () => drawOverlay(overlayCtx, grid, view, widthPx, picture);
      image.src = sideImageUrl;
      picture = { image, heightV: sideImageHeightV };
    }

    const layout = () => {
      widthPx = container.clientWidth;
      view = makeView(grid, widthPx);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const canvas of [staticCanvas, particleCanvas, overlayCanvas]) {
        canvas.width = Math.round(widthPx * dpr);
        canvas.height = Math.round(view.height * dpr);
        canvas.style.width = `${widthPx}px`;
        canvas.style.height = `${view.height}px`;
      }
      staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      overlayCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawStatic(staticCtx, grid, view, widthPx);
      drawOverlay(overlayCtx, grid, view, widthPx, picture);
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
  }, [grid, sideImageUrl, sideImageHeightV]);

  const bodyName = vehicle.identity.bodyType === "f1" ? "open-wheel" : vehicle.identity.bodyType;
  // A preset whose 3D model carries its own side view is drawn from it.
  const fromModel = !!sideView;
  const slope = body.rearSlope;
  const wakeHeightM = body.separationTop.y - body.separationBottom.y;

  return (
    <div className="absolute inset-0 flex flex-col font-mono text-[10px] text-zinc-500">
      <div className="px-4 pt-3 pb-2 uppercase tracking-wider text-zinc-400">
        {fromModel ? `${vehicle.identity.displayName} model` : `Generic ${bodyName} shape`} ·{" "}
        {body.section === "silhouette" ? "side silhouette" : "centreline section"} · illustrative
      </div>
      {/* The tunnel's height is fixed by the panel width and the domain's
          aspect ratio; it sits centred in whatever height is left. */}
      <div className="flex min-h-0 flex-1 items-center overflow-hidden">
        <div
          ref={containerRef}
          className="relative w-full shrink-0"
          style={{ aspectRatio: `${domain.xMax - domain.xMin} / ${domain.yMax}` }}
        >
          <canvas ref={staticRef} className="absolute inset-0" aria-hidden />
          <canvas
            ref={particlesRef}
            className="absolute inset-0"
            role="img"
            aria-label="Animated airflow around a reference car side profile, coloured by local speed relative to the freestream"
          />
          <canvas ref={overlayRef} className="pointer-events-none absolute inset-0" aria-hidden />
          {!grid && (
            <div className="absolute inset-0 flex items-center justify-center uppercase tracking-wider text-zinc-400">
              Solving flow…
            </div>
          )}
        </div>
      </div>
      <div className="max-h-[58%] shrink-0 space-y-2 overflow-y-auto px-4 pt-2 pb-3">
        {showReadout && <AeroReadout vehicle={vehicle} />}
        <div className={showReadout ? "border-t border-zinc-800 pt-2" : undefined}>
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
        {/* What the model concluded for this shape, and why. */}
        <ul className="space-y-0.5 leading-snug text-zinc-400">
          <li>
            {slope ? (
              <>
                Rear slope {slope.angleDeg.toFixed(0)}° {body.separatesAtRoof ? ">" : "<"} {CRITICAL_REAR_SLANT_DEG}°:{" "}
                {body.separatesAtRoof
                  ? "flow assumed to separate at the roof's trailing edge, so the whole tail sits in the wake"
                  : "flow assumed to stay attached down to the tail"}
              </>
            ) : (
              "No rear slope: flow assumed to leave at the tail's edges"
            )}{" "}
            · wake height {wakeHeightM.toFixed(2)} m
          </li>
        </ul>
        <details className="text-zinc-500">
          <summary className="cursor-pointer text-zinc-400">Model &amp; assumptions · not CFD</summary>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 leading-snug">
            <li>
              2D incompressible potential flow (source-panel method) around{" "}
              {fromModel ? "a cut along the centreline of this car's 3D model" : "the body type's generic shape"}
              , with the road as a mirror-image ground plane. Inviscid: no boundary layer, no drag or lift from this
              solution.{" "}
              {fromModel
                ? "The plan view (flow around the sides, in the 3D overlay) still uses the generic shape."
                : "A preset uses its body type's shape, not the real car's."}
            </li>
            <li>
              {fromModel
                ? "The section (outlined) is whatever the centreline cut passes through - body, cabin, splitter, diffuser and a full-width wing - so air flows under the wing and along the floor. Wheels, mirrors and wing supports sit off-centre: they're in the picture, drawn over the flow, but the air here doesn't go around them."
                : body.section === "silhouette"
                  ? "The section is the side silhouette (body and cabin together); wheels aren't modelled."
                  : "Open-wheel: the section is the centreline (nose, cockpit, engine cover) only - wings, wheels and the floor, where most of an F1 car's downforce comes from, aren't modelled."}
            </li>
            <li>
              Separation follows the slanted-back body result: a rear slope steeper than about{" "}
              {CRITICAL_REAR_SLANT_DEG}° separates at its top edge. In reality this switch is a 3D effect and not
              perfectly sharp. The wake itself is an empirical sketch, not solved; a real wake is unsteady and 3D.
            </li>
            <li>
              2D flow can&rsquo;t go around the car&rsquo;s sides, so speeds over the body are higher than on a real
              car.
            </li>
            <li>
              The forces above don&rsquo;t come from this flow picture: they use the body type&rsquo;s representative
              Cd, Cl and frontal area plus any aero-kit increments (the same values the simulation uses, not
              measured data), still air, and ISA sea-level air (1.225 kg/m³, 15 °C). Coefficients don&rsquo;t vary
              with speed or yaw. The data has no front/rear downforce split, so there&rsquo;s no aero balance.
            </li>
            <li>
              Ride height changes the section drawn here; a wing, splitter or diffuser isn&rsquo;t part of the 2D
              section - their effect shows in the force figures only.
            </li>
          </ul>
        </details>
      </div>
    </div>
  );
}
