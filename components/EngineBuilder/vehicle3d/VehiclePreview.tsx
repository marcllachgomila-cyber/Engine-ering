"use client";

import { Suspense, useCallback, useState, useSyncExternalStore } from "react";
import { Canvas } from "@react-three/fiber";
import { ContactShadows, Grid, OrbitControls } from "@react-three/drei";
import { AeroMode, BodyType } from "@/lib/physics/types";
import { VehicleState } from "@/lib/physics/vehicleState";
import CameraRig, { viewDistance, viewPosition, viewTarget, ViewPreset } from "./CameraRig";
import { MINIVAN_SPEC, SUPERCAR_SPEC, SUV_SPEC } from "@/lib/physics/bodyShapes";
import ClosedBodyModel from "./ClosedBodyModel";
import DedicatedModel, { vehicleModelUrl } from "./DedicatedModel";
import DimensionOverlay from "./DimensionOverlay";
import FallbackBoundary from "./FallbackBoundary";
import OpenWheelModel from "./OpenWheelModel";
import { OptionButton } from "../FormControls";

interface ModelProps {
  vehicle: VehicleState;
  aeroMode: AeroMode;
}

// Which generic model represents each body type. Two reusable base models
// cover all of them: closed bodywork driven by a per-type shape spec, and
// the open-wheel single-seater. Typed as a Record so adding a body type
// fails to compile until it's given a representation here.
const BODY_TYPE_MODELS: Record<BodyType, (props: ModelProps) => React.ReactNode> = {
  minivan: ({ vehicle }) => <ClosedBodyModel vehicle={vehicle} spec={MINIVAN_SPEC} />,
  suv: ({ vehicle }) => <ClosedBodyModel vehicle={vehicle} spec={SUV_SPEC} />,
  supercar: ({ vehicle }) => <ClosedBodyModel vehicle={vehicle} spec={SUPERCAR_SPEC} />,
  f1: ({ vehicle, aeroMode }) => <OpenWheelModel vehicle={vehicle} aeroMode={aeroMode} />,
};

const VIEW_LABELS: Record<ViewPreset, string> = {
  iso: "Iso",
  front: "Front",
  side: "Side",
  top: "Top",
};

const TOOL_BUTTON = "px-1.5! py-0.5! text-[10px]! uppercase tracking-wider w-12 text-center";

