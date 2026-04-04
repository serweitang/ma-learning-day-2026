import Link from "next/link";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
      <p className="text-sm font-semibold uppercase tracking-wide text-garena-red">
        Garena · Internal
      </p>
      <h1 className="mt-3 text-4xl font-bold text-garena-dark sm:text-5xl">
        Welcome to the MA Learning Day Forum
      </h1>
      <div className="mt-6 rounded-xl border border-garena-red/20 bg-garena-white px-4 py-3 text-center text-lg font-medium text-garena-dark shadow-sm">
        MA Learning Day — 8 May 2026
      </div>
      <p className="mt-6 text-lg text-garena-dark/80">
        Connect with our Management Associates, read their memos, and join the conversation. Sign in with your
        corporate Google account (@garena.com).
      </p>
      <div className="mt-10">
        <Link
          href="/profiles"
          className="inline-flex items-center justify-center rounded-lg bg-garena-red px-6 py-3 text-base font-semibold text-white shadow hover:opacity-95"
        >
          Meet the MAs
        </Link>
      </div>
      <p className="mt-8 text-sm text-garena-dark/50">
        {/* TODO: Confirm event copy and replace placeholder MA bios in Firestore when ready. */}
        This site is a scaffold — add your Firebase keys in <code className="rounded bg-black/5 px-1">.env.local</code>{" "}
        and deploy with Firebase Hosting when configured.
      </p>
    </div>
  );
}
