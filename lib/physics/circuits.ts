import { Circuit, CircuitCornerClass, CircuitSegment } from "./types";

// Fixed radius/arc-length per corner "class" - a simplified stand-in for
// each track's real corner-by-corner geometry, in the same spirit as the
// rest of the app's idealized grip/braking tables. hairpin/tight are slow,
// technical corners; fast/veryFast are the high-commitment sweepers.
const CORNER_RADIUS_M: Record<CircuitCornerClass, number> = {
  hairpin: 12,
  tight: 25,
  medium: 55,
  fast: 110,
  veryFast: 200,
};

const CORNER_LENGTH_M: Record<CircuitCornerClass, number> = {
  hairpin: 25,
  tight: 40,
  medium: 70,
  fast: 110,
  veryFast: 160,
};

// Lays one corner segment down per entry in `corners` (in lap order), with a
// straight before each corner sized proportionally from `straightWeights`
// (equal by default) so every segment's length sums to `lengthM`. Distance 0
// sits at the start of the first straight, i.e. right after exiting the
// final corner in the list - a flying lap is already rolling at that corner's
// exit speed.
export function buildLap(
  lengthM: number,
  corners: CircuitCornerClass[],
  straightWeights: number[] = corners.map(() => 1),
): CircuitSegment[] {
  const cornerSegments = corners.map((c) => ({
    type: "corner" as const,
    lengthM: CORNER_LENGTH_M[c],
    radiusM: CORNER_RADIUS_M[c],
  }));
  const cornerTotalM = cornerSegments.reduce((sum, c) => sum + c.lengthM, 0);
  const straightTotalM = Math.max(0, lengthM - cornerTotalM);
  const weightSum = straightWeights.reduce((a, b) => a + b, 0);

  const segments: CircuitSegment[] = [];
  corners.forEach((_, i) => {
    const straightLengthM =
      weightSum > 0 ? (straightTotalM * straightWeights[i]) / weightSum : 0;
    if (straightLengthM > 0.5) {
      segments.push({ type: "straight", lengthM: straightLengthM });
    }
    segments.push(cornerSegments[i]);
  });
  return segments;
}

// Joins a circuit's waypoints with straight edges rather than a smoothing
// spline. Real track-map diagrams (and this app's own corner model) are
// built from distinct straights meeting at distinct corners, not a uniform
// curve - drawing it that way, with the stroke's rounded line joins doing
// the visual softening at each vertex, is what actually makes an outline
// read as a track instead of a blob. Each circuit's waypoints below trace
// its real corner sequence (hairpins, chicanes, esses, spirals) as closely
// as this stylized scale allows.
function linePath(points: [number, number][]): string {
  const [x0, y0] = points[0];
  const rest = points.slice(1).map(([x, y]) => `L ${x} ${y}`);
  return [`M ${x0} ${y0}`, ...rest, "Z"].join(" ");
}

const VIEW_BOX = "0 0 300 180";

