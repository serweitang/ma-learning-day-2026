"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

type Props = {
  children: React.ReactNode;
};

/**
 * Wraps any page that requires the user to be both authenticated AND on the allowedUsers allowlist.
 * - Not logged in → redirect to /
 * - Logged in but not on allowlist → redirect to /
 * - Passes loading + allowlist check before rendering children (no flash of protected content)
 */
export function ProtectedRoute({ children }: Props) {
  const { firebaseUser, isAllowed, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!firebaseUser || isAllowed === false) {
      router.replace("/");
    }
  }, [firebaseUser, isAllowed, loading, router]);

  // Show spinner while auth resolves or allowlist check is in flight
  if (loading || isAllowed === null || !firebaseUser || isAllowed === false) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-garena-dark/60">
        Checking access…
      </div>
    );
  }

  return <>{children}</>;
}
