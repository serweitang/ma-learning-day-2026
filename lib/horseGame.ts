import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  getDocs,
  serverTimestamp,
  arrayUnion,
} from "firebase/firestore";
import { db } from "@/config/firebase";

export const TOTAL_HORSES = 10;

export interface HorseGameDoc {
  foundHorses: string[];
  totalFound: number;
  displayName: string;
  lastFoundAt: { toDate(): Date } | null;
}

export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  totalFound: number;
  lastFoundAt: Date | null;
}

export async function getHorseGameDoc(userId: string): Promise<HorseGameDoc | null> {
  const ref = doc(db, "horseGame", userId);
  const snap = await getDoc(ref);
  return snap.exists() ? (snap.data() as HorseGameDoc) : null;
}

/** Records a horse as found. Returns true if it was a new find, false if already found. */
export async function recordHorseFound(
  userId: string,
  horseId: string,
  displayName: string
): Promise<boolean> {
  const ref = doc(db, "horseGame", userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    await setDoc(ref, {
      foundHorses: [horseId],
      totalFound: 1,
      displayName,
      lastFoundAt: serverTimestamp(),
    });
    return true;
  }

  const data = snap.data() as HorseGameDoc;
  if ((data.foundHorses ?? []).includes(horseId)) return false;

  await updateDoc(ref, {
    foundHorses: arrayUnion(horseId),
    totalFound: (data.totalFound || 0) + 1,
    displayName,
    lastFoundAt: serverTimestamp(),
  });
  return true;
}

export async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const q = query(
      collection(db, "horseGame"),
      orderBy("totalFound", "desc"),
      orderBy("lastFoundAt", "asc")
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => {
      const data = d.data() as HorseGameDoc;
      return {
        uid: d.id,
        displayName: data.displayName ?? "Unknown",
        totalFound: data.totalFound ?? 0,
        lastFoundAt: data.lastFoundAt?.toDate?.() ?? null,
      };
    });
  } catch (e) {
    // Index still building — fetch without ordering and sort client-side
    const snap = await getDocs(collection(db, "horseGame"));
    const entries = snap.docs.map((d) => {
      const data = d.data() as HorseGameDoc;
      return {
        uid: d.id,
        displayName: data.displayName ?? "Unknown",
        totalFound: data.totalFound ?? 0,
        lastFoundAt: data.lastFoundAt?.toDate?.() ?? null,
      };
    });
    return entries.sort((a, b) => {
      if (b.totalFound !== a.totalFound) return b.totalFound - a.totalFound;
      const at = a.lastFoundAt?.getTime() ?? Infinity;
      const bt = b.lastFoundAt?.getTime() ?? Infinity;
      return at - bt;
    });
  }
}
