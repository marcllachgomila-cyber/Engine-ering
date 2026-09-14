import { buildCircuitGeometry, buildViewBoxAndOutline, computeLengthM } from "./circuitGeometry";
import { Circuit } from "./types";

import albertPark from "./circuitData/albert-park.json";
import shanghai from "./circuitData/shanghai.json";
import suzuka from "./circuitData/suzuka.json";
import bahrain from "./circuitData/bahrain.json";
import jeddah from "./circuitData/jeddah.json";
import miami from "./circuitData/miami.json";
import montreal from "./circuitData/montreal.json";
import monaco from "./circuitData/monaco.json";
import catalunya from "./circuitData/catalunya.json";
import redBullRing from "./circuitData/red-bull-ring.json";
import silverstone from "./circuitData/silverstone.json";
import spa from "./circuitData/spa.json";
import hungaroring from "./circuitData/hungaroring.json";
import zandvoort from "./circuitData/zandvoort.json";
import monza from "./circuitData/monza.json";
import madring from "./circuitData/madring.json";
import baku from "./circuitData/baku.json";
import marinaBay from "./circuitData/marina-bay.json";
import cota from "./circuitData/cota.json";
import mexicoCity from "./circuitData/mexico-city.json";
import interlagos from "./circuitData/interlagos.json";
import lasVegas from "./circuitData/las-vegas.json";
import lusail from "./circuitData/lusail.json";
import yasMarina from "./circuitData/yas-marina.json";

// A single representative track width, used only where a width estimate is
// unavoidable (e.g. a future racing-line optimizer). No per-corner width
// survey data exists for any circuit here, so this is not varied per track.
const TRACK_WIDTH_M = 12;

// Each entry in circuitData/ is real circuit geometry - an ordered, closed
// loop of [longitude, latitude] points downloaded from OpenStreetMap (via
// https://github.com/mvoof/F1TrackDownloader and, where a circuit's
// F1-layout relation wasn't already mapped there, direct Overpass API
// queries against the same "highway=raceway" tagging) - plus the circuit's
// name, country and known corner count. Everything physics-relevant
// (distance, heading, curvature, and the lap length itself) is derived from
// that geometry by circuitGeometry.ts; nothing here hand-assigns a corner
// radius or corner speed.
interface CircuitData {
  id: string;
  name: string;
  country: string;
  corners: number;
  coordinates: number[][];
}

function defineCircuit(data: CircuitData): Circuit {
  const { viewBox, outlinePath } = buildViewBoxAndOutline(data.coordinates);
  return {
    id: data.id,
    name: data.name,
    country: data.country,
    lengthM: computeLengthM(data.coordinates),
    corners: data.corners,
    viewBox,
    outlinePath,
    trackWidthM: TRACK_WIDTH_M,
    points: buildCircuitGeometry(data.coordinates),
  };
}

// The 2026 Formula 1 World Championship calendar.
export const CIRCUITS: Circuit[] = [
  albertPark,
  shanghai,
  suzuka,
  bahrain,
  jeddah,
  miami,
  montreal,
  monaco,
  catalunya,
  redBullRing,
  silverstone,
  spa,
  hungaroring,
  zandvoort,
  monza,
  madring,
  baku,
  marinaBay,
  cota,
  mexicoCity,
  interlagos,
  lasVegas,
  lusail,
  yasMarina,
].map((data) => defineCircuit(data));

export const DEFAULT_CIRCUIT_ID = CIRCUITS[0].id;

export function getCircuit(id: string): Circuit {
  return CIRCUITS.find((c) => c.id === id) ?? CIRCUITS[0];
}
