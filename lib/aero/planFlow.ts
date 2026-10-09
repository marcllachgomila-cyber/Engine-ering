import {
  axleLayout,
  BODY_SHAPES,
  closedBodyPlanTaper,
  lerpKnots,
  openWheelPlanKnots,
  openWheelStations,
} from "../physics/bodyShapes";
import { VehicleState } from "../physics/vehicleState";
import { FlowDomain, FlowField, velocityAt, Wake } from "./flowField";
import { Vec2 } from "./panelMethod";

// The plan view (seen from above) the 3D flow view uses to show air going
// around the car's sides: the body's footprint at flank height, solved as
// 2D potential flow with the same panel method as the side section, but
// with no ground plane. In plan the road isn't a boundary; the flow is
// instead mirror-symmetric about the centreline, so only the y >= 0 half
// is sampled and the other half is its mirror image.
//
// Same axes as the side section: freestream along +x, nose upstream at -x
// (the mirror of the 3D viewer's nose-forward +x). Here y is across the
// car rather than up. Wheels aren't part of the footprint.

// Plan-view corners are rounded off with an elliptical cap this long
// (potential flow is singular at a sharp corner), and the outline is
// sampled at this spacing.
const CLOSED_CORNER_M = 0.3;
const OPEN_WHEEL_CORNER_M = 0.08;
const OUTLINE_SPACING_M = 0.05;

export interface PlanOutline {
  key: string;
  // Counter-clockwise, nose at -x.
  polygon: Vec2[];
  lengthM: number;
  maxHalfWidthM: number;
  // Flow is assumed to leave the sides where the tail's corner rounding
  // begins; the wake spans the width there.
  wake: Wake;
  // Heights above the ground (m) at which the 3D view draws this section:
  // along the flanks, below the bonnet line, where the footprint is the
  // full body width.
  levelsM: number[];
}

export interface PlanFlowGrid extends FlowField {
  outline: PlanOutline;
}

function capFactor(distanceFromEndM: number, cornerM: number): number {
  if (distanceFromEndM >= cornerM) return 1;
  const t = 1 - Math.max(0, distanceFromEndM) / cornerM;
  return Math.sqrt(1 - t * t);
}

export function vehiclePlanOutline(vehicle: VehicleState): PlanOutline {
  const { bodyType } = vehicle.identity;
  const { lengthM, widthM, heightM, rideHeightM } = vehicle.dimensions;
  const shape = BODY_SHAPES[bodyType];
  const axles = axleLayout(vehicle.dimensions, bodyType);

  // Half-width along the car in 3D coordinates (+x toward the nose), from
  // xRear to xFront.
  let xFront: number;
  let xRear: number;
  let cornerM: number;
  let halfWidth: (x: number) => number;
  let levelsM: number[];
  if (shape.kind === "closed") {
    xFront = lengthM / 2;
    xRear = -lengthM / 2;
    cornerM = CLOSED_CORNER_M;
    halfWidth = (x) => (widthM / 2) * closedBodyPlanTaper(shape.spec, lengthM, x);
    const bodyH = heightM - rideHeightM;
    levelsM = [rideHeightM + 0.15 * bodyH, rideHeightM + 0.35 * bodyH];
  } else {
    // Open-wheeler at sidepod height: the spine, widened by the sidepods
    // alongside them.
    const { noseTipX, sidepodFrontX, sidepodRearX, gearboxEndX } = openWheelStations(lengthM, axles);
    const knots = openWheelPlanKnots(lengthM, axles);
    xFront = noseTipX;
    xRear = gearboxEndX;
    cornerM = OPEN_WHEEL_CORNER_M;
    halfWidth = (x) =>
      Math.max(
        lerpKnots(knots.spine, x),
        x >= sidepodRearX && x <= sidepodFrontX ? lerpKnots(knots.sidepod, x) : 0,
      ) / 2;
    levelsM = [0.2, 0.4];
  }

  const count = Math.max(8, Math.round((xFront - xRear) / OUTLINE_SPACING_M));
  const side: Vec2[] = [];
  for (let i = 0; i <= count; i++) {
    const x = xFront - ((xFront - xRear) * i) / count;
    const cap = capFactor(Math.min(xFront - x, x - xRear), cornerM);
    side.push({ x: -x, y: halfWidth(x) * cap });
  }
  // Nose to tail along y < 0, then back along y > 0: counter-clockwise.
  // The two end points have zero half-width, so they appear once each.
  const polygon = [
    ...side.map((p) => ({ x: p.x, y: -p.y })),
    ...side.slice(1, -1).reverse(),
  ];

  const xSeparation = -(xRear + cornerM);
  const baseHalfWidth = halfWidth(xRear + cornerM);
  return {
    key: `plan:${bodyType}:${lengthM}:${widthM}:${vehicle.dimensions.wheelbaseM}`,
    polygon,
    lengthM: xFront - xRear,
    maxHalfWidthM: Math.max(...side.map((p) => p.y)),
    wake: {
      xSeparation,
      xBase: xSeparation,
      yTop: baseHalfWidth,
      yBottom: -baseHalfWidth,
      baseHeightM: 2 * baseHalfWidth,
    },
    levelsM,
  };
}

// The same streamwise extent as the side section; across, enough room
// either side for the flow to straighten out again.
export function planDomain(outline: PlanOutline): FlowDomain {
  const xs = outline.polygon.map((p) => p.x);
  const xNose = Math.min(...xs);
  const xTail = Math.max(...xs);
  const w = 2 * outline.maxHalfWidthM;
  return {
    xMin: xNose - 0.3 * outline.lengthM,
    xMax: xTail + 0.9 * outline.lengthM,
    yMax: outline.maxHalfWidthM + Math.max(1.2, 0.8 * w),
  };
}

// Velocity anywhere across the car, from the sampled half: the y < 0 side
// is the mirror image, so its cross-flow flips sign.
export function planVelocityAt(grid: PlanFlowGrid, x: number, y: number, out: Vec2): boolean {
  const ok = velocityAt(grid, x, Math.abs(y), out);
  if (y < 0) out.y = -out.y;
  return ok;
}