// Whether this browser can create a WebGL context at all. R3F creates its
// renderer asynchronously, so a failure there never reaches an error
// boundary - checking up front is the only way to show a message instead
// of a blank panel. Checked once; the server render assumes support (the
// app is a static export) and the client corrects it after hydration.
let webglSupportCache: boolean | undefined;
function webglSupported(): boolean {
  if (webglSupportCache === undefined) {
    try {
      const canvas = document.createElement("canvas");
      webglSupportCache = !!(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webglSupportCache = false;
    }
  }
  return webglSupportCache;
}
const subscribeNever = () => () => {};

function ViewerMessage({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-8 text-center font-mono text-xs text-zinc-500">
      <div className="uppercase tracking-wider text-zinc-400">{title}</div>
      <div>{detail}</div>
    </div>
  );
}

export default function VehiclePreview({ vehicle }: { vehicle: VehicleState }) {
  const { lengthM, widthM, heightM, wheelbaseM } = vehicle.dimensions;
  const Model = BODY_TYPE_MODELS[vehicle.identity.bodyType];

  // Camera presets. Bumping requestId re-applies a view even if it's the
  // one already selected, which doubles as "reset view".
  const [view, setView] = useState<{ preset: ViewPreset; requestId: number }>({ preset: "iso", requestId: 0 });
  const [showDimensions, setShowDimensions] = useState(false);
  const [glReady, setGlReady] = useState(false);
  const [renderFailed, setRenderFailed] = useState(false);
  const hasWebgl = useSyncExternalStore(subscribeNever, webglSupported, () => true);

  // Active aero (F1 2026) is the one configuration whose shape the car
  // itself changes. The viewer can show either mode; cars without it are
  // always in corner mode, whatever was last picked.
  const [selectedAeroMode, setSelectedAeroMode] = useState<AeroMode>("corner");
  const activeAero = vehicle.aero.activeAero;
  const aeroMode: AeroMode = activeAero ? selectedAeroMode : "corner";
  const cd = aeroMode === "straight" && activeAero ? activeAero.dragCoefficientStraight : vehicle.aero.dragCoefficient;
  const cl = aeroMode === "straight" && activeAero ? activeAero.liftCoefficientStraight : vehicle.aero.liftCoefficient;

  // A preset with its own model loads it on demand; the generic model
  // stands in while it loads and if it fails. Status is keyed by URL so
  // switching presets starts each one back at "loading".
  const modelRef = vehicle.identity.model3d;
  const modelUrl = modelRef ? vehicleModelUrl(modelRef) : null;
  const [modelLoad, setModelLoad] = useState<{ url: string; status: "ready" | "error" } | null>(null);
  const modelStatus = !modelUrl ? null : modelLoad?.url === modelUrl ? modelLoad.status : "loading";
  const handleModelReady = useCallback(() => {
    if (modelUrl) setModelLoad({ url: modelUrl, status: "ready" });
  }, [modelUrl]);
  const handleModelError = useCallback(
    (error: unknown) => {
      console.error(`Vehicle model ${modelUrl} failed to load, showing the generic model instead.`, error);
      if (modelUrl) setModelLoad({ url: modelUrl, status: "error" });
    },
    [modelUrl],
  );
  const showingDedicated = modelStatus === "ready";
  const genericModel = <Model vehicle={vehicle} aeroMode={aeroMode} />;
  const bodyName = vehicle.identity.bodyType === "f1" ? "open-wheel" : vehicle.identity.bodyType;

  // The contact shadow is rendered once (frames={1}) rather than every
  // frame, so orbiting costs nothing extra; this key re-renders it whenever
  // anything that changes the car's footprint does.
  const { front, rear } = vehicle.tyres;
  const shadowKey = [
    vehicle.identity.bodyType,
    lengthM,
    widthM,
    front.rollingRadiusM,
    front.widthMm,
    rear.rollingRadiusM,
    rear.widthMm,
    modelUrl,
    modelStatus,
    aeroMode,
  ].join("|");

  const initialPosition = viewPosition("iso", lengthM, heightM);
  const initialTarget = viewTarget(heightM);

  const unavailable = (
    <ViewerMessage
      title="3D view unavailable"
      detail="This browser couldn't start WebGL. The configurator works without it."
    />
  );

  return (
    <div className="absolute inset-0">
      {!hasWebgl ? (
        unavailable
      ) : (
        <FallbackBoundary
          fallback={unavailable}
          onError={(error) => {
            console.error("Vehicle viewer failed to render.", error);
            setRenderFailed(true);
          }}
        >
          <Canvas
            // Static scene: only re-render when the camera moves or props change,
            // instead of burning a frame loop while the user fills in the form.
            frameloop="demand"
            dpr={[1, 2]}
            camera={{ position: initialPosition.toArray(), fov: 32 }}
            gl={{ alpha: true, antialias: true }}
            onCreated={() => setGlReady(true)}
            aria-label={`3D view of the ${vehicle.identity.displayName}`}
          >
            {/* Neutral studio lighting: sky/ground fill, a key light from the
                front quarter, a dimmer fill opposite, and a rim light from
                behind to separate the silhouette from the dark panel. */}
            <hemisphereLight args={["#f2f0ea", "#252421", 1.1]} />
            <directionalLight position={[5, 8, 4]} intensity={1.5} />
            <directionalLight position={[-6, 3, -4]} intensity={0.5} />
            <directionalLight position={[-4, 5, 6]} intensity={0.35} />
            {modelRef && modelUrl ? (
              <FallbackBoundary key={modelUrl} fallback={genericModel} onError={handleModelError}>
                <Suspense fallback={genericModel}>
                  <DedicatedModel vehicle={vehicle} modelRef={modelRef} onReady={handleModelReady} />
                </Suspense>
              </FallbackBoundary>
            ) : (
              genericModel
            )}
            {showDimensions && <DimensionOverlay vehicle={vehicle} />}
            <ContactShadows
              key={shadowKey}
              frames={1}
              position={[0, 0.002, 0]}
              scale={Math.max(lengthM, widthM) * 1.6}
              resolution={512}
              blur={2.2}
              far={heightM + 0.2}
              opacity={0.6}
            />
            <Grid
              infiniteGrid
              cellSize={0.25}
              cellThickness={0.6}
              cellColor="#5a5750"
              sectionSize={1}
              sectionThickness={1}
              sectionColor="#85827a"
              fadeDistance={20}
              fadeStrength={1.5}
            />
            <OrbitControls
              makeDefault
              target={initialTarget}
              enablePan={false}
              enableDamping
              minDistance={Math.max(2.5, lengthM * 0.6)}
              maxDistance={viewDistance(lengthM) * 1.8}
              minPolarAngle={0.15}
              // Stop just above the ground plane so the camera never dips under it.
              maxPolarAngle={Math.PI / 2 - 0.04}
            />
            <CameraRig view={view.preset} requestId={view.requestId} lengthM={lengthM} heightM={heightM} />
          </Canvas>
        </FallbackBoundary>
      )}

      {hasWebgl && !glReady && !renderFailed && <ViewerMessage title="Initialising 3D view…" detail="" />}

      {hasWebgl && !renderFailed && (
        <div className="absolute left-3 top-3 flex flex-col gap-1" role="toolbar" aria-label="Viewer controls">
          {(Object.keys(VIEW_LABELS) as ViewPreset[]).map((preset) => (
            <OptionButton
              key={preset}
              active={view.preset === preset}
              onClick={() => setView((v) => ({ preset, requestId: v.requestId + 1 }))}
              className={TOOL_BUTTON}
            >
              {VIEW_LABELS[preset]}
            </OptionButton>
          ))}
          <div className="my-0.5 border-t border-zinc-800" />
          <OptionButton active={showDimensions} onClick={() => setShowDimensions((s) => !s)} className={TOOL_BUTTON}>
            Dims
          </OptionButton>
        </div>
      )}

      {activeAero && (
        <div className="absolute right-3 top-3 flex flex-col items-end gap-1.5 font-mono text-[10px] text-zinc-400">
          <div className="uppercase tracking-wider">Active aero</div>
          <div className="flex gap-1" role="group" aria-label="Active aero mode">
            {(["corner", "straight"] as const).map((mode) => (
              <OptionButton
                key={mode}
                active={aeroMode === mode}
                onClick={() => setSelectedAeroMode(mode)}
                className="px-2! py-0.5! text-xs! capitalize"
              >
                {mode}
              </OptionButton>
            ))}
          </div>
          <div className="text-zinc-500">
            Cd {cd.toFixed(2)} · Cl {cl.toFixed(2)} · A {vehicle.aero.frontalAreaM2.toFixed(2)} m²
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute left-4 bottom-3 right-4 font-mono text-[10px] leading-relaxed text-zinc-500">
        <div className="uppercase tracking-wider text-zinc-400">
          {showingDedicated
            ? "Dedicated model · scaled to body length"
            : `Generic ${bodyName} model · placeholder geometry`}
        </div>
        {modelStatus === "loading" && <div className="text-amber-400">Loading {vehicle.identity.displayName} model…</div>}
        {modelStatus === "error" && <div className="text-amber-400">Model failed to load · showing generic model</div>}
        <div>
          L {lengthM.toFixed(2)} m · W {widthM.toFixed(2)} m · H {heightM.toFixed(2)} m · WB {wheelbaseM.toFixed(2)} m
        </div>
        {showingDedicated && modelRef ? (
          <div className="truncate">
            {modelRef.credit.title} by {modelRef.credit.author} ·{" "}
            <a
              href={modelRef.credit.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="pointer-events-auto underline decoration-zinc-600 hover:text-zinc-300"
            >
              {modelRef.credit.license}
            </a>
          </div>
        ) : (
          // The driven-wheel highlight is drawn on the generic models' rims.
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
            Driven wheels · {vehicle.drivetrain.layout.toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}
