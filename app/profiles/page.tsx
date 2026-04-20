"use client";

import { useEffect, useState } from "react";
import { MACard } from "@/components/MACard";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { listMas } from "@/lib/firestore";
import type { MA } from "@/types";

export default function ProfilesPage() {
  return <ProtectedRoute><ProfilesContent /></ProtectedRoute>;
}

function ProfilesContent() {
  const [mas, setMas] = useState<MA[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await listMas();
        if (!cancelled) setMas(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load profiles");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-garena-dark/60">Loading profiles…</div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-bold text-garena-dark">Meet the Management Associates</h1>
      <p className="mt-2 max-w-2xl text-garena-dark/70">
        {mas.length > 0
          ? `${mas.length} MA${mas.length !== 1 ? "s" : ""} featured for MA Learning Day. Select a card to view their profile, memo, and discussion.`
          : "No profiles have been added yet."}
      </p>
      {error && (
        <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          {error}
        </p>
      )}
<div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mas.map((ma) => (
          <MACard key={ma.id} ma={ma} />
        ))}
      </div>
    </div>
  );
}
