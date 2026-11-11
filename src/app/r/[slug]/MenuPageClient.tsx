"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import type { PublicMenuCategory, PublicMenuItem } from "@/lib/menu";
import { cn } from "@/components/ui";
import { ChevronRightIcon, CubeIcon, SearchIcon } from "@/components/icons";

export function MenuPageClient({
  slug,
  restaurant,
  categories,
}: {
  slug: string;
  restaurant: { id: string; name: string };
  categories: PublicMenuCategory[];
}) {
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState(categories[0]?.id ?? "");
  const chipBarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    trackEvent("menu_view", { restaurantId: restaurant.id });
  }, [restaurant.id]);

  const hasAnyAR = useMemo(() => categories.some((c) => c.items.some((i) => i.hasAR)), [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        items: cat.items.filter(
          (item) => item.name.toLowerCase().includes(q) || (item.description?.toLowerCase().includes(q) ?? false)
        ),
      }))
      .filter((cat) => cat.items.length > 0);
  }, [categories, search]);

  // Highlight the category chip for the section currently under the sticky header.
  useEffect(() => {
    const sections = filtered
      .map((c) => document.getElementById(`cat-${c.id}`))
      .filter((el): el is HTMLElement => !!el);
    if (sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id.replace(/^cat-/, ""));
      },
      { rootMargin: "-140px 0px -60% 0px" }
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [filtered]);

  // Keep the active chip in view in the horizontal chip bar.
  useEffect(() => {
    const chip = chipBarRef.current?.querySelector<HTMLElement>(`[data-cat="${activeId}"]`);
    chip?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeId]);

  const itemCount = categories.reduce((n, c) => n + c.items.length, 0);

  return (
    <main className="min-h-screen bg-stone-50 pb-16">
      <header className="bg-gradient-to-b from-brand-50 to-stone-50 px-4 pb-4 pt-10">
        <div className="mx-auto max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Menu</p>
          <h1 className="mt-1 font-display text-4xl font-semibold leading-tight text-stone-900">{restaurant.name}</h1>
          {hasAnyAR && (
            <p className="mt-3 flex items-start gap-2 rounded-2xl bg-white/80 px-3 py-2 text-sm text-stone-700 shadow-card ring-1 ring-stone-200 sm:inline-flex sm:items-center sm:rounded-full">
              <CubeIcon size={16} className="mt-0.5 shrink-0 text-brand-600 sm:mt-0" />
              <span>
                Dishes marked <span className="font-semibold text-brand-700">AR</span> can be placed on your table at
                real size
              </span>
            </p>
          )}
        </div>
      </header>

      {itemCount > 0 && (
        <div className="sticky top-0 z-20 border-b border-stone-200/80 bg-stone-50/90 backdrop-blur supports-[backdrop-filter]:bg-stone-50/75">
          <div className="mx-auto max-w-2xl px-4 pt-3">
            <label className="relative block">
              <span className="sr-only">Search the menu</span>
              <SearchIcon size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="search"
                placeholder="Search dishes"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full rounded-2xl border border-stone-200 bg-white pl-10 pr-4 text-[15px] shadow-card placeholder:text-stone-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
              />
            </label>
          </div>
          {filtered.length > 1 && (
            <nav aria-label="Menu sections" className="mx-auto max-w-2xl">
              <div ref={chipBarRef} className="scrollbar-none flex gap-2 overflow-x-auto px-4 py-3">
                {filtered.map((cat) => (
                  <a
                    key={cat.id}
                    href={`#cat-${cat.id}`}
                    data-cat={cat.id}
                    onClick={() => setActiveId(cat.id)}
                    className={cn(
                      "shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
                      activeId === cat.id
                        ? "bg-stone-900 text-white"
                        : "bg-white text-stone-700 ring-1 ring-inset ring-stone-200 hover:bg-stone-100"
                    )}
                  >
                    {cat.name}
                  </a>
                ))}
              </div>
            </nav>
          )}
          {filtered.length <= 1 && <div className="h-3" />}
        </div>
      )}

      <div className="mx-auto max-w-2xl px-4 pt-4">
        {itemCount === 0 ? (
          <p className="py-16 text-center text-stone-500">The menu is being prepared. Check back soon.</p>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="font-medium text-stone-800">No dishes match “{search.trim()}”</p>
            <button onClick={() => setSearch("")} className="mt-2 text-sm font-medium text-brand-700 underline">
              Clear search
            </button>
          </div>
        ) : (
          <div className="space-y-8">
            {filtered.map((cat) => (
              <section key={cat.id} id={`cat-${cat.id}`} className="scroll-mt-36">
                <h2 className="mb-3 font-display text-2xl font-semibold text-stone-900">{cat.name}</h2>
                <ul className="divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-card">
                  {cat.items.map((item) => (
                    <MenuItemRow key={item.id} slug={slug} item={item} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <footer className="mx-auto mt-12 max-w-2xl px-4 text-center text-xs text-stone-400">
        Powered by Augmented Menu
      </footer>
    </main>
  );
}

function MenuItemRow({ slug, item }: { slug: string; item: PublicMenuItem }) {
  return (
    <li>
      <Link
        href={`/r/${slug}/item/${item.id}`}
        className="group flex items-center gap-4 p-4 transition-colors hover:bg-stone-50 active:bg-stone-100"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold leading-snug text-stone-900">{item.name}</h3>
            {item.price && <span className="shrink-0 font-semibold tabular-nums text-stone-900">{item.price}</span>}
          </div>
          {item.description && <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-stone-500">{item.description}</p>}
          {item.hasAR && (
            <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-200">
              <CubeIcon size={13} /> AR
            </span>
          )}
        </div>
        {item.thumbnail ? (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-stone-100">
            <Image src={item.thumbnail} alt="" fill sizes="80px" className="object-cover" />
          </div>
        ) : (
          <ChevronRightIcon size={18} className="shrink-0 text-stone-300 group-hover:text-stone-500" />
        )}
      </Link>
    </li>
  );
}
