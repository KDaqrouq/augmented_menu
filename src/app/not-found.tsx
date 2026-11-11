import Link from "next/link";
import { buttonClass } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-6 text-center">
      <p className="font-display text-6xl font-semibold text-brand-600">404</p>
      <h1 className="mt-3 text-xl font-semibold text-stone-900">We couldn’t find that page</h1>
      <p className="mt-2 max-w-sm text-sm text-stone-500">
        The menu or dish may have been removed, or the link is mistyped. Try scanning the QR code again.
      </p>
      <Link href="/" className={buttonClass("secondary", "md", "mt-6")}>
        Go to the home page
      </Link>
    </main>
  );
}
