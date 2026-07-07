import { MatchResult } from "@/lib/physics/types";
import MatchCard from "./MatchCard";

interface MatchListProps {
  matches: MatchResult[];
}

export default function MatchList({ matches }: MatchListProps) {
  return (
    <div className="w-full max-w-3xl mx-auto space-y-3">
      <h3 className="text-lg font-semibold text-slate-200">
        Closest Real-World Matches
      </h3>
      <div className="space-y-2">
        {matches.map((m, i) => (
          <MatchCard key={`${m.car.make}-${m.car.model}`} car={m.car} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}
