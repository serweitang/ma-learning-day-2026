import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  deleteDoc,
} from "firebase/firestore";
import { auth, db } from "@/config/firebase";
import { ADMIN_EMAIL, GARENA_EMAIL_SUFFIX } from "@/lib/constants";
import type { ForumUser, UserRole } from "@/types";

const googleProvider = new GoogleAuthProvider();

export function isGarenaEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.toLowerCase().endsWith(GARENA_EMAIL_SUFFIX.toLowerCase());
}

function inviteDocId(email: string): string {
  return email.toLowerCase().replace(/[.#$[\]/]/g, "_");
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, googleProvider);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Creates the Firestore `users/{uid}` document on first @garena.com login.
 * Applies `userInvites/{id}` role (and optional `maId`) if present, then removes the invite.
 */
export async function ensureUserDocument(firebaseUser: User): Promise<ForumUser | null> {
  const email = firebaseUser.email;
  if (!email || !isGarenaEmail(email)) return null;

  const userRef = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(userRef);

  if (snap.exists()) {
    return snap.data() as ForumUser;
  }

  let role: UserRole = "viewer";
  let maId: string | null = null;

  const inviteRef = doc(db, "userInvites", inviteDocId(email));
  const inviteSnap = await getDoc(inviteRef);
  if (inviteSnap.exists()) {
    const inv = inviteSnap.data() as { role?: UserRole; maId?: string | null };
    if (inv.role) role = inv.role;
    if (inv.maId !== undefined) maId = inv.maId;
    await deleteDoc(inviteRef);
  }

  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    role = "admin";
  }

  const forumUser: Omit<ForumUser, "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    uid: firebaseUser.uid,
    email,
    displayName: firebaseUser.displayName ?? email.split("@")[0] ?? "User",
    photoURL: firebaseUser.photoURL ?? "",
    role,
    maId: maId ?? null,
    createdAt: serverTimestamp(),
  };

  await setDoc(userRef, forumUser);
  const created = await getDoc(userRef);
  return created.data() as ForumUser;
}

export async function getForumUser(uid: string): Promise<ForumUser | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  return snap.data() as ForumUser;
}

export function canEditMaProfile(
  forumUser: ForumUser | null,
  maId: string
): boolean {
  if (!forumUser) return false;
  if (forumUser.role === "admin") return true;
  if (forumUser.role === "ma" && forumUser.maId === maId) return true;
  return false;
}

export function canUploadMemo(forumUser: ForumUser | null, maId: string): boolean {
  return canEditMaProfile(forumUser, maId);
}

export function canDeleteAnyComment(forumUser: ForumUser | null): boolean {
  return forumUser?.role === "admin";
}
