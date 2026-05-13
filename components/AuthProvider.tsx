"use client";

import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { auth, db } from "@/config/firebase";
import { ensureUserDocument, isAllowedEmail } from "@/lib/auth";
import { checkAllowedUser } from "@/lib/firestore";
import type { ForumUser } from "@/types";

type AuthState = {
  firebaseUser: User | null;
  forumUser: ForumUser | null;
  /** null = allowlist check still in progress; true/false = result */
  isAllowed: boolean | null;
  loading: boolean;
  refreshForumUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [forumUser, setForumUser] = useState<ForumUser | null>(null);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  // Holds the unsubscribe fn for the live user-doc listener so we can tear it down on sign-out.
  const userDocUnsubRef = useRef<(() => void) | null>(null);

  const refreshForumUser = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) {
      setForumUser(null);
      setIsAllowed(null);
      return;
    }
    // The live snapshot already keeps forumUser current; just re-check isAllowed.
    const allowed = await checkAllowedUser(u.uid, u.email ?? "");
    setIsAllowed(allowed);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      // Tear down any previous user-doc listener.
      userDocUnsubRef.current?.();
      userDocUnsubRef.current = null;

      setLoading(true);

      if (!user) {
        setFirebaseUser(null);
        setForumUser(null);
        setIsAllowed(null);
        setLoading(false);
        return;
      }

      if (!isAllowedEmail(user.email)) {
        await firebaseSignOut(auth);
        setFirebaseUser(null);
        setForumUser(null);
        setIsAllowed(null);
        setLoading(false);
        router.replace("/unauthorized");
        return;
      }

      setFirebaseUser(user);
      await ensureUserDocument(user);

      const allowed = await checkAllowedUser(user.uid, user.email ?? "");
      setIsAllowed(allowed);

      // Subscribe to the user doc so role changes made by admins propagate instantly.
      userDocUnsubRef.current = onSnapshot(doc(db, "users", user.uid), (snap) => {
        setForumUser(snap.exists() ? (snap.data() as ForumUser) : null);
      });

      setLoading(false);
    });

    return () => {
      unsub();
      userDocUnsubRef.current?.();
    };
  }, [router]);

  useEffect(() => {
    if (loading) return;
    if (firebaseUser && pathname === "/auth") {
      router.replace("/");
    }
  }, [firebaseUser, loading, pathname, router]);

  const value = useMemo(
    () => ({
      firebaseUser,
      forumUser,
      isAllowed,
      loading,
      refreshForumUser,
    }),
    [firebaseUser, forumUser, isAllowed, loading, refreshForumUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}
