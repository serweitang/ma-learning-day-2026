"use client";

import { onAuthStateChanged, signOut as firebaseSignOut, type User } from "firebase/auth";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { auth } from "@/config/firebase";
import { ensureUserDocument, getForumUser, isAllowedEmail } from "@/lib/auth";
import type { ForumUser } from "@/types";

type AuthState = {
  firebaseUser: User | null;
  forumUser: ForumUser | null;
  loading: boolean;
  refreshForumUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [forumUser, setForumUser] = useState<ForumUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshForumUser = useCallback(async () => {
    const u = auth.currentUser;
    if (!u) {
      setForumUser(null);
      return;
    }
    const docUser = await getForumUser(u.uid);
    setForumUser(docUser);
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setLoading(true);

      if (!user) {
        setFirebaseUser(null);
        setForumUser(null);
        setLoading(false);
        return;
      }

      if (!isAllowedEmail(user.email)) {
        await firebaseSignOut(auth);
        setFirebaseUser(null);
        setForumUser(null);
        setLoading(false);
        router.replace("/unauthorized");
        return;
      }

      setFirebaseUser(user);
      await ensureUserDocument(user);
      const docUser = await getForumUser(user.uid);
      setForumUser(docUser);
      setLoading(false);
    });

    return () => unsub();
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
      loading,
      refreshForumUser,
    }),
    [firebaseUser, forumUser, loading, refreshForumUser]
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
