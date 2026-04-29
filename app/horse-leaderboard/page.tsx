"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getLeaderboard, TOTAL_HORSES, type LeaderboardEntry } from "@/lib/horseGame";
import { useHorseGame } from "@/components/HorseProvider";

export default function HorseLeaderboardPage() {
  return (
    <ProtectedRoute>
      <HorseLeaderboardContent />
    </ProtectedRoute>
  );
}

function HorseLeaderboardContent() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const { foundHorses } = useHorseGame();

  useEffect(() => {
    getLeaderboard()
      .then(setEntries)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <div className="flex items-center gap-2">
        <h1 className="text-3xl font-bold text-garena-dark">Find the MA 🐴</h1>
      </div>
      <p className="mt-2 text-garena-dark/60">
        Hidden horse icons are scattered across the site. Hunt them all down — {TOTAL_HORSES} total.
      </p>
      <p className="mt-1 text-sm font-medium text-garena-red">
        Your score: {foundHorses.length} / {TOTAL_HORSES}
      </p>

      <div className="mt-8 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        {loading ? (
          <div className="flex min-h-[120px] items-center justify-center text-garena-dark/50">
            Loading…
          </div>
        ) : entries.length === 0 ? (
          <div className="px-6 py-10 text-center text-garena-dark/50">
            No one has found a horse yet. Be the first!
          </div>
        ) : (
          <table className="min-w-full divide-y divide-black/5 text-sm">
            <thead className="bg-garena-bg/80 text-xs font-semibold uppercase tracking-wide text-garena-dark/60">
              <tr>
                <th className="w-12 px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Name</th>
                <th className="px-4 py-3 text-right">Found</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {entries.map((entry, i) => (
                <tr
                  key={entry.uid}
                  className={i === 0 ? "bg-yellow-50" : "hover:bg-garena-bg/30"}
                >
                  <td className="px-4 py-3 font-bold text-garena-dark/40">
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                  </td>
                  <td className="px-4 py-3 font-medium text-garena-dark">
                    {entry.displayName}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-garena-dark">
                    {entry.totalFound}
                    <span className="ml-1 font-normal text-garena-dark/40">
                      / {TOTAL_HORSES}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-garena-dark/40">
        <Link href="/" className="hover:text-garena-red">
          ← Back to home
        </Link>
      </p>
    </div>
  );
}
