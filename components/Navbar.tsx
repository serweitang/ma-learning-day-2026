"use client";

import Link from "next/link";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { useHorseGame } from "@/components/HorseProvider";
import { signOut } from "@/lib/auth";
import { TOTAL_HORSES } from "@/lib/horseGame";

function GarenaLogo() {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return <span className="text-xl font-bold text-garena-red">Garena</span>;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/garena-logo.png"
      alt="Garena"
      className="h-9 w-auto max-w-[140px] object-contain object-left"
      onError={() => setFailed(true)}
    />
  );
}

export function Navbar() {
  const { firebaseUser, forumUser, loading } = useAuth();
  const { foundHorses } = useHorseGame();

  const initial =
    firebaseUser?.displayName?.charAt(0)?.toUpperCase() ??
    firebaseUser?.email?.charAt(0)?.toUpperCase() ??
    "?";

  return (
    <header className="sticky top-0 z-50 border-b border-black/5 bg-garena-white shadow-sm">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          {/* TODO: Drop `public/garena-logo.png` into the repo when you have the asset. */}
          <GarenaLogo />
          <span className="hidden text-sm font-medium text-garena-dark sm:inline">
            MA Learning Day Forum
          </span>
        </Link>

        <nav className="flex items-center gap-4 text-sm font-medium text-garena-dark">
          <Link className="hover:text-garena-red" href="/profiles">
            MA Profiles
          </Link>
          {firebaseUser && (
            <Link className="hover:text-garena-red" href="/ma-overview">
              MA Overview
            </Link>
          )}
          {forumUser?.role === "admin" && (
            <Link className="hover:text-garena-red" href="/admin">
              Admin
            </Link>
          )}
          {firebaseUser && (
            <Link
              href="/horse-leaderboard"
              className="hover:text-garena-red"
              title={`Find the MA — ${foundHorses.length}/${TOTAL_HORSES} found`}
            >
              🐴 {foundHorses.length}
            </Link>
          )}
          {loading ? (
            <span className="text-garena-dark/50">…</span>
          ) : firebaseUser ? (
            <div className="flex items-center gap-2">
              {firebaseUser.photoURL ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={firebaseUser.photoURL}
                  alt=""
                  className="h-8 w-8 rounded-full border border-black/10"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full border border-black/10 bg-garena-bg text-xs font-semibold text-garena-dark">
                  {initial}
                </span>
              )}
              <button
                type="button"
                className="rounded-md border border-garena-red px-2 py-1 text-garena-red hover:bg-garena-red hover:text-white"
                onClick={() => void signOut()}
              >
                Sign out
              </button>
            </div>
          ) : (
            <Link
              className="rounded-md bg-garena-red px-3 py-1.5 text-white hover:opacity-90"
              href="/auth"
            >
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
