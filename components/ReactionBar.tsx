"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  getUserReaction,
  setUserReaction,
  subscribeReactionCounts,
  type ReactionCounts,
} from "@/lib/firestore";
import type { ReactionType } from "@/types";

const BUTTONS: { type: ReactionType; icon: string; label: string }[] = [
  { type: "like", icon: "👍", label: "Like" },
  { type: "heart", icon: "❤️", label: "Heart" },
  { type: "insightful", icon: "💡", label: "Insightful" },
  { type: "confused", icon: "😕", label: "Confused" },
];

type Props = {
  maId: string;
};

export function ReactionBar({ maId }: Props) {
  const { firebaseUser } = useAuth();
  const [counts, setCounts] = useState<ReactionCounts>({
    like: 0,
    heart: 0,
    insightful: 0,
    confused: 0,
  });
  const [mine, setMine] = useState<ReactionType | null>(null);

  useEffect(() => {
    const unsub = subscribeReactionCounts(maId, setCounts);
    return () => unsub();
  }, [maId]);

  useEffect(() => {
    if (!firebaseUser) {
      setMine(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const r = await getUserReaction(maId, firebaseUser.uid);
      if (!cancelled) setMine(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [firebaseUser, maId]);

  const toggle = async (type: ReactionType) => {
    if (!firebaseUser) return;
    const next = mine === type ? null : type;
    await setUserReaction(maId, firebaseUser.uid, next);
    setMine(next);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-black/10 bg-white px-3 py-2">
      <span className="text-sm font-medium text-garena-dark">Reactions</span>
      {!firebaseUser && (
        <span className="text-xs text-garena-dark/50">Sign in to react.</span>
      )}
      {BUTTONS.map(({ type, icon, label }) => (
        <button
          key={type}
          type="button"
          disabled={!firebaseUser}
          title={label}
          className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-sm transition ${
            mine === type
              ? "border-garena-red bg-garena-red/10"
              : "border-black/10 hover:border-garena-red/40"
          } disabled:cursor-not-allowed disabled:opacity-50`}
          onClick={() => void toggle(type)}
        >
          <span aria-hidden>{icon}</span>
          <span className="text-xs font-semibold text-garena-dark">{counts[type]}</span>
        </button>
      ))}
    </div>
  );
}
