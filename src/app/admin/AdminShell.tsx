import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/components/ui";
import { ChartIcon, ChevronRightIcon, StoreIcon } from "@/components/icons";
import { AdminLogoutButton } from "./AdminLogoutButton";

type Crumb = { label: string; href?: string };

/** Admin page frame: top bar with navigation, breadcrumbs, title row. */
export function AdminShell({
  active,
  crumbs,
  title,
  description,
  actions,
  children,
}: {
  active: "restaurants" | "analytics";
  crumbs?: Crumb[];
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const nav = [
    { key: "restaurants", label: "Restaurants", href: "/admin", icon: StoreIcon },
    { key: "analytics", label: "Analytics", href: "/admin/analytics", icon: ChartIcon },
  ] as const;

  return (
    <div className="min-h-screen bg-stone-50">
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/admin" className="flex items-center gap-2 font-semibold text-stone-900">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 font-display text-sm text-white">
              A
            </span>
            <span className="hidden sm:inline">Augmented Menu</span>
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map(({ key, label, href, icon: Icon }) => (
              <Link
                key={key}
                href={href}
                className={cn(
                  "inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition-colors",
                  active === key ? "bg-stone-100 text-stone-900" : "text-stone-600 hover:bg-stone-50 hover:text-stone-900"
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto">
            <AdminLogoutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        {crumbs && crumbs.length > 0 && (
          <ol className="mb-3 flex flex-wrap items-center gap-1 text-sm text-stone-500">
            {crumbs.map((crumb, i) => (
              <li key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRightIcon size={14} className="text-stone-300" />}
                {crumb.href ? (
                  <Link href={crumb.href} className="hover:text-stone-900">
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-stone-700">{crumb.label}</span>
                )}
              </li>
            ))}
          </ol>
        )}
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
            {description && <div className="mt-1 text-sm text-stone-500">{description}</div>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}