export const CIRCUITS: Circuit[] = [
  {
    id: "albert-park",
    name: "Albert Park Circuit",
    country: "Australia",
    lengthM: 5278,
    corners: 0,
    viewBox: VIEW_BOX,
    // Lakeside loop: flat southern edge along the lake, a kink at turns 6-7,
    // long back straight up the eastern side.
    outlinePath: linePath([
      [45, 60], [42, 110], [70, 145], [125, 158], [185, 155], [235, 140],
      [215, 115], [255, 95], [272, 55], [248, 25], [195, 18], [140, 22],
      [90, 30], [55, 42],
    ]),
    segments: [],
  },
  {
    id: "shanghai",
    name: "Shanghai International Circuit",
    country: "China",
    lengthM: 5451,
    corners: 0,
    viewBox: VIEW_BOX,
    // The signature decreasing-radius turn 1-2-3 spiral, then a long back
    // straight and hairpin before the return leg.
    outlinePath: linePath([
      [40, 140], [25, 100], [45, 72], [68, 78], [60, 98], [95, 72],
      [150, 35], [200, 28], [240, 42], [265, 70], [272, 105],
      [245, 138], [195, 150], [145, 152], [95, 148], [60, 145],
    ]),
    segments: [],
  },
  {
    id: "suzuka",
    name: "Suzuka Circuit",
    country: "Japan",
    lengthM: 5807,
    corners: 0,
    viewBox: VIEW_BOX,
    // The real figure-eight: esses into the Degner curves and hairpin on
    // one lobe, crossing over itself into the Spoon/130R/chicane lobe.
    outlinePath: linePath([
      [150, 120], [110, 100], [80, 70], [50, 80], [40, 115], [55, 140],
      [90, 150], [130, 130], [150, 100], [190, 80], [230, 90], [265, 75],
      [270, 110], [240, 135], [195, 130], [165, 115],
    ]),
    segments: [],
  },
  {
    id: "bahrain",
    name: "Bahrain International Circuit",
    country: "Bahrain",
    lengthM: 5412,
    corners: 0,
    viewBox: VIEW_BOX,
    outlinePath: linePath([
      [50, 50], [110, 30], [170, 25], [220, 40], [255, 70], [240, 100],
      [195, 90], [175, 115], [205, 140], [190, 160], [130, 162], [75, 150],
      [45, 110], [40, 80],
    ]),
    segments: [],
  },
  {
    id: "jeddah",
    name: "Jeddah Corniche Circuit",
    country: "Saudi Arabia",
    lengthM: 6174,
    corners: 0,
    viewBox: VIEW_BOX,
    // Long, narrow, wall-hugging coastal ribbon of fast kinks.
    outlinePath: linePath([
      [25, 95], [55, 75], [80, 95], [105, 78], [130, 92], [155, 75],
      [180, 92], [205, 75], [230, 90], [255, 78], [275, 95], [260, 125],
      [225, 135], [195, 120], [165, 132], [135, 118], [105, 132], [75, 120],
      [45, 128],
    ]),
    segments: [],
  },
  {
    id: "miami",
    name: "Miami International Autodrome",
    country: "USA",
    lengthM: 5412,
    corners: 0,
    viewBox: VIEW_BOX,
    outlinePath: linePath([
      [50, 130], [48, 90], [65, 55], [100, 35], [145, 30], [145, 55],
      [175, 40], [220, 45], [255, 65], [268, 100], [250, 130], [210, 150],
      [160, 158], [110, 152], [75, 145],
    ]),
    segments: [],
  },
  {
    id: "imola",
    name: "Autodromo Enzo e Dino Ferrari",
    country: "Italy",
    lengthM: 4909,
    corners: 0,
    viewBox: VIEW_BOX,
    // Tamburello/Villeneuve chicane notch early, Rivazza double-right into
    // the pit straight.
    outlinePath: linePath([
      [45, 90], [55, 55], [90, 35], [105, 50], [95, 65], [130, 40],
      [170, 30], [210, 40], [245, 65], [262, 100], [245, 130], [210, 120],
      [225, 150], [190, 162], [150, 160], [110, 150], [75, 135], [55, 115],
    ]),
    segments: [],
  },
  {
    id: "monaco",
    name: "Circuit de Monaco",
    country: "Monaco",
    lengthM: 3337,
    corners: 0,
    viewBox: VIEW_BOX,
    // Sainte Devote up to the Casino/Mirabeau/Grand Hotel hairpin, down
    // through the tunnel, the swimming-pool esses, and Rascasse.
    outlinePath: linePath([
      [75, 155], [65, 120], [72, 85], [58, 55], [100, 35], [145, 42],
      [120, 20], [168, 38], [215, 28], [255, 48], [268, 85], [250, 112],
      [262, 140], [210, 128], [230, 150], [185, 145], [155, 160], [115, 145],
      [140, 168],
    ]),
    segments: [],
  },
  {
    id: "catalunya",
    name: "Circuit de Barcelona-Catalunya",
    country: "Spain",
    lengthM: 4657,
    corners: 0,
    viewBox: VIEW_BOX,
    outlinePath: linePath([
      [50, 100], [65, 60], [110, 35], [160, 25], [145, 50], [190, 40],
      [230, 55], [258, 85], [245, 120], [205, 100], [195, 130], [160, 150],
      [110, 158], [70, 140],
    ]),
    segments: [],
  },
  {
    id: "montreal",
    name: "Circuit Gilles Villeneuve",
    country: "Canada",
    lengthM: 4361,
    corners: 0,
    viewBox: VIEW_BOX,
    // Narrow island loop with the hairpin at the far end and the Wall of
    // Champions chicane back near the finish.
    outlinePath: linePath([
      [45, 90], [60, 55], [105, 38], [155, 32], [200, 42], [235, 60],
      [255, 85], [235, 105], [250, 125], [215, 140], [170, 150], [120, 145],
      [80, 155], [55, 130],
    ]),
    segments: [],
  },
  {
    id: "red-bull-ring",
    name: "Red Bull Ring",
    country: "Austria",
    lengthM: 4318,
    corners: 0,
    viewBox: VIEW_BOX,
    // Short and hilly, three long straights meeting at three main corners.
    outlinePath: linePath([
      [70, 140], [50, 95], [75, 50], [130, 30], [140, 55], [190, 35],
      [235, 60], [250, 100], [215, 135], [160, 155], [105, 150],
    ]),
    segments: [],
  },
  {
    id: "silverstone",
    name: "Silverstone Circuit",
    country: "Great Britain",
    lengthM: 5891,
    corners: 0,
    viewBox: VIEW_BOX,
    // Village/The Loop kink early, the iconic Maggotts-Becketts-Chapel
    // esses mid-lap, then Hangar Straight down to Stowe and Club.
    outlinePath: linePath([
      [60, 90], [70, 55], [100, 30], [85, 50], [120, 60], [105, 80],
      [140, 95], [160, 60], [145, 40], [175, 50], [160, 70], [195, 45],
      [240, 25], [268, 55], [258, 95], [225, 120], [240, 145], [190, 155],
      [140, 158], [95, 145], [70, 120],
    ]),
    segments: [],
  },
  {
    id: "spa",
    name: "Circuit de Spa-Francorchamps",
    country: "Belgium",
    lengthM: 7004,
    corners: 0,
    viewBox: VIEW_BOX,
    // La Source hairpin down into Eau Rouge/Raidillon, the long Kemmel
    // straight, Les Combes chicane, and Blanchimont/Bus Stop to finish.
    outlinePath: linePath([
      [35, 50], [70, 60], [55, 90], [90, 100], [145, 70], [195, 50],
      [172, 65], [215, 45], [255, 58], [275, 85], [260, 115], [225, 105],
      [248, 138], [200, 155], [165, 142], [190, 168], [135, 170], [90, 155],
      [58, 128],
    ]),
    segments: [],
  },
  {
    id: "hungaroring",
    name: "Hungaroring",
    country: "Hungary",
    lengthM: 4381,
    corners: 0,
    viewBox: VIEW_BOX,
    // Tight, twisty bowl with no real straights.
    outlinePath: linePath([
      [70, 120], [58, 85], [75, 55], [110, 38], [140, 50], [120, 68],
      [155, 58], [195, 42], [230, 58], [248, 90], [228, 125], [190, 145],
      [150, 150], [112, 142],
    ]),
    segments: [],
  },
  {
    id: "zandvoort",
    name: "Circuit Zandvoort",
    country: "Netherlands",
    lengthM: 4259,
    corners: 0,
    viewBox: VIEW_BOX,
    // Compact coastal dune loop with the banked Tarzan hairpin.
    outlinePath: linePath([
      [70, 130], [52, 90], [70, 55], [110, 32], [155, 28], [195, 42],
      [225, 70], [238, 105], [218, 138], [175, 155], [130, 152], [95, 148],
    ]),
    segments: [],
  },
  {
    id: "monza",
    name: "Autodromo Nazionale Monza",
    country: "Italy",
    lengthM: 5793,
    corners: 0,
    viewBox: VIEW_BOX,
    // Rettifilo chicane off the start, Curva Grande, Variante della Roggia,
    // the Lesmos, a long back straight into Variante Ascari, then Parabolica.
    outlinePath: linePath([
      [60, 145], [55, 95], [75, 55], [63, 42], [115, 28], [175, 26],
      [210, 38], [193, 52], [230, 48], [252, 68], [244, 92], [262, 122],
      [238, 146], [254, 152], [205, 160], [145, 160], [95, 153],
    ]),
    segments: [],
  },
  {
    id: "baku",
    name: "Baku City Circuit",
    country: "Azerbaijan",
    lengthM: 6003,
    corners: 0,
    viewBox: VIEW_BOX,
    // The narrow medieval-old-town zigzag (famous pinch at turn 8) feeding
    // one of the calendar's longest straights back along the seafront.
    outlinePath: linePath([
      [30, 120], [28, 85], [45, 60], [68, 48], [62, 68], [85, 55],
      [105, 72], [92, 88], [125, 58], [165, 48], [220, 52], [265, 72],
      [278, 108], [252, 135], [190, 142], [120, 142], [70, 138],
    ]),
    segments: [],
  },
  {
    id: "marina-bay",
    name: "Marina Bay Street Circuit",
    country: "Singapore",
    lengthM: 4940,
    corners: 0,
    viewBox: VIEW_BOX,
    // Right-angled street grid around the bay.
    outlinePath: linePath([
      [60, 55], [185, 55], [185, 40], [245, 40], [245, 90], [225, 90],
      [225, 135], [155, 135], [155, 105], [95, 105], [95, 145], [60, 145],
    ]),
    segments: [],
  },
  {
    id: "cota",
    name: "Circuit of the Americas",
    country: "USA",
    lengthM: 5513,
    corners: 0,
    viewBox: VIEW_BOX,
    // The steep uphill esses at turn 1 (echoing Maggotts/Becketts), a
    // hairpin, long back straight, then the technical stadium section.
    outlinePath: linePath([
      [55, 55], [80, 30], [105, 42], [92, 60], [125, 45], [150, 60],
      [135, 80], [168, 55], [205, 45], [245, 55], [268, 80], [272, 118],
      [245, 142], [195, 132], [212, 155], [165, 165], [115, 158], [82, 142],
      [65, 112],
    ]),
    segments: [],
  },
  {
    id: "mexico-city",
    name: "Autódromo Hermanos Rodríguez",
    country: "Mexico",
    lengthM: 4304,
    corners: 0,
    viewBox: VIEW_BOX,
    // Long back straight into the tight Foro Sol stadium chicane.
    outlinePath: linePath([
      [50, 105], [55, 65], [85, 38], [135, 26], [190, 32], [240, 50],
      [265, 90], [258, 128], [235, 148], [218, 132], [195, 150], [150, 160],
      [100, 153], [65, 138],
    ]),
    segments: [],
  },
  {
    id: "interlagos",
    name: "Autódromo José Carlos Pace",
    country: "Brazil",
    lengthM: 4309,
    corners: 0,
    viewBox: VIEW_BOX,
    // The Senna S dip at the start, Reta Oposta back straight, Junção
    // hairpin.
    outlinePath: linePath([
      [60, 55], [95, 42], [75, 65], [115, 52], [160, 45], [205, 52],
      [240, 78], [255, 112], [228, 142], [178, 150], [128, 143], [95, 155],
      [62, 130], [52, 90],
    ]),
    segments: [],
  },
  {
    id: "las-vegas",
    name: "Las Vegas Strip Circuit",
    country: "USA",
    lengthM: 6201,
    corners: 0,
    viewBox: VIEW_BOX,
    // Very long straights down and back up the Strip, joined by 90-degree
    // corners at each end.
    outlinePath: linePath([
      [45, 65], [45, 45], [262, 45], [262, 80], [145, 80], [145, 108],
      [262, 108], [262, 145], [45, 145], [45, 108], [118, 108], [118, 88],
      [45, 88],
    ]),
    segments: [],
  },
  {
    id: "lusail",
    name: "Lusail International Circuit",
    country: "Qatar",
    lengthM: 5419,
    corners: 0,
    viewBox: VIEW_BOX,
    // Smooth, flowing oval with a technical infield loop.
    outlinePath: linePath([
      [55, 100], [68, 58], [112, 32], [168, 26], [218, 42], [255, 72],
      [262, 108], [232, 140], [185, 118], [195, 148], [145, 160], [98, 150],
      [65, 128],
    ]),
    segments: [],
  },
  {
    id: "yas-marina",
    name: "Yas Marina Circuit",
    country: "Abu Dhabi",
    lengthM: 5281,
    corners: 0,
    viewBox: VIEW_BOX,
    // Marina promenade section, the hotel-bridge kink, long back straight.
    outlinePath: linePath([
      [50, 100], [58, 58], [100, 32], [150, 25], [200, 36], [240, 58],
      [262, 92], [250, 128], [215, 148], [178, 120], [135, 148], [92, 155],
      [62, 135],
    ]),
    segments: [],
  },
];

