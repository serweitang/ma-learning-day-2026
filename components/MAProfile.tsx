"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { canUploadMemo, canEditMaProfile } from "@/lib/auth";
import { getMa, setMaMemoUploaded, updateMaBio } from "@/lib/firestore";
import { formatSgt } from "@/lib/datetime";
import type { MA } from "@/types";
import { PDFViewer } from "@/components/PDFViewer";
import { ReactionBar } from "@/components/ReactionBar";
import { CommentSection } from "@/components/CommentSection";

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
  const canMemo = useMemo(
    () => (forumUser ? canUploadMemo(forumUser, ma.id) : false),
    [forumUser, ma.id]
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

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="shrink-0">
          <div className="h-40 w-40 overflow-hidden rounded-2xl border border-black/10 bg-garena-bg sm:h-48 sm:w-48">
            {ma.photoURL ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={ma.photoURL} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-5xl font-bold text-garena-dark/20">
                {ma.name?.charAt(0) ?? "?"}
              </div>
            )}
          </div>
          {/* TODO: Wire profile photo upload to Storage + update `photoURL` (admin / owning MA). */}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <h1 className="text-3xl font-bold text-garena-dark">{ma.name}</h1>
            <p className="text-garena-red">{ma.department}</p>
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
              <p className="whitespace-pre-wrap text-garena-dark/90">{ma.bio}</p>
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

      <ReactionBar maId={ma.id} />
      <CommentSection maId={ma.id} />

      {!firebaseUser && (
        <p className="text-center text-xs text-garena-dark/50">
          Sign in to react, comment, or upload your memo (if you are the assigned MA).
        </p>
      )}
    </div>
  );
}
