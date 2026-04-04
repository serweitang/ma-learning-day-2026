import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <h1 className="text-2xl font-bold text-garena-dark">Page not found</h1>
      <p className="mt-2 text-garena-dark/70">That MA profile or route does not exist.</p>
      <Link href="/profiles" className="mt-6 inline-block text-garena-red hover:underline">
        Back to directory
      </Link>
    </div>
  );
}
