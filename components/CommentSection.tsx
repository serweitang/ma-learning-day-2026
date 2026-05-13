"use client";

import { useEffect, useRef, useState } from "react";
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
  pendingQuote?: string | null;
  onQuoteClear?: () => void;
};

function textLengthFromHtml(html: string): number {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, "").length;
  }
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent?.length ?? 0;
}

export function CommentSection({ maId, horseId, pendingQuote, onQuoteClear }: Props) {
  const { firebaseUser } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingReply, setPendingReply] = useState<{ commentId: string; name: string } | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsub = subscribeComments(
      maId,
      setComments,
      (e) => setError(e.message)
    );
    return () => unsub();
  }, [maId]);

  // Scroll to comment form when a quote or reply is triggered
  useEffect(() => {
    if (pendingQuote || pendingReply) {
      formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [pendingQuote, pendingReply]);

  const onReply = (commentId: string, name: string) => {
    setPendingReply({ commentId, name });
  };

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
        quote: pendingQuote ?? null,
        replyToCommentId: pendingReply?.commentId ?? null,
        replyToName: pendingReply?.name ?? null,
      });
      setDraft("");
      onQuoteClear?.();
      setPendingReply(null);
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
        <div ref={formRef}>
          <form onSubmit={(e) => void onSubmit(e)} className="space-y-3 rounded-lg border border-black/10 bg-garena-bg p-4">
            {pendingReply && (
              <div className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-2 text-sm">
                <span className="text-garena-dark/60">
                  ↩ Replying to <span className="font-semibold text-garena-dark">{pendingReply.name}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPendingReply(null)}
                  className="shrink-0 text-xs text-garena-dark/40 hover:text-garena-dark"
                  aria-label="Cancel reply"
                >
                  ✕
                </button>
              </div>
            )}
            {pendingQuote && (
              <div className="flex items-start gap-2 rounded-md border-l-4 border-garena-red/50 bg-white px-3 py-2">
                <blockquote className="min-w-0 flex-1 line-clamp-3 text-sm italic text-garena-dark/60">
                  &ldquo;{pendingQuote}&rdquo;
                </blockquote>
                <button
                  type="button"
                  onClick={onQuoteClear}
                  className="mt-0.5 shrink-0 text-xs text-garena-dark/40 hover:text-garena-dark"
                  aria-label="Remove quote"
                >
                  ✕
                </button>
              </div>
            )}
            <RichTextEditor
              valueHtml={draft}
              onChangeHtml={setDraft}
              maxChars={MAX_CHARS}
              disabled={submitting}
              placeholder={pendingReply ? `Reply to ${pendingReply.name}…` : pendingQuote ? "Add your comment on this quote…" : "Share your thoughts…"}
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
        </div>
      ) : (
        <p className="text-sm text-garena-dark/70">Sign in with your @garena.com account to comment.</p>
      )}

      <div className="space-y-3">
        {(() => {
          if (comments.length === 0) {
            return <p className="text-sm text-garena-dark/50">No comments yet — start the discussion.</p>;
          }

          // Build a lookup map and walk up to find the root of any reply chain
          const byId = new Map(comments.map((c) => [c.id, c]));
          const threadRoot = (c: Comment): string => {
            if (!c.replyToCommentId) return c.id;
            const parent = byId.get(c.replyToCommentId);
            return parent ? threadRoot(parent) : c.id;
          };

          const topLevel = comments.filter((c) => !c.replyToCommentId);

          // Group all non-top-level comments under their root
          const threadReplies = new Map<string, Comment[]>();
          for (const c of comments) {
            if (!c.replyToCommentId) continue;
            const rootId = threadRoot(c);
            const bucket = threadReplies.get(rootId) ?? [];
            bucket.push(c);
            threadReplies.set(rootId, bucket);
          }

          return topLevel.map((c) => (
            <div key={c.id} className="space-y-2">
              <CommentBox comment={c} onReply={firebaseUser ? onReply : undefined} />
              {(threadReplies.get(c.id) ?? []).map((r) => {
                const parent = r.replyToCommentId ? byId.get(r.replyToCommentId) : null;
                const resolvedName = parent?.authorName ?? r.replyToName ?? null;
                return (
                  <CommentBox key={r.id} comment={r} onReply={firebaseUser ? onReply : undefined} isReply replyToDisplayName={resolvedName} />
                );
              })}
            </div>
          ));
        })()}
      </div>
    </section>
  );
}
