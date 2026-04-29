"use client";

import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { signOut } from "@/lib/auth";

export default function HomePage() {
  const { firebaseUser, isAllowed, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-garena-dark/60">
        Loading…
      </div>
    );
  }

  // Logged in but allowlist check still resolving
  if (firebaseUser && isAllowed === null) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center text-garena-dark/60">
        Checking access…
      </div>
    );
  }

  // Logged in but NOT on the allowlist
  if (firebaseUser && isAllowed === false) {
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-md text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-garena-red">
            Garena · Internal
          </p>
          <h1 className="mt-3 text-2xl font-bold text-garena-dark">
            Access not yet granted
          </h1>
          <p className="mt-4 text-garena-dark/70">
            Your account{" "}
            <span className="font-medium text-garena-dark">{firebaseUser.email}</span>{" "}
            is not on the access list. Please contact an admin to request access.
          </p>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-8 rounded-lg border border-black/15 px-5 py-2.5 text-sm font-medium text-garena-dark hover:bg-garena-bg"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Logged in and allowed
  if (firebaseUser && isAllowed) {
    const firstName = firebaseUser.displayName?.split(" ")[0] ?? "there";
    return (
      <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl text-center">
          <p className="text-sm font-semibold uppercase tracking-wide text-garena-red">
            Garena · Internal
          </p>
          <h1 className="mt-3 text-4xl font-bold text-garena-dark sm:text-5xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-4 text-garena-dark/60">What would you like to do today?</p>

          <div className="mt-10 flex flex-col items-stretch gap-6 sm:flex-row sm:items-start sm:justify-center">
            <div className="flex flex-col items-center gap-2">
              <Link
                href="/profiles"
                className="inline-flex w-full items-center justify-center rounded-lg bg-garena-red px-7 py-3 text-base font-semibold text-white shadow hover:opacity-95 sm:w-44"
              >
                MA Profiles
              </Link>
              <p className="max-w-[200px] text-center text-xs text-garena-dark/50">
                View their memos, comment and react here.
              </p>
            </div>

            <div className="flex flex-col items-center gap-2">
              <Link
                href="/ma-overview"
                className="inline-flex w-full items-center justify-center rounded-lg bg-garena-red px-7 py-3 text-base font-semibold text-white shadow hover:opacity-95 sm:w-44"
              >
                MA Overview
              </Link>
              <p className="max-w-[200px] text-center text-xs text-garena-dark/50">
                Quick glance of all MAs, and their current rotation.
              </p>
            </div>

            <div className="flex flex-col items-center gap-2">
              <Link
                href="/horse-leaderboard"
                className="inline-flex w-full items-center justify-center rounded-lg bg-garena-red px-7 py-3 text-base font-semibold text-white shadow hover:opacity-95 sm:w-44"
              >
                Find the MA 🐴
              </Link>
              <p className="max-w-[200px] text-center text-xs text-garena-dark/50">
                Mini game: hunt for horses hidden across the site.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Not signed in — marketing landing
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-center sm:px-6 sm:py-12">
      <p className="text-sm font-semibold uppercase tracking-wide text-garena-red">
        Garena · Internal
      </p>
      <h1 className="mt-3 text-4xl font-bold text-garena-dark sm:text-5xl">
        Welcome to the<br />MA Learning Day Forum
      </h1>
      <div className="mt-6 rounded-xl border border-garena-red/20 bg-garena-white px-4 py-3 text-lg font-medium text-garena-dark shadow-sm">
        MA Learning Day — 8 May 2026
      </div>
      <p className="mt-6 text-lg text-garena-dark/80">
        Connect with our Management Associates, read their memos, and join the conversation. Sign in with your corporate Google account.
      </p>
      <div className="mt-10">
        <Link
          href="/auth"
          className="inline-flex items-center justify-center rounded-lg bg-garena-red px-6 py-3 text-base font-semibold text-white shadow hover:opacity-95"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
