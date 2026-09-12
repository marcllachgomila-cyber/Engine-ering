import { CarSpec } from "@/lib/physics/types";

interface MatchCardProps {
  car: CarSpec;
  rank: number;
}

function photoSearchUrl(car: CarSpec): string {
  const query = encodeURIComponent(`${car.year} ${car.make} ${car.model}`);
  return `https://www.google.com/search?tbm=isch&q=${query}`;
}

export default function MatchCard({ car, rank }: MatchCardProps) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/85 backdrop-blur-md p-4 flex items-center gap-4">
      <div className="text-2xl font-mono font-black text-amber-400 w-8 text-center shrink-0">
        #{rank}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-zinc-50 truncate">
          {car.year} {car.make} {car.model}
        </div>
        <div className="text-sm text-zinc-400 font-mono">
          {car.cylinders}-cyl {car.layout} &middot; {car.displacementL.toFixed(1)}L &middot;{" "}
          {car.aspiration.toUpperCase()}
        </div>
        <a
          href={photoSearchUrl(car)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 mt-1 text-xs text-sky-400 hover:text-sky-300 transition-colors"
        >
          View photos
          <svg
            width={10}
            height={10}
            viewBox="0 0 10 10"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M2 8L8 2M8 2H3M8 2V7"
              stroke="currentColor"
              strokeWidth={1.3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      </div>
      <div className="text-right text-sm font-mono text-zinc-300 shrink-0">
        <div>{car.hp} hp</div>
        <div>{car.zeroToHundredS.toFixed(1)}s 0-100</div>
      </div>
    </div>
  );
}
