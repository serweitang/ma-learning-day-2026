"use client";

import { useEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/esm/Page/TextLayer.css";
import "react-pdf/dist/esm/Page/AnnotationLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type SelectionState = { text: string; x: number; y: number };

type Props = {
  url: string;
  title?: string;
  onQuote?: (text: string) => void;
};

export function PDFViewer({ url, title = "MA memo", onQuote }: Props) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [width, setWidth] = useState(800);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!onQuote) return;

    const onMouseUp = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (!text || !containerRef.current) { setSelection(null); return; }
      const range = sel?.getRangeAt(0);
      if (!range || !containerRef.current.contains(range.commonAncestorContainer)) {
        setSelection(null);
        return;
      }
      const rect = range.getBoundingClientRect();
      setSelection({ text, x: rect.left + rect.width / 2, y: rect.top });
    };

    const onMouseDown = (e: MouseEvent) => {
      if ((e.target as Element).closest("[data-quote-btn]")) return;
      setSelection(null);
    };

    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousedown", onMouseDown);
    return () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousedown", onMouseDown);
    };
  }, [onQuote]);

  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-garena-bg shadow-inner">
      {/* toolbar */}
      <div className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-2 text-sm select-none">
        <span className="truncate text-garena-dark/60">{title}</span>
        <div className="flex shrink-0 items-center gap-3 ml-4">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded px-2 py-0.5 text-garena-dark hover:bg-garena-bg disabled:opacity-30"
            aria-label="Previous page"
          >
            ‹
          </button>
          <span className="text-garena-dark/60">
            {page} / {numPages ?? "…"}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(numPages ?? p, p + 1))}
            disabled={numPages !== null && page >= numPages}
            className="rounded px-2 py-0.5 text-garena-dark hover:bg-garena-bg disabled:opacity-30"
            aria-label="Next page"
          >
            ›
          </button>
        </div>
      </div>

      {/* pdf canvas */}
      <div ref={containerRef} className="overflow-auto" style={{ maxHeight: "min(70vh,720px)" }}>
        <Document
          file={url}
          onLoadSuccess={({ numPages: n }) => { setNumPages(n); setPage(1); }}
          loading={
            <div className="flex h-48 items-center justify-center text-sm text-garena-dark/40">
              Loading PDF…
            </div>
          }
          error={
            <div className="flex h-48 items-center justify-center text-sm text-garena-dark/40">
              Could not load PDF.
            </div>
          }
        >
          <Page
            pageNumber={page}
            width={width || 800}
            renderTextLayer
            renderAnnotationLayer={false}
          />
        </Document>
      </div>

      {/* bottom page navigation — only shown when there are multiple pages */}
      {numPages !== null && numPages > 1 && (
        <div className="flex items-center justify-between border-t border-black/10 bg-white px-4 py-2 select-none">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-md border border-black/10 px-3 py-1.5 text-sm text-garena-dark hover:bg-garena-bg disabled:invisible"
          >
            ← Prev
          </button>
          <span className="text-xs text-garena-dark/50">{page} / {numPages}</span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
            disabled={page >= numPages}
            className="rounded-md bg-garena-red px-3 py-1.5 text-sm font-medium text-white hover:bg-garena-red/90 disabled:invisible"
          >
            Next page →
          </button>
        </div>
      )}

      {/* floating quote button — fixed to viewport so scroll doesn't affect it */}
      {selection && onQuote && (
        <button
          data-quote-btn
          type="button"
          onClick={() => {
            onQuote(selection.text);
            setSelection(null);
            window.getSelection()?.removeAllRanges();
          }}
          style={{
            position: "fixed",
            left: `${selection.x}px`,
            top: `${Math.max(8, selection.y - 44)}px`,
            transform: "translateX(-50%)",
            zIndex: 50,
          }}
          className="rounded-full bg-garena-dark px-3 py-1.5 text-xs font-semibold text-white shadow-lg hover:bg-garena-red transition-colors"
        >
          Quote &amp; comment ↓
        </button>
      )}
    </div>
  );
}
