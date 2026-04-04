"use client";

import { useAuth } from "@/components/AuthProvider";
import { signInWithGoogle } from "@/lib/auth";
import { useState } from "react";

export default function AuthPage() {
  const { loading, firebaseUser } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-garena-dark/60">Loading…</div>
    );
  }

  if (firebaseUser) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-garena-dark">You are signed in. Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold text-garena-dark">Sign in</h1>
      <p className="mt-2 text-sm text-garena-dark/70">
        Use your Garena Google account. Only <strong>@garena.com</strong> emails can access this forum.
      </p>
      {error && (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}
      <button
        type="button"
        disabled={busy}
        onClick={() => void onSignIn()}
        className="mt-8 flex w-full items-center justify-center gap-2 rounded-lg border border-black/10 bg-white px-4 py-3 font-medium text-garena-dark shadow-sm hover:bg-garena-bg disabled:opacity-50"
      >
        <GoogleMark />
        Continue with Google
      </button>
      <p className="mt-6 text-xs text-garena-dark/50">
        {/* TODO: Enable Google provider + authorized domains in Firebase Console → Authentication. */}
        First-time users receive the <code className="rounded bg-black/5 px-1">viewer</code> role unless an admin invite
        or the default admin email applies.
      </p>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#FFC107"
        d="M43.611 20.083H42V20H24v8h11.303C33.42 32.583 29.218 36 24 36c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.047 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"
      />
      <path
        fill="#FF3D00"
        d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.047 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.972 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"
      />
    </svg>
  );
}
