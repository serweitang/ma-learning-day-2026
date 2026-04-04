"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HIGHLIGHT_YELLOW = "#FFF176";
const HIGHLIGHT_BLUE = "#B3E5FC";

type Props = {
  valueHtml: string;
  onChangeHtml: (html: string) => void;
  maxChars: number;
  disabled?: boolean;
  placeholder?: string;
};

function stripHtmlLength(html: string): number {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]+>/g, "").length;
  }
  const el = document.createElement("div");
  el.innerHTML = html;
  return el.textContent?.length ?? 0;
}

export function RichTextEditor({
  valueHtml,
  onChangeHtml,
  maxChars,
  disabled,
  placeholder = "Write a comment…",
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [count, setCount] = useState(() => stripHtmlLength(valueHtml));

  const syncFromDom = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const html = el.innerHTML;
    const len = stripHtmlLength(html);
    setCount(len);
    if (len <= maxChars) {
      onChangeHtml(html);
    }
  }, [maxChars, onChangeHtml]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (el.innerHTML !== valueHtml) {
      el.innerHTML = valueHtml;
    }
    setCount(stripHtmlLength(valueHtml));
  }, [valueHtml]);

  const exec = (command: string, value?: string) => {
    if (disabled) return;
    ref.current?.focus();
    document.execCommand(command, false, value);
    syncFromDom();
  };

  const wrapHighlight = (color: string) => {
    if (disabled) return;
    const el = ref.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const span = document.createElement("span");
    span.style.backgroundColor = color;
    try {
      range.surroundContents(span);
    } catch {
      document.execCommand("hiliteColor", false, color);
    }
    syncFromDom();
  };

  const onInput = () => {
    const el = ref.current;
    if (!el) return;
    const len = stripHtmlLength(el.innerHTML);
    setCount(len);
    if (len > maxChars) {
      // Revert overshoot by resetting to last known good `valueHtml`
      el.innerHTML = valueHtml;
      setCount(stripHtmlLength(valueHtml));
      return;
    }
    onChangeHtml(el.innerHTML);
  };

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    syncFromDom();
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1 rounded-md border border-black/10 bg-garena-bg p-1">
        <ToolbarButton label="Bold" onClick={() => exec("bold")} disabled={disabled} />
        <ToolbarButton label="Underline" onClick={() => exec("underline")} disabled={disabled} />
        <ToolbarButton
          label="Yellow"
          onClick={() => wrapHighlight(HIGHLIGHT_YELLOW)}
          disabled={disabled}
        />
        <ToolbarButton
          label="Blue"
          onClick={() => wrapHighlight(HIGHLIGHT_BLUE)}
          disabled={disabled}
        />
      </div>
      <div
        ref={ref}
        contentEditable={!disabled}
        suppressContentEditableWarning
        data-placeholder={placeholder}
        className="min-h-[120px] w-full rounded-md border border-black/10 bg-white px-3 py-2 text-sm text-garena-dark outline-none focus:ring-2 focus:ring-garena-red/30 empty:before:text-garena-dark/40 empty:before:content-[attr(data-placeholder)]"
        onInput={onInput}
        onBlur={syncFromDom}
        onPaste={onPaste}
      />
      <p className="text-right text-xs text-garena-dark/60">
        {count} / {maxChars}
      </p>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="rounded px-2 py-1 text-xs font-medium text-garena-dark hover:bg-white disabled:opacity-40"
      onClick={onClick}
    >
      {label}
    </button>
  );
}
