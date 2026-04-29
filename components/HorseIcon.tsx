"use client";

import { useAuth } from "@/components/AuthProvider";
import { useHorseGame } from "@/components/HorseProvider";

type Props = {
  id: string;
};

export function HorseIcon({ id }: Props) {
  const { firebaseUser } = useAuth();
  const { foundHorses, recordFound } = useHorseGame();

  if (!firebaseUser) return null;
  if (foundHorses.includes(id)) return null;

  return (
    <button
      type="button"
      onClick={() => void recordFound(id)}
      className="inline-block cursor-pointer select-none text-sm opacity-10 transition-opacity duration-200 hover:opacity-90 focus:outline-none"
      aria-label="???"
    >
      🐴
    </button>
  );
}
