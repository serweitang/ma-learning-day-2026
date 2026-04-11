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
import { ADMIN_EMAIL } from "@/lib/constants";
import { userEmailDocId } from "@/lib/firestore";
import type { ForumUser, UserRole } from "@/types";

const googleProvider = new GoogleAuthProvider();

/**
 * Allows any @garena.* or @sea.* domain (e.g. @garena.com, @garena.sg, @sea.com.my).
 * Also allows individual emails listed in NEXT_PUBLIC_ALLOWED_EMAILS (comma-separated).
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const whitelist = (process.env.NEXT_PUBLIC_ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (whitelist.includes(email.toLowerCase())) return true;
  return /^[^@]+@(garena|sea)\..+$/i.test(email);
}

export async function signInWithGoogle(): Promise<void> {
  await signInWithPopup(auth, googleProvider);
}

export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Ensures a `users/{uid}` document exists on Google sign-in.
 * - If a pre-created `pendingUsers` doc matches the email, promotes it and deletes the pending doc.
 * - Otherwise creates a new viewer account.
 * - ADMIN_EMAIL always receives the admin role.
 */
export async function ensureUserDocument(firebaseUser: User): Promise<ForumUser | null> {
  const email = firebaseUser.email;
  if (!email) return null;

  const userRef = doc(db, "users", firebaseUser.uid);
  const snap = await getDoc(userRef);
  if (snap.exists()) {
    return snap.data() as ForumUser;
  }

  let role: UserRole = "viewer";
  let maId: string | null = null;
  let displayName = firebaseUser.displayName ?? email.split("@")[0] ?? "User";

  // Check for an admin-created user doc keyed by email — migrate it to UID key
  const emailRef = doc(db, "users", userEmailDocId(email));
  const emailSnap = await getDoc(emailRef);
  if (emailSnap.exists()) {
    const pre = emailSnap.data() as { displayName?: string; role?: UserRole; maId?: string | null };
    if (pre.role) role = pre.role;
    if (pre.maId !== undefined) maId = pre.maId ?? null;
    if (pre.displayName) displayName = pre.displayName;
    await deleteDoc(emailRef);
  }

  if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    role = "admin";
  }

  const forumUser: Omit<ForumUser, "createdAt"> & { createdAt: ReturnType<typeof serverTimestamp> } = {
    uid: firebaseUser.uid,
    email,
    displayName,
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
