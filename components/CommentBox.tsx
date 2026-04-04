"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { canDeleteAnyComment } from "@/lib/auth";
import { deleteComment, updateComment } from "@/lib/firestore";
import { formatSgt } from "@/lib/datetime";
import type { Comment } from "@/types";
import { RichTextEditor } from "@/components/RichTextEditor";

const MAX_CHARS = 1000;

type Props = {
  comment: Comment;
};

export function CommentBox({ comment }: Props) {
  const { firebaseUser, forumUser } = useAuth();
  const [editing, setEditing] = useState(false);
  const [html, setHtml] = useState(comment.content);
  const [saving, setSaving] = useState(false);

  const isAuthor = firebaseUser?.uid === comment.authorUid;
  const canMod = isAuthor || canDeleteAnyComment(forumUser);
  const canEdit = isAuthor;

  const created = formatSgt(comment.createdAt?.toDate?.() ?? comment.createdAt);
  const edited =
    comment.isEdited && comment.editedAt
      ? formatSgt(comment.editedAt.toDate?.() ?? comment.editedAt)
      : null;

  const onSave = async () => {
    const len = new DOMParser().parseFromString(html, "text/html").body.textContent?.length ?? 0;
    if (len > MAX_CHARS) return;
    setSaving(true);
    try {
      await updateComment(comment.id, html);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!confirm("Delete this comment?")) return;
    await deleteComment(comment.id);
  };

  return (
    <article className="rounded-lg border border-black/10 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        {comment.authorPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={comment.authorPhoto}
            alt=""
            className="mt-0.5 h-9 w-9 rounded-full border border-black/10"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-full bg-garena-bg text-sm font-semibold text-garena-dark">
            {comment.authorName.charAt(0).toUpperCase()}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-semibold text-garena-dark">{comment.authorName}</span>
            <time className="text-xs text-garena-dark/50" dateTime={created}>
              {created} SGT
            </time>
            {comment.isEdited && (
              <span className="text-xs text-garena-dark/50">
                (edited{edited ? ` · ${edited} SGT` : ""})
              </span>
            )}
          </div>

          {editing ? (
            <div className="mt-3 space-y-2">
              <RichTextEditor valueHtml={html} onChangeHtml={setHtml} maxChars={MAX_CHARS} />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="rounded-md bg-garena-red px-3 py-1 text-sm text-white disabled:opacity-50"
                  disabled={saving}
                  onClick={() => void onSave()}
                >
                  Save
                </button>
                <button
                  type="button"
                  className="rounded-md border border-black/10 px-3 py-1 text-sm"
                  disabled={saving}
                  onClick={() => {
                    setHtml(comment.content);
                    setEditing(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div
              className="prose prose-sm mt-2 max-w-none text-garena-dark [&_span]:rounded-sm"
              // TODO: Sanitize HTML server-side or with DOMPurify for production hardening.
              dangerouslySetInnerHTML={{ __html: comment.content }}
            />
          )}

          {canMod && !editing && (
            <div className="mt-3 flex gap-2 text-xs">
              {canEdit && (
                <button type="button" className="text-garena-red hover:underline" onClick={() => setEditing(true)}>
                  Edit
                </button>
              )}
              <button type="button" className="text-garena-red hover:underline" onClick={() => void onDelete()}>
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
