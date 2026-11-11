import Link from "next/link";
import { buttonClass } from "@/components/ui";
import { CubeIcon, QrIcon, RulerIcon } from "@/components/icons";

const steps = [
  {
    icon: QrIcon,
    title: "Scan the table QR",
    text: "Diners open your menu in the browser. No app to install.",
  },
  {
    icon: CubeIcon,
    title: "Tap “View on your table”",
    text: "iPhone and Android open native AR in one tap; every other device gets a 3D view.",
  },
  {
    icon: RulerIcon,
    title: "See the real size",
    text: "Each dish is scaled from its plate, bowl or glass measurement, so what they see is what arrives.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-brand-50 via-stone-50 to-stone-50">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-brand-700">Augmented Menu</p>
        <h1 className="mt-3 max-w-3xl font-display text-4xl font-semibold leading-tight text-stone-900 sm:text-6xl">
          Let diners see every dish on their table before they order.
        </h1>
        <p className="mt-5 max-w-2xl text-lg text-stone-600">
          A QR menu with photo-real 3D dishes, generated from a few photos and shown in AR at their true size.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/r/demo" className={buttonClass("primary", "lg")}>
            Try the demo menu
          </Link>
          <Link href="/admin" className={buttonClass("secondary", "lg")}>
            Restaurant admin
          </Link>
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-3">
          {steps.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-stone-200 bg-white p-6 shadow-card">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <Icon size={22} />
              </span>
              <h2 className="mt-4 font-semibold text-stone-900">{title}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-stone-600">{text}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
