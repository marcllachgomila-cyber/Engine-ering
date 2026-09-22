"use client";

import { useMemo, useState } from "react";
import { SavedEngine } from "@/lib/favorites";
import { OptionButton } from "@/components/EngineBuilder/FormControls";
import FavoriteCard from "./FavoriteCard";

type SortKey = "newest" | "finalSpeed" | "peakHp" | "theoreticalTopSpeed" | "peakTorque";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "finalSpeed", label: "Final Speed" },
  { key: "peakHp", label: "Peak Power" },
  { key: "theoreticalTopSpeed", label: "Theoretical Top Speed" },
  { key: "peakTorque", label: "Peak Torque" },
];

function sortFavorites(favorites: SavedEngine[], key: SortKey): SavedEngine[] {
  const copy = [...favorites];
  switch (key) {
    case "finalSpeed":
      return copy.sort((a, b) => b.finalSpeedKph - a.finalSpeedKph);
    case "peakHp":
      return copy.sort((a, b) => b.peakHp - a.peakHp);
    case "theoreticalTopSpeed":
      return copy.sort((a, b) => b.theoreticalTopSpeedKph - a.theoreticalTopSpeedKph);
    case "peakTorque":
      return copy.sort((a, b) => b.peakTorqueNm - a.peakTorqueNm);
    case "newest":
    default:
      return copy.sort((a, b) => b.savedAt - a.savedAt);
  }
}

interface FavoritesListProps {
  favorites: SavedEngine[];
  onRemove: (id: string) => void;
}

export default function FavoritesList({ favorites, onRemove }: FavoritesListProps) {
  const [sortKey, setSortKey] = useState<SortKey>("newest");
  const sorted = useMemo(() => sortFavorites(favorites, sortKey), [favorites, sortKey]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8">
      <div className="flex items-baseline justify-between gap-3 border-b border-zinc-800/70 pb-4">
        <h2 className="text-2xl font-bold text-zinc-50 tracking-tight">Favorite Engines</h2>
        <p className="text-zinc-500 text-sm font-mono shrink-0">{favorites.length} saved</p>
      </div>

      {favorites.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map((opt) => (
            <OptionButton
              key={opt.key}
              active={sortKey === opt.key}
              onClick={() => setSortKey(opt.key)}
              className="font-sans"
            >
              {opt.label}
            </OptionButton>
          ))}
        </div>
      )}

      {favorites.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-900/40 p-10 text-center text-zinc-400">
          No favorites saved yet. Build an engine, run it, and save it from the
          results screen.
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((fav) => (
            <FavoriteCard
              key={fav.id}
              favorite={fav}
              onRemove={() => onRemove(fav.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
