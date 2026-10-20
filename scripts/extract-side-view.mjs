// Builds a dedicated 3D model's side view for the 2D wind tunnel and writes
// it into the preset as model3d.sideView:
//
//   node scripts/extract-side-view.mjs lib/physics/carData/supercar/test-car.json
//
// Two things come out of the model:
//
// - section: the outlines of a cut through the car's centreline - what the
//   2D flow is solved around. Everything the cut passes through counts
//   (body, cabin, splitter, diffuser, a full-width wing's plank); off-centre
//   parts (wheels, mirrors, wing supports) aren't in it, so air flows under
//   a wing and beneath the floor the way it does along a real car's middle.
//   The largest outline is the body, the rest (e.g. the wing) follow.
// - a side-on picture of the whole model in its own colours, saved next to
//   it as <model>-side.png, which the tunnel draws over the flow so the car
//   looks like itself.
//
// Coordinates match the 3D viewer's fit (DedicatedModel.tsx): the model is
// turned by yawDeg to face +X and scaled uniformly by its overall length, so
// every value is a fraction of that length - u from the nose, v from the
// lowest point of the model (the ground). Re-run whenever the model or its
// yawDeg changes.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const MODELS_DIR = join(fileURLToPath(new URL(".", import.meta.url)), "..", "public", "models");
// Section raster: cells across the model's length (~5 mm on a car).
const SECTION_CELLS = 1000;
// Outline simplification tolerance, as a fraction of length (~1.5 mm). The
// app resamples the outline much coarser than this anyway.
const SECTION_TOLERANCE = 0.0003;
// Pieces of the cut smaller than this share of the body's area (a badge
// that happens to cross the centreline) are dropped. A rear wing's plank is
// well under 1% of a car's section, so this has to be small.
const MIN_PIECE_AREA = 0.002;
// The picture's width in pixels, rendered at 2x and averaged down.
const IMAGE_WIDTH = 1600;
const SUPERSAMPLE = 2;

const presetPath = process.argv[2];
if (!presetPath) throw new Error("Usage: node scripts/extract-side-view.mjs <preset.json>");
const preset = JSON.parse(readFileSync(presetPath, "utf8"));
if (!preset.model3d) throw new Error(`${presetPath} has no model3d`);
const modelFile = preset.model3d.file;
const imageFile = modelFile.replace(/\.glb$/, "-side.png");

await MeshoptDecoder.ready;
const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const glb = readFileSync(join(MODELS_DIR, modelFile));
const gltf = await loader.parseAsync(glb.buffer.slice(glb.byteOffset, glb.byteOffset + glb.byteLength), "");

const turned = new THREE.Group().add(gltf.scene);
turned.rotation.y = THREE.MathUtils.degToRad(preset.model3d.yawDeg ?? 0);
turned.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(turned);
const length = box.max.x - box.min.x;
const heightV = (box.max.y - box.min.y) / length;
const toU = (x) => (box.max.x - x) / length; // 0 at the nose (+X), 1 at the tail
const toV = (y) => (y - box.min.y) / length;

// Every triangle in world space, with its mesh's material.
const triangles = [];
turned.traverse((obj) => {
  if (!obj.isMesh) return;
  const pos = obj.geometry.getAttribute("position");
  const nor = obj.geometry.getAttribute("normal");
  const index = obj.geometry.index;
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(obj.matrixWorld);
  const material = Array.isArray(obj.material) ? obj.material[0] : obj.material;
  const count = index ? index.count : pos.count;
  for (let t = 0; t < count; t += 3) {
    const corners = [0, 1, 2].map((k) => {
      const i = index ? index.getX(t + k) : t + k;
      const p = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld);
      const n = nor ? new THREE.Vector3().fromBufferAttribute(nor, i).applyMatrix3(normalMatrix).normalize() : null;
      return { p, n };
    });
    triangles.push({ corners, material });
  }
});

