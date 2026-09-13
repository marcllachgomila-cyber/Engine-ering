import { getCircuit } from "./physics/circuits";
import { TestType } from "./physics/types";

export const TEST_TYPE_LABELS: Record<TestType, string> = {
  zeroToHundred: "0–100 kph",
  tenSecond: "10s Run",
  drag500m: "500m Drag",
  braking: "Braking Test",
  hotLap: "Hot Lap",
};

interface ResultHeadlineInput {
  testType: TestType;
  initialSpeedKph: number;
  elapsedS: number;
  finalSpeedKph: number;
  timedOut: boolean;
  finalDistanceM?: number;
  circuitId?: string;
}

export function resultHeadline({
  testType,
  initialSpeedKph,
  elapsedS,
  finalSpeedKph,
  timedOut,
  finalDistanceM,
  circuitId,
}: ResultHeadlineInput): { label: string; value: string; sub: string | null } {
  switch (testType) {
    case "hotLap": {
      const circuit = circuitId ? getCircuit(circuitId) : null;
      return {
        label: circuit?.name ?? "Hot Lap",
        value: `${elapsedS.toFixed(3)}s`,
        sub: circuit
          ? `${(circuit.lengthM / 1000).toFixed(3)} km · ${circuit.corners} corners`
          : null,
      };
    }
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
    case "braking":
      return {
        label: `Braking from ${Math.round(initialSpeedKph)} kph`,
        value: timedOut ? "Did not stop" : `${elapsedS.toFixed(2)}s`,
        sub:
          finalDistanceM !== undefined
            ? `Stopping distance: ${Math.round(finalDistanceM)}m`
            : null,
      };
  }
}
