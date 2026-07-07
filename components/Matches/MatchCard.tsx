import { CarSpec } from "@/lib/physics/types";

interface MatchCardProps {
  car: CarSpec;
  rank: number;
}

export default function MatchCard({ car, rank }: MatchCardProps) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 flex items-center gap-4">
      <div className="text-2xl font-mono font-black text-amber-400 w-8 text-center shrink-0">
        #{rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-slate-50 truncate">
          {car.year} {car.make} {car.model}
        </div>
        <div className="text-sm text-slate-400 font-mono">
          {car.cylinders}-cyl {car.layout} &middot; {car.displacementL.toFixed(1)}L &middot;{" "}
          {car.aspiration.toUpperCase()}
        </div>
      </div>
      <div className="text-right text-sm font-mono text-slate-300 shrink-0">
        <div>{car.hp} hp</div>
        <div>{car.zeroToHundredS.toFixed(1)}s 0-100</div>
      </div>
    </div>
  );
}