// --- Centreline section ---------------------------------------------------
//
// Each triangle crossing the cutting plane contributes a segment; drawn into
// a grid, the segments wall off the solid regions, and a flood fill from the
// grid's edge finds the outside - everything it can't reach is solid, which
// also unions overlapping parts (a cabin sitting in the body). The plane is
// nudged off the exact centreline so vertices on the symmetry seam don't
// produce degenerate cuts.

const zCut = (box.min.z + box.max.z) / 2 + (box.max.z - box.min.z) * 0.0037;
// One empty cell of margin all round, so the fill can get past parts that
// reach the model's extremes (a splitter tip, the top of a wing).
const cell = 1 / SECTION_CELLS; // in units of length
const cols = SECTION_CELLS + 2;
const rows = Math.ceil(heightV / cell) + 2;
const wall = new Uint8Array(cols * rows);
const colOf = (u) => Math.min(cols - 2, Math.max(1, Math.floor(u / cell) + 1));
const rowOf = (v) => Math.min(rows - 2, Math.max(1, rows - 2 - Math.floor(v / cell)));

for (const { corners } of triangles) {
  const hits = [];
  for (let e = 0; e < 3; e++) {
    const a = corners[e].p;
    const b = corners[(e + 1) % 3].p;
    if (a.z < zCut !== b.z < zCut) {
      const k = (zCut - a.z) / (b.z - a.z);
      hits.push([toU(a.x + (b.x - a.x) * k), toV(a.y + (b.y - a.y) * k)]);
    }
  }
  if (hits.length !== 2) continue;
  const [[u0, v0], [u1, v1]] = hits;
  // Sampling at a quarter cell keeps the line 8-connected, which a
  // 4-connected flood fill can't leak through.
  const steps = Math.max(1, Math.ceil((Math.hypot(u1 - u0, v1 - v0) / cell) * 4));
  for (let s = 0; s <= steps; s++) {
    const k = s / steps;
    wall[rowOf(v0 + (v1 - v0) * k) * cols + colOf(u0 + (u1 - u0) * k)] = 1;
  }
}

const outside = new Uint8Array(cols * rows);
const queue = [];
for (let c = 0; c < cols; c++) queue.push(c, (rows - 1) * cols + c);
for (let r = 0; r < rows; r++) queue.push(r * cols, r * cols + cols - 1);
while (queue.length) {
  const k = queue.pop();
  if (outside[k] || wall[k]) continue;
  outside[k] = 1;
  const c = k % cols;
  if (c > 0) queue.push(k - 1);
  if (c < cols - 1) queue.push(k + 1);
  if (k >= cols) queue.push(k - cols);
  if (k < (rows - 1) * cols) queue.push(k + cols);
}
const solid = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows && !outside[r * cols + c];

// Label the solid pieces (8-connected), then trace each one's outer edge.
const label = new Int32Array(cols * rows).fill(-1);
const pieces = [];
for (let k = 0; k < cols * rows; k++) {
  if (outside[k] || label[k] >= 0) continue;
  const id = pieces.length;
  let area = 0;
  const stack = [k];
  label[k] = id;
  while (stack.length) {
    const j = stack.pop();
    area++;
    const c = j % cols;
    const r = (j - c) / cols;
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        const n = (r + dr) * cols + (c + dc);
        if (solid(c + dc, r + dr) && label[n] < 0) {
          label[n] = id;
          stack.push(n);
        }
      }
  }
  // k is the piece's first cell in row-major order: its top-left.
  pieces.push({ id, area, start: k });
}

