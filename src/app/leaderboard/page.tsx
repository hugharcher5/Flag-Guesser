/**
 * Leaderboard hub — links to each game mode's leaderboard.
 * Add new entries to LEADERBOARDS to make them appear in the grid.
 */

export const dynamic = 'force-dynamic';

interface LeaderboardEntry {
  title: string;
  description: string;
  href: string;
  available: boolean;
  emoji: string;
}

const LEADERBOARDS: LeaderboardEntry[] = [
  {
    title: "Flag Guesser",
    description: "Top players by score and fastest completion time.",
    href: "/leaderboard/flag-guesser",
    available: true,
    emoji: "🚩",
  },
  {
    title: "Country Shape Guesser",
    description: "Guess the country from its silhouette in 6 tries.",
    href: "/leaderboard/shape-guesser",
    available: true,
    emoji: "🗺️",
  },
  {
    title: "Globe Guesser",
    description: "Find countries on the 3D globe with fewest guesses.",
    href: "/leaderboard/globe-guesser",
    available: true,
    emoji: "🌍",
  },
];

export default function LeaderboardHub() {
  return (
    <div className="min-h-[100dvh] bg-gray-50 flex flex-col items-center px-4 py-10">
      <div className="w-full max-w-2xl flex flex-col gap-8">

        {/* Header */}
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight text-gray-800">
            Leaderboards
          </h1>
          <p className="text-sm text-gray-500">
            See how you stack up against other players.
          </p>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {LEADERBOARDS.map((board) =>
            board.available ? (
              <a
                key={board.href}
                href={board.href}
                className="group bg-white rounded-2xl border border-gray-200 shadow-sm p-6
                           flex flex-col gap-3 hover:border-blue-300 hover:shadow-md
                           transition-all duration-150"
              >
                <span className="text-3xl">{board.emoji}</span>
                <div className="flex flex-col gap-1">
                  <span className="font-semibold text-gray-800 group-hover:text-blue-600 transition-colors">
                    {board.title}
                  </span>
                  <span className="text-sm text-gray-500">{board.description}</span>
                </div>
                <span className="mt-auto text-xs font-semibold text-blue-600 group-hover:underline">
                  View leaderboard →
                </span>
              </a>
            ) : (
              <div
                key={board.href}
                className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6
                           flex flex-col gap-3 opacity-60 cursor-default"
              >
                <span className="text-3xl">{board.emoji}</span>
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{board.title}</span>
                    <span className="text-xs font-semibold text-gray-400 bg-gray-100 rounded-full px-2 py-0.5">
                      Coming soon
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">{board.description}</span>
                </div>
              </div>
            )
          )}
        </div>

        {/* Back link */}
        <a
          href="/"
          className="self-start text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          ← Back to games
        </a>

      </div>
    </div>
  );
}
