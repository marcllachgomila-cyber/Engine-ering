import { SavedEngine } from "@/lib/favorites";
import { engineSizeLabel } from "@/lib/physics/engineLayout";
import { resultHeadline, TEST_TYPE_LABELS } from "@/lib/testResultLabel";
import { CornerMarks, FOCUS_RING } from "@/components/EngineBuilder/FormControls";

interface FavoriteCardProps {
  favorite: SavedEngine;
  onRemove: () => void;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-black/30 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="text-sm font-mono font-semibold text-zinc-100">
        {value}
      </div>
    </div>
  );
}

export default function FavoriteCard({ favorite, onRemove }: FavoriteCardProps) {
  const { engine, test } = favorite;
  const headline = resultHeadline({
    testType: test.testType,
    initialSpeedKph: test.initialSpeedKph,
    elapsedS: favorite.elapsedS,
    finalSpeedKph: favorite.finalSpeedKph,
    finalDistanceM: favorite.finalDistanceM,
    timedOut: false,
    circuitId: test.circuitId,
  });

  return (
    <div className="relative rounded-xl border border-zinc-800 bg-zinc-900/85 backdrop-blur-md p-4 transition-colors hover:border-zinc-700">
      <CornerMarks />
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="font-semibold text-zinc-50">
            {engineSizeLabel(engine)},{" "}
            {engine.displacementL.toFixed(1)}L {engine.aspiration}
          </div>
          <div className="text-xs text-zinc-500 mt-0.5">
            Saved {new Date(favorite.savedAt).toLocaleDateString()} &middot;{" "}
            {TEST_TYPE_LABELS[test.testType]}
          </div>
          {favorite.topMatch && (
            <div className="text-sm text-zinc-400 mt-1.5 truncate">
              Closest match: {favorite.topMatch.year} {favorite.topMatch.make}{" "}
              {favorite.topMatch.model}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          className={`rounded text-zinc-500 hover:text-red-400 transition-colors text-sm shrink-0 ${FOCUS_RING}`}
        >
          Remove
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
        <MiniStat label="Peak Power" value={`${Math.round(favorite.peakHp)} hp`} />
        <MiniStat
          label="Peak Torque"
          value={`${Math.round(favorite.peakTorqueNm)} Nm`}
        />
        <MiniStat label={headline.label} value={headline.value} />
        <MiniStat
          label="Theoretical Top"
          value={`${Math.round(favorite.theoreticalTopSpeedKph)} kph`}
        />
      </div>
    </div>
  );
}
