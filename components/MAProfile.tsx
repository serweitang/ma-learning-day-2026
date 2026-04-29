"use client";

import { useMemo, useState } from "react";

const LABEL_ORDER: Record<string, number> = { R1: 1, R2: 2, R3: 3, R4: 4 };

const NO_HORSE_MAS = ["sw", "sw dummy 2"];
const COMMENT_HORSE_MAS = ["zhanxiao", "mitty", "jin yingjie (joyce)", "yan wei", "shang ruting", "joshua lim"];

const nameKey = (n: string) => n.toLowerCase().trim();

/** Returns the department of the first rotation that has no learningMemoUrl (i.e. the current rotation). */
function resolveCurrentRotationDept(rotations: { label: string; department: string; learningMemoUrl: string | null }[]): string | null {
  if (!rotations.length) return null;
  const sorted = [...rotations].sort((a, b) => (LABEL_ORDER[a.label] ?? 0) - (LABEL_ORDER[b.label] ?? 0));
  const current = sorted.find((r) => !r.learningMemoUrl);
  return current ? current.department : null;
}
import { useAuth } from "@/components/AuthProvider";
import { canUploadMemo, canEditMaProfile } from "@/lib/auth";
import { getMa, setMaMemoUploaded, updateMaBio } from "@/lib/firestore";
import { formatSgt } from "@/lib/datetime";
import type { MA } from "@/types";
import { PDFViewer } from "@/components/PDFViewer";
import { ReactionBar } from "@/components/ReactionBar";
import { CommentSection } from "@/components/CommentSection";
import { HorseIcon } from "@/components/HorseIcon";

type Props = {
  initial: MA;
};

