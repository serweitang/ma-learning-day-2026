"use client";

import { useRouter } from "next/navigation";
import { useEffect, type ComponentType } from "react";
import { useAuth } from "@/components/AuthProvider";

type Props = {
  children: React.ReactNode;
};

/**
 * Client-side gate for admin-only routes.
 * TODO: Enforce the same rules with Firestore Security Rules (defence in depth).
 */
export function AdminGuard({ children }: Props) {
  const { forumUser, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!forumUser || forumUser.role !== "admin") {
      router.replace("/unauthorized");
    }
  }, [forumUser, loading, router]);

  if (loading || !forumUser || forumUser.role !== "admin") {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-garena-dark/60">
        Checking access…
      </div>
    );
  }

  return <>{children}</>;
}

/** HOC variant — wraps a page/component with the same admin check as `<AdminGuard>`. */
export function withAdminGuard<P extends object>(Component: ComponentType<P>) {
  function WithAdminGuard(props: P) {
    return (
      <AdminGuard>
        <Component {...props} />
      </AdminGuard>
    );
  }
  const name = Component.displayName ?? Component.name ?? "Component";
  WithAdminGuard.displayName = `withAdminGuard(${name})`;
  return WithAdminGuard;
}
