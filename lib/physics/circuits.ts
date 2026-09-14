import { buildCircuitGeometry, countCorners } from "./circuitGeometry";
import { Circuit } from "./types";

// A single representative track width, used only where a width estimate is
// unavoidable (e.g. a future racing-line optimizer). No per-corner width
// survey data exists for any circuit here, so this is not varied per track.
const TRACK_WIDTH_M = 12;

const VIEW_BOX = "0 0 300 180";

// Joins a circuit's waypoints with straight edges rather than a smoothing
// spline, purely for the SVG track-map illustration - real track-map
// diagrams (and the physics centerline in circuitGeometry.ts, which fillets
// these same waypoints properly) are built from distinct straights meeting
// at distinct corners, not a uniform curve. The stroke's rounded line joins
// do the visual softening at each vertex here; the actual cornering physics
// downstream never uses this SVG path, only the raw waypoints.
function linePath(points: [number, number][]): string {
  const [x0, y0] = points[0];
  const rest = points.slice(1).map(([x, y]) => `L ${x} ${y}`);
  return [`M ${x0} ${y0}`, ...rest, "Z"].join(" ");
}

// Builds a full Circuit from a closed loop of waypoints plus the circuit's
// known real-world lap length. Distance, heading, curvature and the corner
// count are all derived from `waypoints` by circuitGeometry.ts - nothing
// here hand-assigns a corner radius, corner speed, or corner count.
//
// `waypoints` are this app's existing stylized per-circuit outlines: a
// hand-drawn sketch of each track's real corner sequence (hairpins,
// chicanes, esses, spirals) at a fixed illustrative scale, not surveyed
// geometry - seeCircuitGeometry.ts's header comment for what would replace
// them if accurate centerline data becomes available.
function defineCircuit(
  id: string,
  name: string,
  country: string,
  lengthM: number,
  waypoints: [number, number][],
): Circuit {
  const points = buildCircuitGeometry(waypoints, lengthM);
  return {
    id,
    name,
    country,
    lengthM,
    corners: countCorners(waypoints),
    viewBox: VIEW_BOX,
    outlinePath: linePath(waypoints),
    trackWidthM: TRACK_WIDTH_M,
    points,
  };
}

