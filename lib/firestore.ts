import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "@/config/firebase";
import type { Comment, ForumUser, MA, Reaction, ReactionType, UserRole } from "@/types";

function reactionDocId(maId: string, authorUid: string): string {
  return `${maId}_${authorUid}`;
}

export async function listMas(): Promise<MA[]> {
  const snap = await getDocs(collection(db, "mas"));
  const mas = snap.docs.map((d) => normaliseMa(d.id, d.data()));
  return mas.sort((a, b) => {
    if (a.order !== null && b.order !== null) return a.order - b.order;
    if (a.order !== null) return -1;
    if (b.order !== null) return 1;
    return a.name.localeCompare(b.name);
  });
}

export async function updateMaBulk(
  updates: { id: string; order: number; isPresenting: boolean | null }[]
): Promise<void> {
  const batch = writeBatch(db);
  for (const { id, order, isPresenting } of updates) {
    batch.update(doc(db, "mas", id), { order, isPresenting });
  }
  await batch.commit();
}

export async function getMa(maId: string): Promise<MA | null> {
  const snap = await getDoc(doc(db, "mas", maId));
  if (!snap.exists()) return null;
  return normaliseMa(snap.id, snap.data());
}

function normaliseMa(id: string, data: ReturnType<typeof Object.create>): MA {
  return {
    id,
    name: data.name ?? "",
    department: data.department ?? "",
    joinYear: data.joinYear ?? null,
    photoURL: data.photoURL ?? "",
    bio: data.bio ?? "",
    hasMemo: data.hasMemo ?? false,
    memoURL: data.memoURL ?? null,
    memoUploadedAt: data.memoUploadedAt ?? null,
    updatedAt: data.updatedAt ?? null,
    order: data.order ?? null,
    isPresenting: data.isPresenting ?? null,
  };
}

export async function createMa(data: { name: string; department: string; bio: string; joinYear?: number | null }): Promise<string> {
  const ref = await addDoc(collection(db, "mas"), {
    name: data.name.trim(),
    department: data.department.trim(),
    bio: data.bio.trim(),
    joinYear: data.joinYear ?? null,
    photoURL: "",
    hasMemo: false,
    memoURL: null,
    memoUploadedAt: null,
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function deleteMa(maId: string): Promise<void> {
  await deleteDoc(doc(db, "mas", maId));
}

export async function updateMaBio(maId: string, bio: string): Promise<void> {
  await setDoc(
    doc(db, "mas", maId),
    {
      bio,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export async function setMaMemoUploaded(maId: string, memoURL: string): Promise<void> {
  await setDoc(
    doc(db, "mas", maId),
    {
      hasMemo: true,
      memoURL,
      memoUploadedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}

export function subscribeComments(
  maId: string,
  onUpdate: (comments: Comment[]) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  // Requires composite index: comments — maId ASC, createdAt ASC (see `firestore.indexes.json`).
  const q = query(
    collection(db, "comments"),
    where("maId", "==", maId),
    orderBy("createdAt", "asc")
  );
  return onSnapshot(
    q,
    (snap) => {
      const comments = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Comment, "id">) }));
      onUpdate(comments);
    },
    (err) => onError?.(err)
  );
}

export async function addComment(input: {
  maId: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  content: string;
}): Promise<void> {
  await addDoc(collection(db, "comments"), {
    ...input,
    createdAt: serverTimestamp(),
    editedAt: null,
    isEdited: false,
  });
}

export async function updateComment(commentId: string, content: string): Promise<void> {
  await updateDoc(doc(db, "comments", commentId), {
    content,
    editedAt: serverTimestamp(),
    isEdited: true,
  });
}

export async function deleteComment(commentId: string): Promise<void> {
  await deleteDoc(doc(db, "comments", commentId));
}

export type ReactionCounts = Record<ReactionType, number>;

export async function getReactionCounts(maId: string): Promise<ReactionCounts> {
  const snap = await getDocs(query(collection(db, "reactions"), where("maId", "==", maId)));
  const counts: ReactionCounts = { like: 0, heart: 0, insightful: 0, confused: 0 };
  snap.docs.forEach((d) => {
    const t = (d.data() as Reaction).type;
    if (t in counts) counts[t] += 1;
  });
  return counts;
}

export function subscribeReactionCounts(
  maId: string,
  onUpdate: (counts: ReactionCounts) => void,
  onError?: (e: Error) => void
): Unsubscribe {
  const q = query(collection(db, "reactions"), where("maId", "==", maId));
  return onSnapshot(
    q,
    (snap) => {
      const counts: ReactionCounts = { like: 0, heart: 0, insightful: 0, confused: 0 };
      snap.docs.forEach((d) => {
        const t = (d.data() as Reaction).type;
        if (t in counts) counts[t] += 1;
      });
      onUpdate(counts);
    },
    (err) => onError?.(err)
  );
}

export async function getUserReaction(maId: string, authorUid: string): Promise<ReactionType | null> {
  const id = reactionDocId(maId, authorUid);
  const snap = await getDoc(doc(db, "reactions", id));
  if (!snap.exists()) return null;
  return (snap.data() as Reaction).type;
}

export async function setUserReaction(
  maId: string,
  authorUid: string,
  type: ReactionType | null
): Promise<void> {
  const id = reactionDocId(maId, authorUid);
  const refDoc = doc(db, "reactions", id);
  if (type === null) {
    try {
      await deleteDoc(refDoc);
    } catch {
      /* noop */
    }
    return;
  }
  await setDoc(refDoc, {
    id,
    maId,
    authorUid,
    type,
  });
}

export async function listUsers(): Promise<ForumUser[]> {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => d.data() as ForumUser);
}

export async function updateUserRole(uid: string, role: UserRole, maId?: string | null): Promise<void> {
  const payload: Record<string, unknown> = { role };
  if (role === "ma") {
    payload.maId = maId ?? null;
  } else {
    payload.maId = null;
  }
  await updateDoc(doc(db, "users", uid), payload);
}

export function userEmailDocId(email: string): string {
  return email.trim().toLowerCase().replace(/[.#$[\]/]/g, "_");
}

/**
 * Creates a user doc in `users` keyed by sanitized email.
 * On first Google sign-in, `ensureUserDocument` migrates it to `users/{uid}`.
 */
export async function createUser(data: {
  name: string;
  email: string;
  role: UserRole;
  maId?: string | null;
}): Promise<void> {
  const norm = data.email.trim().toLowerCase();
  await setDoc(doc(db, "users", userEmailDocId(norm)), {
    uid: null,
    displayName: data.name.trim(),
    email: norm,
    photoURL: "",
    role: data.role,
    maId: data.maId ?? null,
    createdAt: serverTimestamp(),
  });
}

export async function getUserByEmail(email: string): Promise<ForumUser | null> {
  const snap = await getDoc(doc(db, "users", userEmailDocId(email)));
  if (!snap.exists()) return null;
  return snap.data() as ForumUser;
}