// Moore-neighbour tracing, clockwise on screen (rows grow downward).
const DIRS = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]];
function traceOutline(piece) {
  const inPiece = (c, r) => solid(c, r) && label[r * cols + c] === piece.id;
  const sc = piece.start % cols;
  const sr = (piece.start - sc) / cols;
  const points = [[sc, sr]];
  let [c, r] = [sc, sr];
  let back = 0; // came from the west: nothing solid to the start's left
  for (let guard = 0; guard < cols * rows; guard++) {
    let moved = false;
    for (let t = 1; t <= 8; t++) {
      const d = (back + t) % 8;
      const [dc, dr] = DIRS[d];
      if (inPiece(c + dc, r + dr)) {
        c += dc;
        r += dr;
        // Next search starts from the neighbour checked just before this one,
        // seen from the new cell.
        const [pc, pr] = DIRS[(d + 7) % 8];
        const prev = [c - dc + pc - c, r - dr + pr - r];
        back = DIRS.findIndex(([x, y]) => x === prev[0] && y === prev[1]);
        moved = true;
        break;
      }
    }
    if (!moved || (c === sc && r === sr)) break;
    points.push([c, r]);
  }
  return points.map(([pc, pr]) => [(pc - 0.5) * cell, (rows - 2 - pr + 0.5) * cell]);
}

function simplify(points, tolerance) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const len = Math.hypot(bx - ax, by - ay) || 1;
    let worst = -1;
    let worstDist = tolerance;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((bx - ax) * (ay - points[i][1]) - (ax - points[i][0]) * (by - ay)) / len;
      if (d > worstDist) {
        worst = i;
        worstDist = d;
      }
    }
    if (worst > 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

function simplifyClosed(points, tolerance) {
  // Split the loop at its two most distant points so neither half is closed.
  let far = 0;
  points.forEach((p, i) => {
    if (Math.hypot(p[0] - points[0][0], p[1] - points[0][1]) > Math.hypot(points[far][0] - points[0][0], points[far][1] - points[0][1])) far = i;
  });
  const first = simplify(points.slice(0, far + 1), tolerance);
  const second = simplify([...points.slice(far), points[0]], tolerance);
  return [...first, ...second.slice(1, -1)];
}

pieces.sort((a, b) => b.area - a.area);
const round = (n) => Math.round(n * 10000) / 10000;
const section = pieces
  .filter((p) => p.area >= pieces[0].area * MIN_PIECE_AREA)
  .map((p) => simplifyClosed(traceOutline(p), SECTION_TOLERANCE).map(([u, v]) => [round(u), round(v)]));

// --- Side picture ---------------------------------------------------------
//
// A small software rasteriser: orthographic, looking at the car's side with
// the nose to the left, z-buffered, each surface in its material's colour
// with simple diffuse lighting from above and in front.

const W = IMAGE_WIDTH * SUPERSAMPLE;
const H = Math.ceil(IMAGE_WIDTH * heightV) * SUPERSAMPLE;
const scale = W / length;
const toPx = (x) => (box.max.x - x) * scale;
const toPy = (y) => (box.max.y - y) * scale;
// The camera sits on the -Z side looking toward +Z: that view has +X (the
// nose) on the left. Nearer means smaller z.
const light = new THREE.Vector3(0.3, 0.75, -0.6).normalize();
const half = new THREE.Vector3(0, 0, -1).add(light).normalize();
const depth = new Float32Array(W * H).fill(Infinity);
const rgba = new Float32Array(W * H * 4);
const toSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

for (const { corners, material } of triangles) {
  const [a, b, c] = corners.map(({ p }) => [toPx(p.x), toPy(p.y), p.z]);
  const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
  if (Math.abs(area) < 1e-9) continue;
  const minX = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0])));
  const maxX = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
  const minY = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1])));
  const maxY = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
  const color = material.color ?? new THREE.Color(0.5, 0.5, 0.5);
  const metal = material.metalness ?? 0;
  const gloss = 1 - (material.roughness ?? 1);
  const n = new THREE.Vector3();
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const w0 = ((b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)) / area;
      const w1 = ((c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)) / area;
      const w2 = 1 - w0 - w1;
      if (w0 < 0 || w1 < 0 || w2 < 0) continue;
      const z = w0 * a[2] + w1 * b[2] + w2 * c[2];
      const k = y * W + x;
      if (z >= depth[k]) continue;
      depth[k] = z;
      if (corners[0].n) {
        n.set(0, 0, 0)
          .addScaledVector(corners[0].n, w0)
          .addScaledVector(corners[1].n, w1)
          .addScaledVector(corners[2].n, w2)
          .normalize();
      } else {
        n.copy(corners[1].p).sub(corners[0].p).cross(new THREE.Vector3().copy(corners[2].p).sub(corners[0].p)).normalize();
      }
      if (n.z > 0) n.negate(); // light whichever face we're seeing
      const diffuse = 0.38 + 0.62 * Math.max(0, n.dot(light));
      const specular = (0.04 + 0.4 * metal) * gloss * Math.pow(Math.max(0, n.dot(half)), 8 + 60 * gloss);
      rgba[k * 4] = toSrgb(Math.min(1, color.r * diffuse + specular));
      rgba[k * 4 + 1] = toSrgb(Math.min(1, color.g * diffuse + specular));
      rgba[k * 4 + 2] = toSrgb(Math.min(1, color.b * diffuse + specular));
      rgba[k * 4 + 3] = 1;
    }
  }
}