export const CIRCUITS: Circuit[] = [
  defineCircuit(
    "albert-park",
    "Albert Park Circuit",
    "Australia",
    5278,
    // Lakeside loop: flat southern edge along the lake, a kink at turns 6-7,
    // long back straight up the eastern side.
    [
      [45, 60], [42, 110], [70, 145], [125, 158], [185, 155], [235, 140],
      [215, 115], [255, 95], [272, 55], [248, 25], [195, 18], [140, 22],
      [90, 30], [55, 42],
    ],
  ),
  defineCircuit(
    "shanghai",
    "Shanghai International Circuit",
    "China",
    5451,
    // The signature decreasing-radius turn 1-2-3 spiral, then a long back
    // straight and hairpin before the return leg.
    [
      [40, 140], [25, 100], [45, 72], [68, 78], [60, 98], [95, 72],
      [150, 35], [200, 28], [240, 42], [265, 70], [272, 105],
      [245, 138], [195, 150], [145, 152], [95, 148], [60, 145],
    ],
  ),
  defineCircuit(
    "suzuka",
    "Suzuka Circuit",
    "Japan",
    5807,
    // The real figure-eight: esses into the Degner curves and hairpin on
    // one lobe, crossing over itself into the Spoon/130R/chicane lobe.
    [
      [150, 120], [110, 100], [80, 70], [50, 80], [40, 115], [55, 140],
      [90, 150], [130, 130], [150, 100], [190, 80], [230, 90], [265, 75],
      [270, 110], [240, 135], [195, 130], [165, 115],
    ],
  ),
  defineCircuit(
    "bahrain",
    "Bahrain International Circuit",
    "Bahrain",
    5412,
    [
      [50, 50], [110, 30], [170, 25], [220, 40], [255, 70], [240, 100],
      [195, 90], [175, 115], [205, 140], [190, 160], [130, 162], [75, 150],
      [45, 110], [40, 80],
    ],
  ),
  defineCircuit(
    "jeddah",
    "Jeddah Corniche Circuit",
    "Saudi Arabia",
    6174,
    // Long, narrow, wall-hugging coastal ribbon of fast kinks.
    [
      [25, 95], [55, 75], [80, 95], [105, 78], [130, 92], [155, 75],
      [180, 92], [205, 75], [230, 90], [255, 78], [275, 95], [260, 125],
      [225, 135], [195, 120], [165, 132], [135, 118], [105, 132], [75, 120],
      [45, 128],
    ],
  ),
  defineCircuit(
    "miami",
    "Miami International Autodrome",
    "USA",
    5412,
    [
      [50, 130], [48, 90], [65, 55], [100, 35], [145, 30], [145, 55],
      [175, 40], [220, 45], [255, 65], [268, 100], [250, 130], [210, 150],
      [160, 158], [110, 152], [75, 145],
    ],
  ),
  defineCircuit(
    "imola",
    "Autodromo Enzo e Dino Ferrari",
    "Italy",
    4909,
    // Tamburello/Villeneuve chicane notch early, Rivazza double-right into
    // the pit straight.
    [
      [45, 90], [55, 55], [90, 35], [105, 50], [95, 65], [130, 40],
      [170, 30], [210, 40], [245, 65], [262, 100], [245, 130], [210, 120],
      [225, 150], [190, 162], [150, 160], [110, 150], [75, 135], [55, 115],
    ],
  ),
  defineCircuit(
    "monaco",
    "Circuit de Monaco",
    "Monaco",
    3337,
    // Sainte Devote up to the Casino/Mirabeau/Grand Hotel hairpin, down
    // through the tunnel, the swimming-pool esses, and Rascasse.
    [
      [75, 155], [65, 120], [72, 85], [58, 55], [100, 35], [145, 42],
      [120, 20], [168, 38], [215, 28], [255, 48], [268, 85], [250, 112],
      [262, 140], [210, 128], [230, 150], [185, 145], [155, 160], [115, 145],
      [140, 168],
    ],
  ),
  defineCircuit(
    "catalunya",
    "Circuit de Barcelona-Catalunya",
    "Spain",
    4657,
    [
      [50, 100], [65, 60], [110, 35], [160, 25], [145, 50], [190, 40],
      [230, 55], [258, 85], [245, 120], [205, 100], [195, 130], [160, 150],
      [110, 158], [70, 140],
    ],
  ),
  defineCircuit(
    "montreal",
    "Circuit Gilles Villeneuve",
    "Canada",
    4361,
    // Narrow island loop with the hairpin at the far end and the Wall of
    // Champions chicane back near the finish.
    [
      [45, 90], [60, 55], [105, 38], [155, 32], [200, 42], [235, 60],
      [255, 85], [235, 105], [250, 125], [215, 140], [170, 150], [120, 145],
      [80, 155], [55, 130],
    ],
  ),
  defineCircuit(
    "red-bull-ring",
    "Red Bull Ring",
    "Austria",
    4318,
    // Short and hilly, three long straights meeting at three main corners.
    [
      [70, 140], [50, 95], [75, 50], [130, 30], [140, 55], [190, 35],
      [235, 60], [250, 100], [215, 135], [160, 155], [105, 150],
    ],
  ),
  defineCircuit(
    "silverstone",
    "Silverstone Circuit",
    "Great Britain",
    5891,
    // Village/The Loop kink early, the iconic Maggotts-Becketts-Chapel
    // esses mid-lap, then Hangar Straight down to Stowe and Club.
    [
      [60, 90], [70, 55], [100, 30], [85, 50], [120, 60], [105, 80],
      [140, 95], [160, 60], [145, 40], [175, 50], [160, 70], [195, 45],
      [240, 25], [268, 55], [258, 95], [225, 120], [240, 145], [190, 155],
      [140, 158], [95, 145], [70, 120],
    ],
  ),
  defineCircuit(
    "spa",
    "Circuit de Spa-Francorchamps",
    "Belgium",
    7004,
    // La Source hairpin down into Eau Rouge/Raidillon, the long Kemmel
    // straight, Les Combes chicane, and Blanchimont/Bus Stop to finish.
    [
      [35, 50], [70, 60], [55, 90], [90, 100], [145, 70], [195, 50],
      [172, 65], [215, 45], [255, 58], [275, 85], [260, 115], [225, 105],
      [248, 138], [200, 155], [165, 142], [190, 168], [135, 170], [90, 155],
      [58, 128],
    ],
  ),
  defineCircuit(
    "hungaroring",
    "Hungaroring",
    "Hungary",
    4381,
    // Tight, twisty bowl with no real straights.
    [
      [70, 120], [58, 85], [75, 55], [110, 38], [140, 50], [120, 68],
      [155, 58], [195, 42], [230, 58], [248, 90], [228, 125], [190, 145],
      [150, 150], [112, 142],
    ],
  ),
  defineCircuit(
    "zandvoort",
    "Circuit Zandvoort",
    "Netherlands",
    4259,
    // Compact coastal dune loop with the banked Tarzan hairpin.
    [
      [70, 130], [52, 90], [70, 55], [110, 32], [155, 28], [195, 42],
      [225, 70], [238, 105], [218, 138], [175, 155], [130, 152], [95, 148],
    ],
  ),
  defineCircuit(
    "monza",
    "Autodromo Nazionale Monza",
    "Italy",
    5793,
    // Rettifilo chicane off the start, Curva Grande, Variante della Roggia,
    // the Lesmos, a long back straight into Variante Ascari, then Parabolica.
    [
      [60, 145], [55, 95], [75, 55], [63, 42], [115, 28], [175, 26],
      [210, 38], [193, 52], [230, 48], [252, 68], [244, 92], [262, 122],
      [238, 146], [254, 152], [205, 160], [145, 160], [95, 153],
    ],
  ),
  defineCircuit(
    "baku",
    "Baku City Circuit",
    "Azerbaijan",
    6003,
    // The narrow medieval-old-town zigzag (famous pinch at turn 8) feeding
    // one of the calendar's longest straights back along the seafront.
    [
      [30, 120], [28, 85], [45, 60], [68, 48], [62, 68], [85, 55],
      [105, 72], [92, 88], [125, 58], [165, 48], [220, 52], [265, 72],
      [278, 108], [252, 135], [190, 142], [120, 142], [70, 138],
    ],
  ),
  defineCircuit(
    "marina-bay",
    "Marina Bay Street Circuit",
    "Singapore",
    4940,
    // Right-angled street grid around the bay.
    [
      [60, 55], [185, 55], [185, 40], [245, 40], [245, 90], [225, 90],
      [225, 135], [155, 135], [155, 105], [95, 105], [95, 145], [60, 145],
    ],
  ),
  defineCircuit(
    "cota",
    "Circuit of the Americas",
    "USA",
    5513,
    // The steep uphill esses at turn 1 (echoing Maggotts/Becketts), a
    // hairpin, long back straight, then the technical stadium section.
    [
      [55, 55], [80, 30], [105, 42], [92, 60], [125, 45], [150, 60],
      [135, 80], [168, 55], [205, 45], [245, 55], [268, 80], [272, 118],
      [245, 142], [195, 132], [212, 155], [165, 165], [115, 158], [82, 142],
      [65, 112],
    ],
  ),
  defineCircuit(
    "mexico-city",
    "Autódromo Hermanos Rodríguez",
    "Mexico",
    4304,
    // Long back straight into the tight Foro Sol stadium chicane.
    [
      [50, 105], [55, 65], [85, 38], [135, 26], [190, 32], [240, 50],
      [265, 90], [258, 128], [235, 148], [218, 132], [195, 150], [150, 160],
      [100, 153], [65, 138],
    ],
  ),
  defineCircuit(
    "interlagos",
    "Autódromo José Carlos Pace",
    "Brazil",
    4309,
    // The Senna S dip at the start, Reta Oposta back straight, Junção
    // hairpin.
    [
      [60, 55], [95, 42], [75, 65], [115, 52], [160, 45], [205, 52],
      [240, 78], [255, 112], [228, 142], [178, 150], [128, 143], [95, 155],
      [62, 130], [52, 90],
    ],
  ),
  defineCircuit(
    "las-vegas",
    "Las Vegas Strip Circuit",
    "USA",
    6201,
    // Very long straights down and back up the Strip, joined by 90-degree
    // corners at each end.
    [
      [45, 65], [45, 45], [262, 45], [262, 80], [145, 80], [145, 108],
      [262, 108], [262, 145], [45, 145], [45, 108], [118, 108], [118, 88],
      [45, 88],
    ],
  ),
  defineCircuit(
    "lusail",
    "Lusail International Circuit",
    "Qatar",
    5419,
    // Smooth, flowing oval with a technical infield loop.
    [
      [55, 100], [68, 58], [112, 32], [168, 26], [218, 42], [255, 72],
      [262, 108], [232, 140], [185, 118], [195, 148], [145, 160], [98, 150],
      [65, 128],
    ],
  ),
  defineCircuit(
    "yas-marina",
    "Yas Marina Circuit",
    "Abu Dhabi",
    5281,
    // Marina promenade section, the hotel-bridge kink, long back straight.
    [
      [50, 100], [58, 58], [100, 32], [150, 25], [200, 36], [240, 58],
      [262, 92], [250, 128], [215, 148], [178, 120], [135, 148], [92, 155],
      [62, 135],
    ],
  ),
];

export const DEFAULT_CIRCUIT_ID = CIRCUITS[0].id;

export function getCircuit(id: string): Circuit {
  return CIRCUITS.find((c) => c.id === id) ?? CIRCUITS[0];
}
