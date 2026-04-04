import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <h1 className="text-2xl font-bold text-garena-dark">Access restricted</h1>
      <p className="mt-4 text-garena-dark/80">
        This forum is only available to Garena colleagues with an <strong>@garena.com</strong> Google account.
      </p>
      <p className="mt-2 text-sm text-garena-dark/60">
        If you believe you should have access, please contact your administrator.
      </p>
      <Link
        href="/auth"
        className="mt-8 inline-flex rounded-lg bg-garena-red px-5 py-2.5 text-sm font-semibold text-white hover:opacity-95"
      >
        Try a different account
      </Link>
      <p className="mt-6 text-xs text-garena-dark/45">
        {/* TODO: Customize this copy for your internal support / IT channel. */}
        Non-Garena accounts are signed out automatically after authentication.
      </p>
    </div>
  );
}
