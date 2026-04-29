"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { addComment, subscribeComments } from "@/lib/firestore";
import type { Comment } from "@/types";
import { CommentBox } from "@/components/CommentBox";
import { RichTextEditor } from "@/components/RichTextEditor";
import { HorseIcon } from "@/components/HorseIcon";

const MAX_CHARS = 1000;

type Props = {
  maId: string;
  horseId?: string;
};

function textLengthFromHtml(html: string): number {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, "").length;
  }
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent?.length ?? 0;
}

export function CommentSection({ maId, horseId }: Props) {
  const { firebaseUser } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeComments(
      maId,
      setComments,
      (e) => setError(e.message)
    );
    return () => unsub();
  }, [maId]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const len = textLengthFromHtml(draft);
    if (len === 0 || len > MAX_CHARS) return;
    setSubmitting(true);
    setError(null);
    try {
      await addComment({
        maId,
        authorUid: firebaseUser.uid,
        authorName: firebaseUser.displayName ?? firebaseUser.email ?? "User",
        authorPhoto: firebaseUser.photoURL ?? "",
        content: draft,
      });
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to post comment");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold text-garena-dark">Comments</h2>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      {firebaseUser ? (
        <form onSubmit={(e) => void onSubmit(e)} className="space-y-3 rounded-lg border border-black/10 bg-garena-bg p-4">
          <RichTextEditor
            valueHtml={draft}
            onChangeHtml={setDraft}
            maxChars={MAX_CHARS}
            disabled={submitting}
            placeholder="Share your thoughts…"
          />
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={submitting || textLengthFromHtml(draft) === 0 || textLengthFromHtml(draft) > MAX_CHARS}
              className="rounded-md bg-garena-red px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              Post comment
            </button>
            {horseId && <HorseIcon id={horseId} />}
          </div>
        </form>
      ) : (
        <p className="text-sm text-garena-dark/70">Sign in with your @garena.com account to comment.</p>
      )}

      <div className="space-y-3">
        {comments.map((c) => (
          <CommentBox key={c.id} comment={c} />
        ))}
        {comments.length === 0 && (
          <p className="text-sm text-garena-dark/50">No comments yet — start the discussion.</p>
        )}
      </div>
    </section>
  );
}
