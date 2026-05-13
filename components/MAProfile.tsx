"use client";

import { useMemo, useState } from "react";

const LABEL_ORDER: Record<string, number> = { R1: 1, R2: 2, R3: 3, R4: 4 };

const ROTATION_PILL_COLORS: Record<string, string> = {
  R1: "bg-blue-100 text-blue-700",
  R2: "bg-emerald-100 text-emerald-700",
  R3: "bg-amber-100 text-amber-700",
  R4: "bg-purple-100 text-purple-700",
};

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
import { canUploadMemo, canEditMaProfile, canViewLeadershipData } from "@/lib/auth";
import { getMa, setMaMemoUploaded, updateMaBio, updateMaLeadershipData } from "@/lib/firestore";
import { formatSgt } from "@/lib/datetime";
import dynamic from "next/dynamic";
import type { MA } from "@/types";
const PDFViewer = dynamic(
  () => import("@/components/PDFViewer").then((m) => m.PDFViewer),
  { ssr: false, loading: () => <div className="flex h-48 items-center justify-center text-sm text-garena-dark/40">Loading PDF…</div> }
);
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
  const [editingStrengths, setEditingStrengths] = useState(false);
  const [editingAreas, setEditingAreas] = useState(false);
  const [strengthsDraft, setStrengthsDraft] = useState((initial.strengths ?? []).join("\n"));
  const [areasDraft, setAreasDraft] = useState((initial.areasForDevelopment ?? []).join("\n"));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingQuote, setPendingQuote] = useState<string | null>(null);

  const canEdit = useMemo(
    () => (forumUser ? canEditMaProfile(forumUser, ma.id) : false),
    [forumUser, ma.id]
  );

  const canViewLeadership = useMemo(
    () => canViewLeadershipData(forumUser),
    [forumUser]
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

  const saveStrengths = async () => {
    setError(null);
    try {
      await updateMaLeadershipData(ma.id, {
        strengths: strengthsDraft.split("\n").map((s) => s.trim()).filter(Boolean),
        areasForDevelopment: ma.areasForDevelopment,
      });
      await refresh();
      setEditingStrengths(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  };

  const saveAreas = async () => {
    setError(null);
    try {
      await updateMaLeadershipData(ma.id, {
        strengths: ma.strengths,
        areasForDevelopment: areasDraft.split("\n").map((s) => s.trim()).filter(Boolean),
      });
      await refresh();
      setEditingAreas(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
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
          <div className="h-56 w-56 overflow-hidden rounded-full border border-black/10 bg-garena-bg">
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
            <h1 className="text-4xl font-extrabold text-garena-dark">
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
            <div className="rounded-xl border border-black/10 bg-white p-4 space-y-2">
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
            <div className="rounded-xl border border-black/10 bg-white p-4 space-y-2">
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
        </div>
      </div>

      {(ma.rotations.length > 0 || canViewLeadership) && (
        <div className={`grid w-full items-stretch gap-4 ${canViewLeadership ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1"}`}>
          {/* Box 1 — Rotations */}
          {ma.rotations.length > 0 && (
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
              <p className="mb-2 text-sm font-semibold text-garena-dark">Rotations Info</p>
              <ul className="space-y-2">
                {ma.rotations.map((r) => (
                  <li key={r.label}>
                    <div className="flex w-full items-start gap-[10px]">
                      <span className={`flex w-8 shrink-0 items-center justify-center rounded-full py-0.5 text-xs font-semibold ${ROTATION_PILL_COLORS[r.label] ?? "bg-garena-red/10 text-garena-red"}`}>
                        {r.label}
                      </span>
                      <span className="flex-1 text-sm text-garena-dark">{r.department}</span>
                      {canViewLeadership && (
                        <span className="min-w-[36px] shrink-0 whitespace-nowrap text-right text-xs font-medium text-garena-dark/70">
                          {r.performanceGrade ? `[${r.performanceGrade}]` : ""}
                        </span>
                      )}
                    </div>
                    {(r.learningMemoUrl || r.presentationUrl) && (
                      <div className="mt-0.5 flex items-center gap-3 pl-[42px]">
                        {r.learningMemoUrl && (
                          <a href={r.learningMemoUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-garena-dark/60 hover:text-garena-red">
                            <span>📄</span> Learning Memo
                          </a>
                        )}
                        {r.presentationUrl && (
                          <a href={r.presentationUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-garena-dark/60 hover:text-garena-red">
                            <span>🖥</span> Presentation
                          </a>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Box 2 — Strengths (leadership only) */}
          {canViewLeadership && (
            <div className="flex flex-col rounded-xl border border-green-100 bg-green-50 p-4">
              <p className="mb-1.5 text-sm font-semibold text-garena-dark">Strengths</p>
              {editingStrengths ? (
                <>
                  <textarea
                    className="min-h-[120px] w-full flex-1 rounded-md border border-green-200 bg-white p-2 text-sm text-garena-dark"
                    placeholder="One strength per line…"
                    value={strengthsDraft}
                    onChange={(e) => setStrengthsDraft(e.target.value)}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" className="rounded-md border border-black/10 bg-white px-3 py-1.5 text-sm" onClick={() => setEditingStrengths(false)}>Cancel</button>
                    <button type="button" className="rounded-md bg-garena-red px-3 py-1.5 text-sm text-white" onClick={() => void saveStrengths()}>Save</button>
                  </div>
                </>
              ) : (
                <>
                  <ul className="flex-1 space-y-1">
                    {(ma.strengths ?? []).map((s, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-garena-dark/90">
                        <span className="mt-1 shrink-0 text-xs">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                    {!(ma.strengths?.length) && forumUser?.role === "admin" && (
                      <li className="text-sm italic text-garena-dark/40">No strengths added yet.</li>
                    )}
                  </ul>
                  {forumUser?.role === "admin" && (
                    <div className="mt-3 flex justify-end">
                      <button type="button" className="text-sm font-medium text-garena-red hover:underline" onClick={() => { setStrengthsDraft((ma.strengths ?? []).join("\n")); setEditingStrengths(true); }}>Edit</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Box 3 — Areas for Development (leadership only) */}
          {canViewLeadership && (
            <div className="flex flex-col rounded-xl border border-red-100 bg-red-50 p-4">
              <p className="mb-1.5 text-sm font-semibold text-garena-dark">Areas for Development</p>
              {editingAreas ? (
                <>
                  <textarea
                    className="min-h-[120px] w-full flex-1 rounded-md border border-red-200 bg-white p-2 text-sm text-garena-dark"
                    placeholder="One area per line…"
                    value={areasDraft}
                    onChange={(e) => setAreasDraft(e.target.value)}
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button type="button" className="rounded-md border border-black/10 bg-white px-3 py-1.5 text-sm" onClick={() => setEditingAreas(false)}>Cancel</button>
                    <button type="button" className="rounded-md bg-garena-red px-3 py-1.5 text-sm text-white" onClick={() => void saveAreas()}>Save</button>
                  </div>
                </>
              ) : (
                <>
                  <ul className="flex-1 space-y-1">
                    {(ma.areasForDevelopment ?? []).map((a, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-sm text-garena-dark/90">
                        <span className="mt-1 shrink-0 text-xs">•</span>
                        <span>{a}</span>
                      </li>
                    ))}
                    {!(ma.areasForDevelopment?.length) && forumUser?.role === "admin" && (
                      <li className="text-sm italic text-garena-dark/40">No areas added yet.</li>
                    )}
                  </ul>
                  {forumUser?.role === "admin" && (
                    <div className="mt-3 flex justify-end">
                      <button type="button" className="text-sm font-medium text-garena-red hover:underline" onClick={() => { setAreasDraft((ma.areasForDevelopment ?? []).join("\n")); setEditingAreas(true); }}>Edit</button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

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
            <div className="rounded-xl border border-black/10 bg-white p-4 space-y-2">
              {currentRotationDept && (
                <h2 className="text-lg font-semibold text-garena-dark">
                  Rotation Memo — {currentRotationDept}
                </h2>
              )}
              <PDFViewer url={ma.memoURL} title={`${ma.name} memo`} onQuote={setPendingQuote} />
              {memoTime && (
                <p className="text-xs text-garena-dark/50">
                  Last updated: {memoTime} SGT
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-black/10 bg-white p-6 text-garena-dark/80">
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
        pendingQuote={pendingQuote}
        onQuoteClear={() => setPendingQuote(null)}
      />

      {!firebaseUser && (
        <p className="text-center text-xs text-garena-dark/50">
          Sign in to react, comment, or upload your memo (if you are the assigned MA).
        </p>
      )}
    </div>
  );
}
