"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import confetti from "canvas-confetti";
import { useAuth } from "@/components/AuthProvider";
import { getHorseGameDoc, recordHorseFound, TOTAL_HORSES } from "@/lib/horseGame";

type HorseContextType = {
  foundHorses: string[];
  recordFound: (horseId: string) => Promise<void>;
};

const HorseContext = createContext<HorseContextType | undefined>(undefined);

function fireConfetti() {
  const end = Date.now() + 3000;
  const colors = ["#E1251B", "#ffffff", "#ffd700"];
  (function burst() {
    confetti({
      particleCount: 6,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors,
    });
    confetti({
      particleCount: 6,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors,
    });
    if (Date.now() < end) requestAnimationFrame(burst);
  })();
}

export function HorseProvider({ children }: { children: React.ReactNode }) {
  const { firebaseUser } = useAuth();
  const [foundHorses, setFoundHorses] = useState<string[]>([]);
  const [toast, setToast] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!firebaseUser) {
      setFoundHorses([]);
      return;
    }
    void getHorseGameDoc(firebaseUser.uid).then((gameDoc) => {
      if (gameDoc) setFoundHorses(gameDoc.foundHorses ?? []);
    });
  }, [firebaseUser]);

  const recordFound = useCallback(
    async (horseId: string) => {
      if (!firebaseUser) return;
      const displayName =
        firebaseUser.displayName ?? firebaseUser.email ?? "Unknown";
      const wasNew = await recordHorseFound(firebaseUser.uid, horseId, displayName);
      if (wasNew) {
        setFoundHorses((prev) => {
          const next = [...prev, horseId];
          if (next.length === TOTAL_HORSES) {
            fireConfetti();
          }
          return next;
        });
        setToast(true);
        if (toastTimer.current) clearTimeout(toastTimer.current);
        toastTimer.current = setTimeout(() => setToast(false), 2000);
      }
    },
    [firebaseUser]
  );

  const value = useMemo(
    () => ({ foundHorses, recordFound }),
    [foundHorses, recordFound]
  );

  return (
    <HorseContext.Provider value={value}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-[999] -translate-x-1/2 rounded-xl bg-garena-dark px-6 py-3 text-sm font-semibold text-white shadow-xl"
        >
          Found the MA! 🐴
        </div>
      )}
    </HorseContext.Provider>
  );
}

export function useHorseGame(): HorseContextType {
  const ctx = useContext(HorseContext);
  if (!ctx) throw new Error("useHorseGame must be used within HorseProvider");
  return ctx;
}
