import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen p-8">
      <h1 className="text-2xl font-bold">Augmented Menu</h1>
      <p className="mt-2 text-gray-600">
        Phase 0 scaffold. Public routes live under <code className="font-mono">/r/[slug]</code> and admin under{" "}
        <code className="font-mono">/admin</code>.
      </p>

      <div className="mt-6 flex flex-col gap-2">
        <Link className="text-blue-600 underline" href="/r/demo">
          Open demo restaurant menu (/r/demo)
        </Link>
        <Link className="text-blue-600 underline" href="/admin">
          Open admin placeholder (/admin)
        </Link>
      </div>
    </main>
  );
}
