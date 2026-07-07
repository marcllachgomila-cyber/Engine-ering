import { CarSpec, EngineConfig, SimulationResult } from "./physics/types";

export interface SavedEngine {
  id: string;
  savedAt: number;
  engine: EngineConfig;
  peakHp: number;
  peakHpRpm: number;
  peakTorqueNm: number;
  peakTorqueRpm: number;
  weightKg: number;
  powerToWeightHpPerTonne: number;
  topSpeedKph: number;
  theoreticalTopSpeedKph: number;
  reachedHundredAtS: number | null;
  topMatch: { make: string; model: string; year: number } | null;
}

const STORAGE_KEY = "engine-builder.favorites.v1";

type Listener = () => void;
const listeners = new Set<Listener>();
const EMPTY_FAVORITES: SavedEngine[] = [];
let cachedRaw: string | null | undefined;
let cachedSnapshot: SavedEngine[] = EMPTY_FAVORITES;

function readFromStorage(): SavedEngine[] {
  if (typeof window === "undefined") return EMPTY_FAVORITES;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY_FAVORITES;
  }
  if (raw === cachedRaw) return cachedSnapshot;
  cachedRaw = raw;
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    cachedSnapshot = Array.isArray(parsed) ? (parsed as SavedEngine[]) : [];
  } catch {
    cachedSnapshot = [];
  }
  return cachedSnapshot;
}

function persist(favorites: SavedEngine[]): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(favorites);
  window.localStorage.setItem(STORAGE_KEY, raw);
  cachedRaw = raw;
  cachedSnapshot = favorites;
  listeners.forEach((listener) => listener());
}

export function subscribeFavorites(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getFavoritesSnapshot(): SavedEngine[] {
  return readFromStorage();
}

export function getFavoritesServerSnapshot(): SavedEngine[] {
  return EMPTY_FAVORITES;
}

export function addFavorite(
  engine: EngineConfig,
  result: SimulationResult,
  topMatchCar: CarSpec | null,
): void {
  const entry: SavedEngine = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    savedAt: Date.now(),
    engine,
    peakHp: result.peakHp,
    peakHpRpm: result.peakHpRpm,
    peakTorqueNm: result.peakTorqueNm,
    peakTorqueRpm: result.peakTorqueRpm,
    weightKg: result.weightKg,
    powerToWeightHpPerTonne: result.powerToWeightHpPerTonne,
    topSpeedKph: result.topSpeedKph,
    theoreticalTopSpeedKph: result.theoreticalTopSpeedKph,
    reachedHundredAtS: result.reachedHundredAtS,
    topMatch: topMatchCar
      ? { make: topMatchCar.make, model: topMatchCar.model, year: topMatchCar.year }
      : null,
  };
  persist([entry, ...readFromStorage()]);
}

export function removeFavorite(id: string): void {
  persist(readFromStorage().filter((f) => f.id !== id));
}
