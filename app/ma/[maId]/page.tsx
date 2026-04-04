"use client";

import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { MAProfile } from "@/components/MAProfile";
import { getMa } from "@/lib/firestore";
import type { MA } from "@/types";

export default function MaDetailPage() {
  const params = useParams<{ maId: string }>();
  const raw = params?.maId;
  const maId = Array.isArray(raw) ? raw[0] : raw;
  const [ma, setMa] = useState<MA | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!maId) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await getMa(maId);
        if (!cancelled) setMa(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load MA");
        if (!cancelled) setMa(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [maId]);

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

  return <MAProfile initial={ma} />;
}
