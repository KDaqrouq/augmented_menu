import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { Card, CardHeader, EmptyState, buttonClass } from "@/components/ui";
import { CubeIcon, ExternalIcon, StoreIcon } from "@/components/icons";
import { AdminShell } from "./AdminShell";
import { AddRestaurantForm } from "./AddRestaurantForm";
import { CopyLinkButton } from "./CopyButton";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      _count: { select: { items: true, categories: true } },
      items: { where: { assets: { some: {} } }, select: { id: true } },
    },
  });

  return (
    <AdminShell active="restaurants" title="Restaurants" description="Menus, dishes and their 3D models.">
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section>
          {restaurants.length === 0 ? (
            <EmptyState icon={<StoreIcon size={32} />} title="No restaurants yet">
              Add your first restaurant to get a menu link and QR code.
            </EmptyState>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {restaurants.map((r) => (
                <li key={r.id}>
                  <Card className="flex h-full flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/admin/restaurants/${r.id}`}
                          className="block truncate text-lg font-semibold text-stone-900 hover:text-brand-700"
                        >
                          {r.name}
                        </Link>
                        <p className="truncate font-mono text-xs text-stone-500">/r/{r.slug}</p>
                      </div>
                      <a
                        href={`/r/${r.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-stone-400 hover:text-stone-700"
                        aria-label={`Open ${r.name} menu`}
                      >
                        <ExternalIcon size={18} />
                      </a>
                    </div>
                    <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <Stat label="Categories" value={r._count.categories} />
                      <Stat label="Dishes" value={r._count.items} />
                      <Stat label="In 3D" value={r.items.length} icon />
                    </dl>
                    <div className="mt-5 flex flex-wrap gap-2 border-t border-stone-100 pt-4">
                      <Link href={`/admin/restaurants/${r.id}`} className={buttonClass("dark", "sm")}>
                        Manage
                      </Link>
                      <CopyLinkButton path={`/r/${r.slug}`} />
                    </div>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside>
          <Card>
            <CardHeader title="New restaurant" description="Creates a menu at /r/your-slug." />
            <div className="p-5">
              <AddRestaurantForm />
            </div>
          </Card>
        </aside>
      </div>
    </AdminShell>
  );
}

function Stat({ label, value, icon }: { label: string; value: number; icon?: boolean }) {
  return (
    <div className="rounded-xl bg-stone-50 px-2 py-2.5">
      <dd className="flex items-center justify-center gap-1 text-lg font-semibold tabular-nums text-stone-900">
        {icon && <CubeIcon size={15} className="text-brand-600" />}
        {value}
      </dd>
      <dt className="text-xs text-stone-500">{label}</dt>
    </div>
  );
}
