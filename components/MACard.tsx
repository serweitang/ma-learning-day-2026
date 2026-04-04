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
      <div className="aspect-[4/3] w-full bg-garena-bg">
        {ma.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={ma.photoURL}
            alt=""
            className="h-full w-full object-cover transition group-hover:opacity-95"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-garena-dark/20">
            {ma.name?.charAt(0) ?? "?"}
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h2 className="text-lg font-semibold text-garena-dark group-hover:text-garena-red">{ma.name}</h2>
        <p className="text-sm text-garena-dark/70">{ma.department}</p>
        {ma.hasMemo && (
          <span className="mt-2 inline-flex w-fit rounded-full bg-highlight-blue px-2 py-0.5 text-xs font-medium text-garena-dark">
            Memo available
          </span>
        )}
      </div>
    </Link>
  );
}