export function MAProfile({ initial }: Props) {
  const { firebaseUser, forumUser } = useAuth();
  const [ma, setMa] = useState<MA>(initial);
  const [bioDraft, setBioDraft] = useState(initial.bio ?? "");
  const [editingBio, setEditingBio] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canEdit = useMemo(
    () => (forumUser ? canEditMaProfile(forumUser, ma.id) : false),
    [forumUser, ma.id]
  );
  const staticPhotoPath = `/ma-photos/${ma.name.toLowerCase().replace(/\s+/g, "-")}.jpg`;

  function resolvePhotoUrl(url: string): string {
    const match = url.match(/drive\.google\.com\/file\/d\/([^/?]+)/);
    if (match) return `https://lh3.googleusercontent.com/d/${match[1]}`;
    return url;
  }

  const canMemo = useMemo(
    () => (forumUser ? canUploadMemo(forumUser, ma.id) : false),
    [forumUser, ma.id]
  );

  const currentRotationDept = useMemo(
    () => resolveCurrentRotationDept(ma.rotations),
    [ma.rotations]
  );

  const refresh = async () => {
    const latest = await getMa(ma.id);
    if (latest) setMa(latest);
  };

  const saveBio = async () => {
    setError(null);
    try {
      await updateMaBio(ma.id, bioDraft);
      await refresh();
      setEditingBio(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save bio");
    }
  };

  const onMemoFile = async (file: File | null) => {
    if (!file || !canMemo || !firebaseUser) return;
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const idToken = await firebaseUser.getIdToken();
      const formData = new FormData();
      formData.append("maId", ma.id);
      formData.append("file", file);
      const res = await fetch("/api/memo/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
        body: formData,
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Upload failed");
      }
      const { memoURL } = (await res.json()) as { memoURL: string };
      await setMaMemoUploaded(ma.id, memoURL);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const memoTime =
    ma.memoUploadedAt && typeof ma.memoUploadedAt.toDate === "function"
      ? formatSgt(ma.memoUploadedAt.toDate())
      : null;

  return (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      <div className="flex flex-col gap-6 sm:flex-row sm:items-stretch">
        <div className="shrink-0">
          <div className="h-56 w-56 overflow-hidden rounded-2xl border border-black/10 bg-garena-bg sm:h-full sm:w-56">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={resolvePhotoUrl(ma.photoURL || staticPhotoPath)}
              alt={ma.name}
              className="h-full w-full object-cover object-top"
              onError={(e) => {
                const target = e.currentTarget;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent && !parent.querySelector(".initials-fallback")) {
                  const fallback = document.createElement("div");
                  fallback.className = "initials-fallback flex h-full w-full items-center justify-center text-5xl font-bold text-garena-dark/20";
                  fallback.textContent = ma.name?.charAt(0) ?? "?";
                  parent.appendChild(fallback);
                }
              }}
            />
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 className="text-3xl font-bold text-garena-dark">
              {ma.name}{" "}
              {!NO_HORSE_MAS.includes(nameKey(ma.name)) && !COMMENT_HORSE_MAS.includes(nameKey(ma.name)) && (
                <HorseIcon id={`horse_ma_${ma.id}`} />
              )}
            </h1>
            {ma.joinYear && (
              <p className="mt-1 text-base text-garena-dark">Joined {ma.joinYear}</p>
            )}
            {ma.school && (
              <p className="mt-0.5 text-base text-garena-dark">
                <span className="font-semibold">School</span>{" "}
                <span className="font-normal">{ma.school}</span>
              </p>
            )}
            {(ma.isPresenting === true || ma.isPresenting === false) && (
              <div className="mt-1">
                {ma.isPresenting === true && (
                  <span className="inline-flex rounded-full bg-garena-red/10 px-2.5 py-0.5 text-xs font-medium text-garena-red">
                    Presenting MA
                  </span>
                )}
                {ma.isPresenting === false && (
                  <span className="inline-flex rounded-full bg-black/5 px-2.5 py-0.5 text-xs font-medium text-garena-dark/50">
                    Non-Presenting MA
                  </span>
                )}
              </div>
            )}
          </div>

          {editingBio && canEdit ? (
            <div className="space-y-2">
              <textarea
                className="min-h-[120px] w-full rounded-md border border-black/10 p-3 text-sm text-garena-dark"
                value={bioDraft}
                onChange={(e) => setBioDraft(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md bg-garena-red px-3 py-1.5 text-sm text-white"
                  onClick={() => void saveBio()}
                >
                  Save bio
                </button>
                <button
                  type="button"
                  className="rounded-md border border-black/10 px-3 py-1.5 text-sm"
                  onClick={() => {
                    setBioDraft(ma.bio);
                    setEditingBio(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="whitespace-pre-wrap text-garena-dark/90">
                <span className="font-bold italic">Bio: </span>
                <span className="italic">{ma.bio}</span>
              </p>
              {canEdit && (
                <button
                  type="button"
                  className="text-sm font-medium text-garena-red hover:underline"
                  onClick={() => setEditingBio(true)}
                >
                  Edit bio
                </button>
              )}
            </div>
          )}

          {ma.rotations.length > 0 && (
            <div className="pt-1">
              <p className="mb-1.5 text-sm font-semibold text-garena-dark">Rotations Info</p>
              <ul className="space-y-2">
                {ma.rotations.map((r) => (
                  <li key={r.label} className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="inline-flex shrink-0 items-center rounded-full bg-garena-red/10 px-2 py-0.5 text-xs font-semibold text-garena-red">
                      {r.label}
                    </span>
                    <span className="text-sm text-garena-dark">{r.department}</span>
                    {r.learningMemoUrl && (
                      <a
                        href={r.learningMemoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-garena-dark/60 hover:text-garena-red"
                      >
                        <span>📄</span> Learning Memo
                      </a>
                    )}
                    {r.presentationUrl && (
                      <a
                        href={r.presentationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-garena-dark/60 hover:text-garena-red"
                      >
                        <span>🖥</span> Presentation
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {ma.isPresenting !== false && (
        <>
          {canMemo && (
            <div className="rounded-lg border border-dashed border-black/20 bg-garena-bg/80 p-4">
              <p className="mb-2 text-sm font-medium text-garena-dark">Memo (PDF)</p>
              <p className="mb-2 text-xs text-garena-dark/60">
                Only one PDF per MA — uploading replaces the previous file.
              </p>
              <input
                type="file"
                accept="application/pdf"
                disabled={uploading}
                onChange={(e) => void onMemoFile(e.target.files?.[0] ?? null)}
              />
              {uploading && <p className="mt-2 text-xs text-garena-dark/60">Uploading…</p>}
            </div>
          )}

          {ma.hasMemo && ma.memoURL ? (
            <div className="space-y-2">
              {currentRotationDept && (
                <h2 className="text-lg font-semibold text-garena-dark">
                  Rotation Memo — {currentRotationDept}
                </h2>
              )}
              <PDFViewer url={ma.memoURL} title={`${ma.name} memo`} />
              {memoTime && (
                <p className="text-xs text-garena-dark/50">
                  Last updated: {memoTime} SGT
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-black/10 bg-white p-6 text-garena-dark/80">
              <p className="font-medium text-garena-dark">No memo uploaded yet</p>
              <p className="mt-1 text-sm">
                When a PDF is available, it will appear here inline for everyone to read.
              </p>
            </div>
          )}
        </>
      )}

      <ReactionBar maId={ma.id} />
      <CommentSection
        maId={ma.id}
        horseId={COMMENT_HORSE_MAS.includes(nameKey(ma.name)) ? `horse_ma_${ma.id}` : undefined}
      />

      {!firebaseUser && (
        <p className="text-center text-xs text-garena-dark/50">
          Sign in to react, comment, or upload your memo (if you are the assigned MA).
        </p>
      )}
    </div>
  );
}
