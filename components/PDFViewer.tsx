"use client";

type Props = {
  url: string;
  title?: string;
};

/**
 * Inline PDF display (no new tab). Uses the browser PDF plugin inside an iframe.
 * TODO: If CSP blocks frames, adjust Firebase Storage / Hosting headers or use `react-pdf`.
 */
export function PDFViewer({ url, title = "MA memo" }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-black/10 bg-garena-white shadow-inner">
      <iframe
        title={title}
        src={url}
        className="h-[min(70vh,720px)] w-full bg-garena-bg"
      />
    </div>
  );
}
