import Link from "next/link";
import type { MA } from "@/types";

type Props = {
  ma: MA;
};

export function MACard({ ma }: Props) {

  return (
    <Link
      href={`/ma/${ma.id}`}
      className="group flex flex-col overflow-hidden rounded-xl border border-black/10 bg-garena-white shadow-sm transition hover:border-garena-red/40 hover:shadow-md"
    >
      <div className="relative aspect-square w-full overflow-hidden bg-garena-bg">
        {ma.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ma.photoURL}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition group-hover:opacity-95"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-4xl font-bold text-garena-dark/20">
            {ma.name?.charAt(0) ?? "?"}
          </div>
        )}
        {ma.isPresenting === true && (
          <div className="absolute bottom-2 right-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
            Presenting MA
          </div>
        )}
        {ma.isPresenting === false && (
          <div className="absolute bottom-2 right-2 rounded-full bg-black/40 px-2 py-0.5 text-xs font-medium text-white/80 backdrop-blur-sm">
            Non-Presenting MA
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h2 className="text-lg font-semibold text-garena-dark group-hover:text-garena-red">{ma.name}</h2>
        <div className="mt-2 flex flex-wrap gap-1">
          {ma.hasMemo && (
            <span className="inline-flex w-fit rounded-full bg-highlight-blue px-2 py-0.5 text-xs font-medium text-garena-dark">
              Memo available
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
