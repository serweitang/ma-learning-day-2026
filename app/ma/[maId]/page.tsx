"use client";

import { notFound, useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { MAProfile } from "@/components/MAProfile";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { getMa, listMas } from "@/lib/firestore";
import type { MA } from "@/types";

export default function MaDetailPage() {
  return <ProtectedRoute><MaDetailContent /></ProtectedRoute>;
}

function MaDetailContent() {
  const params = useParams<{ maId: string }>();
  const raw = params?.maId;
  const maId = Array.isArray(raw) ? raw[0] : raw;
  const router = useRouter();
  const [ma, setMa] = useState<MA | null | undefined>(undefined);
  const [allMas, setAllMas] = useState<MA[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!maId) return;
    let cancelled = false;
    void (async () => {
      try {
        const [data, all] = await Promise.all([getMa(maId), listMas()]);
        if (!cancelled) {
          setMa(data);
          setAllMas(all);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load MA");
        if (!cancelled) setMa(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [maId]);

  const currentIndex = allMas.findIndex((m) => m.id === maId);
  const prevMa = currentIndex > 0 ? allMas[currentIndex - 1] : null;
  const nextMa = currentIndex >= 0 && currentIndex < allMas.length - 1 ? allMas[currentIndex + 1] : null;

  if (ma === undefined && !error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-garena-dark/60">Loading profile…</div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl px-4 py-16 text-center text-red-700">
        <p>{error}</p>
      </div>
    );
  }

  if (!ma) {
    notFound();
  }

  return (
    <>
      <MAProfile initial={ma} />

      {prevMa && (
        <button
          onClick={() => router.push(`/ma/${prevMa.id}`)}
          className="fixed left-3 top-1/2 -translate-y-1/2 group z-50 flex h-10 w-10 items-center justify-center rounded-full bg-gray-200/80 shadow-sm transition-colors hover:bg-gray-300"
        >
          <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="pointer-events-none absolute left-12 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            Previous profile
          </span>
        </button>
      )}

      {nextMa && (
        <button
          onClick={() => router.push(`/ma/${nextMa.id}`)}
          className="fixed right-3 top-1/2 -translate-y-1/2 group z-50 flex h-10 w-10 items-center justify-center rounded-full bg-gray-200/80 shadow-sm transition-colors hover:bg-gray-300"
        >
          <svg className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="pointer-events-none absolute right-12 whitespace-nowrap rounded bg-gray-800 px-2 py-1 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
            Next profile
          </span>
        </button>
      )}
    </>
  );
}