// Corner-class sequence + straight-weighting per track, applied after the
// array above so each entry above can stay purely about the visual outline.
// `corners` is derived from each pattern's length rather than hardcoded, so
// it can never drift out of sync with the segments actually simulated.
const CORNER_PATTERNS: Record<string, { pattern: CircuitCornerClass[]; weights?: number[] }> = {
  "albert-park": {
    pattern: ["medium", "fast", "medium", "tight", "fast", "medium", "fast", "tight", "medium", "fast", "medium", "tight", "fast", "medium"],
  },
  shanghai: {
    pattern: ["medium", "tight", "fast", "medium", "fast", "medium", "tight", "fast", "medium", "fast", "tight", "medium", "fast", "medium", "tight", "fast"],
  },
  suzuka: {
    pattern: ["medium", "fast", "medium", "fast", "medium", "fast", "medium", "veryFast", "medium", "hairpin", "medium", "fast", "medium", "tight", "tight", "medium", "fast", "medium"],
  },
  bahrain: {
    pattern: ["tight", "fast", "medium", "fast", "medium", "tight", "medium", "fast", "medium", "tight", "fast", "medium", "fast", "tight", "medium"],
  },
  jeddah: {
    pattern: ["medium", "fast", "veryFast", "fast", "veryFast", "fast", "medium", "veryFast", "fast", "veryFast", "fast", "medium", "veryFast", "fast", "veryFast", "fast", "medium", "veryFast", "fast", "veryFast", "fast", "medium", "fast", "veryFast", "fast", "tight", "medium"],
    weights: [4, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  miami: {
    pattern: ["medium", "fast", "tight", "medium", "fast", "medium", "tight", "fast", "medium", "fast", "tight", "medium", "fast", "medium", "tight", "fast", "medium", "tight", "medium"],
  },
  imola: {
    pattern: ["tight", "medium", "tight", "fast", "medium", "fast", "tight", "medium", "fast", "medium", "tight", "fast", "medium", "tight", "medium"],
  },
  monaco: {
    pattern: ["tight", "hairpin", "tight", "medium", "tight", "hairpin", "tight", "medium", "tight", "tight", "hairpin", "tight", "medium", "tight", "tight", "hairpin", "tight", "medium", "tight"],
  },
  catalunya: {
    pattern: ["tight", "veryFast", "medium", "fast", "medium", "tight", "fast", "medium", "tight", "tight", "medium", "tight", "fast", "medium"],
  },
  montreal: {
    pattern: ["tight", "medium", "fast", "medium", "tight", "fast", "medium", "tight", "fast", "medium", "tight", "tight", "medium", "tight"],
    weights: [5, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  "red-bull-ring": {
    pattern: ["tight", "fast", "medium", "fast", "tight", "medium", "fast", "medium", "tight", "medium"],
  },
  silverstone: {
    pattern: ["medium", "fast", "veryFast", "fast", "medium", "fast", "tight", "medium", "fast", "veryFast", "fast", "medium", "tight", "fast", "medium", "fast", "tight", "medium"],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 4, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  spa: {
    pattern: ["hairpin", "fast", "veryFast", "medium", "fast", "tight", "medium", "fast", "veryFast", "medium", "fast", "tight", "medium", "fast", "medium", "tight", "fast", "medium", "tight"],
    weights: [1, 1, 1, 7, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  hungaroring: {
    pattern: ["tight", "medium", "tight", "medium", "tight", "fast", "tight", "medium", "tight", "medium", "tight", "fast", "tight", "medium"],
  },
  zandvoort: {
    pattern: ["medium", "tight", "fast", "medium", "tight", "fast", "medium", "tight", "fast", "medium", "tight", "fast", "medium", "tight"],
  },
  monza: {
    pattern: ["tight", "tight", "fast", "veryFast", "tight", "tight", "fast", "medium", "fast", "veryFast", "tight"],
    weights: [6, 1, 1, 1, 1, 1, 1, 1, 4, 1, 1],
  },
  baku: {
    pattern: ["tight", "tight", "medium", "tight", "tight", "medium", "tight", "tight", "medium", "tight", "fast", "veryFast", "fast", "medium", "tight", "tight", "medium", "tight", "fast", "tight"],
    weights: [10, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  "marina-bay": {
    pattern: ["tight", "tight", "medium", "tight", "tight", "tight", "medium", "tight", "tight", "fast", "tight", "tight", "medium", "tight", "tight", "tight", "medium", "tight", "tight"],
  },
  cota: {
    pattern: ["medium", "fast", "medium", "fast", "medium", "fast", "tight", "hairpin", "medium", "fast", "veryFast", "fast", "medium", "tight", "medium", "tight", "medium", "tight", "medium", "tight"],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  },
  "mexico-city": {
    pattern: ["tight", "fast", "medium", "fast", "medium", "tight", "fast", "medium", "fast", "veryFast", "medium", "tight", "tight", "medium", "tight", "tight", "medium"],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 6, 1, 1, 1, 1, 1, 1, 1],
  },
  interlagos: {
    pattern: ["medium", "fast", "medium", "fast", "tight", "medium", "fast", "medium", "tight", "fast", "medium", "tight", "hairpin", "medium", "tight"],
  },
  "las-vegas": {
    pattern: ["fast", "medium", "fast", "tight", "fast", "medium", "fast", "tight", "medium", "fast", "medium", "tight", "fast", "medium", "tight", "fast", "medium"],
    weights: [5, 1, 1, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1, 1, 1, 1, 1],
  },
  lusail: {
    pattern: ["medium", "fast", "medium", "fast", "tight", "medium", "fast", "veryFast", "medium", "fast", "tight", "medium", "fast", "medium", "tight", "medium"],
  },
  "yas-marina": {
    pattern: ["medium", "fast", "medium", "tight", "medium", "fast", "veryFast", "fast", "medium", "tight", "tight", "medium", "fast", "medium", "tight", "medium"],
    weights: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 5, 1, 1, 1],
  },
};

for (const circuit of CIRCUITS) {
  const spec = CORNER_PATTERNS[circuit.id];
  circuit.corners = spec.pattern.length;
  circuit.segments = buildLap(circuit.lengthM, spec.pattern, spec.weights);
}

export const DEFAULT_CIRCUIT_ID = CIRCUITS[0].id;

export function getCircuit(id: string): Circuit {
  return CIRCUITS.find((c) => c.id === id) ?? CIRCUITS[0];
}
