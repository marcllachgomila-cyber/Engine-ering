import { MatchResult } from "@/lib/physics/types";
import { SectionTag } from "@/components/EngineBuilder/FormControls";
import MatchCard from "./MatchCard";

interface MatchListProps {
  matches: MatchResult[];
}

export default function MatchList({ matches }: MatchListProps) {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-4">
      <SectionTag>Closest Real-World Matches</SectionTag>
      <div className="space-y-2.5">
        {matches.map((m, i) => (
          <MatchCard key={`${m.car.make}-${m.car.model}`} car={m.car} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
