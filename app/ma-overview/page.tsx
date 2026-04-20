"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { listMas } from "@/lib/firestore";
import type { MA, Rotation } from "@/types";

const LABEL_ORDER: Record<string, number> = { R1: 1, R2: 2, R3: 3, R4: 4 };

function currentRotation(ma: MA): Rotation | null {
  if (!ma.rotations.length) return null;
  return ma.rotations.reduce((best, r) =>
    LABEL_ORDER[r.label] > LABEL_ORDER[best.label] ? r : best
  );
}

function resolvePhotoUrl(url: string): string {
  const match = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
  return url;
}

function Avatar({ name, photoSrc }: { name: string; photoSrc: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !photoSrc) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-garena-bg text-sm font-bold text-garena-dark/40">
        {name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={photoSrc}
      alt={name}
      className="h-10 w-10 rounded-full border border-black/10 object-cover object-top"
      onError={() => setFailed(true)}
    />
  );
}

export default function MAOverviewPage() {
  return <ProtectedRoute><MAOverviewContent /></ProtectedRoute>;
}

function MAOverviewContent() {
  const { firebaseUser } = useAuth();
  const [mas, setMas] = useState<MA[]>([]);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!firebaseUser) return;
    void (async () => {
      try {
        const data = await listMas();
        // Sort by joinYear asc (nulls last), preserving existing relative order within same year
        data.sort((a, b) => {
          if (a.joinYear === b.joinYear) return 0;
          if (a.joinYear === null) return 1;
          if (b.joinYear === null) return -1;
          return a.joinYear - b.joinYear;
        });
        setMas(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
      } finally {
        setFetching(false);
      }
    })();
  }, [firebaseUser]);

  if (fetching) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-garena-dark/60">Loading…</div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-garena-dark">MA Overview</h1>
      <p className="mt-1 text-garena-dark/60">
        All MAs, their cohort year, and current rotation.
      </p>

      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-black/5 text-sm">
          <thead className="bg-garena-bg/80 text-xs font-semibold uppercase tracking-wide text-garena-dark/60">
            <tr>
              <th className="w-12 px-4 py-3" />
              <th className="px-2 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Join Year</th>
              <th className="px-4 py-3 text-left">Current Rotation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/5">
            {mas.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-garena-dark/50">
                  No MAs found.
                </td>
              </tr>
            )}
            {mas.map((ma) => {
              const current = currentRotation(ma);
              const staticPath = `/ma-photos/${ma.name.toLowerCase().replace(/\s+/g, "-")}.jpg`;
              const photoSrc = resolvePhotoUrl(ma.photoURL || staticPath);
              return (
                <tr key={ma.id} className="transition-colors hover:bg-garena-bg/40">
                  <td className="py-3 pl-4 pr-2">
                    <Avatar name={ma.name} photoSrc={photoSrc} />
                  </td>
                  <td className="px-2 py-3 font-medium">
                    <Link href={`/ma/${ma.id}`} className="hover:text-garena-red">
                      {ma.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-garena-dark/70">
                    {ma.joinYear ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {current ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-garena-red/10 px-2 py-0.5 text-xs font-semibold text-garena-red">
                          {current.label}
                        </span>
                        <span className="text-garena-dark">{current.department}</span>
                      </span>
                    ) : (
                      <span className="text-garena-dark/40">No rotation yet</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