// Average each SUPERSAMPLE x SUPERSAMPLE block (colour weighted by coverage).
const outW = IMAGE_WIDTH;
const outH = H / SUPERSAMPLE;
const pixels = Buffer.alloc(outH * (outW * 4 + 1));
for (let y = 0; y < outH; y++) {
  pixels[y * (outW * 4 + 1)] = 0; // PNG filter: none
  for (let x = 0; x < outW; x++) {
    let r = 0, g = 0, b = 0, alpha = 0;
    for (let sy = 0; sy < SUPERSAMPLE; sy++)
      for (let sx = 0; sx < SUPERSAMPLE; sx++) {
        const k = ((y * SUPERSAMPLE + sy) * W + x * SUPERSAMPLE + sx) * 4;
        r += rgba[k] * rgba[k + 3];
        g += rgba[k + 1] * rgba[k + 3];
        b += rgba[k + 2] * rgba[k + 3];
        alpha += rgba[k + 3];
      }
    const o = y * (outW * 4 + 1) + 1 + x * 4;
    pixels[o] = alpha ? Math.round((r / alpha) * 255) : 0;
    pixels[o + 1] = alpha ? Math.round((g / alpha) * 255) : 0;
    pixels[o + 2] = alpha ? Math.round((b / alpha) * 255) : 0;
    pixels[o + 3] = Math.round((alpha / (SUPERSAMPLE * SUPERSAMPLE)) * 255);
  }
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  let crc = 0xffffffff;
  for (const byte of body) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  const out = Buffer.alloc(body.length + 8);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE((crc ^ 0xffffffff) >>> 0, body.length + 4);
  return out;
}
const header = Buffer.alloc(13);
header.writeUInt32BE(outW, 0);
header.writeUInt32BE(outH, 4);
header[8] = 8; // bit depth
header[9] = 6; // RGBA
writeFileSync(
  join(MODELS_DIR, imageFile),
  Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);

// --- Preset -----------------------------------------------------------------

preset.model3d.sideView = { image: imageFile, imageHeightV: round(heightV), section };
// Keep each outline on one line rather than one line per number.
const json = JSON.stringify(preset, null, 2).replace(/\[\s+(-?[\d.]+),\s+(-?[\d.]+)\s+\]/g, (_, u, v) => `[${u}, ${v}]`);
writeFileSync(presetPath, json + "\n");
console.log(
  `${preset.id}: section of ${section.length} piece(s) (${section.map((s) => `${s.length} pts`).join(", ")}), ` +
    `picture ${outW}x${outH} -> public/models/${imageFile}`,
);
