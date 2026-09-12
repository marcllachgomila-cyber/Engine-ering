const LAUNCH_RATIO = 3.6;

// Reference top-gear ratio for a 6-speed box. More gears spread the same
// launch-to-top range further, so each extra gear makes top gear ~7%
// taller (numerically lower); fewer gears make it shorter. This is what
// lets picking more gears meaningfully raise theoretical top speed, the
// same way a taller final-drive/overdrive gear does in a real car.
const TOP_RATIO_AT_SIX_SPEED = 0.85;
const TOP_RATIO_STEP = 0.93;

export const MIN_GEAR_RATIO = 0.4;
export const MAX_GEAR_RATIO = 5;

// The recommended ratio spread for a given gear count - evenly spaced
// (geometrically) between a fixed launch ratio and a gear-count-scaled top
// ratio. Used both as the default gear ratios and as the reset target when
// a driver wants to back out of a custom spread.
export function recommendedGearRatios(gearCount: number): number[] {
  const topRatio = TOP_RATIO_AT_SIX_SPEED * Math.pow(TOP_RATIO_STEP, gearCount - 6);
  return Array.from({ length: gearCount }, (_, i) =>
    LAUNCH_RATIO * Math.pow(topRatio / LAUNCH_RATIO, i / (gearCount - 1)),
  );
}
