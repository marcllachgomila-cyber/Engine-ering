"use client";

import { useMemo, useState } from "react";
import { SavedEngine } from "@/lib/favorites";
import FavoriteCard from "./FavoriteCard";

type SortKey = "newest" | "topSpeed" | "peakHp" | "theoreticalTopSpeed" | "peakTorque";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "newest", label: "Newest" },
  { key: "topSpeed", label: "Top Speed" },
  { key: "peakHp", label: "Peak Power" },
  { key: "theoreticalTopSpeed", label: "Theoretical Top Speed" },
  { key: "peakTorque", label: "Peak Torque" },
];

function sortFavorites(favorites: SavedEngine[], key: SortKey): SavedEngine[] {
  const copy = [...favorites];
  switch (key) {
    case "topSpeed":
      return copy.sort((a, b) => b.topSpeedKph - a.topSpeedKph);
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
    <div className="w-full max-w-3xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-50">Favorite Engines</h2>
        <p className="text-slate-400 mt-1 text-sm">{favorites.length} saved</p>
      </div>

      {favorites.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.key}
              type="button"
              onClick={() => setSortKey(opt.key)}
              className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                sortKey === opt.key
                  ? "bg-amber-500 border-amber-500 text-slate-950 font-semibold"
                  : "border-slate-700 text-slate-300 hover:border-slate-500"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {favorites.length === 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-8 text-center text-slate-400">
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
