import { TestType } from "./physics/types";

export const TEST_TYPE_LABELS: Record<TestType, string> = {
  zeroToHundred: "0–100 kph",
  tenSecond: "10s Run",
  drag500m: "500m Drag",
};

interface ResultHeadlineInput {
  testType: TestType;
  initialSpeedKph: number;
  elapsedS: number;
  finalSpeedKph: number;
  timedOut: boolean;
}

export function resultHeadline({
  testType,
  initialSpeedKph,
  elapsedS,
  finalSpeedKph,
  timedOut,
}: ResultHeadlineInput): { label: string; value: string; sub: string | null } {
  switch (testType) {
    case "zeroToHundred": {
      const startLabel = initialSpeedKph > 0 ? Math.round(initialSpeedKph) : 0;
      return {
        label: `${startLabel}–100 kph`,
        value: timedOut ? "Did not reach" : `${elapsedS.toFixed(2)}s`,
        sub: null,
      };
    }
    case "tenSecond":
      return {
        label: "Top Speed after 10s",
        value: `${Math.round(finalSpeedKph)} kph`,
        sub: null,
      };
    case "drag500m":
      return {
        label: "500m Drag",
        value: timedOut ? "Did not finish" : `${elapsedS.toFixed(2)}s`,
        sub: `Trap speed: ${Math.round(finalSpeedKph)} kph`,
      };
  }
}
