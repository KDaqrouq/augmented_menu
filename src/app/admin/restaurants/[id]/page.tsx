import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { buttonClass } from "@/components/ui";
import { ExternalIcon } from "@/components/icons";
import { AdminShell } from "../../AdminShell";
import { CopyLinkButton } from "../../CopyButton";
import { QrCodeCard } from "../../QrCodeCard";
import { CategoriesPanel } from "./CategoriesPanel";
import { ItemsPanel } from "./ItemsPanel";
import { RestaurantSettings } from "./RestaurantSettings";

type Props = { params: Promise<{ id: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = await prisma.restaurant.findUnique({ where: { id }, select: { name: true } });
  return { title: r?.name ?? "Restaurant" };
}

export default async function AdminRestaurantPage({ params }: Props) {
  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      categories: {
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        include: { _count: { select: { items: true } } },
      },
      items: {
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          price: true,
          isAvailable: true,
          measurementType: true,
          measurementValue: true,
          arAssetStatus: true,
          categoryId: true,
          media: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true } },
          _count: { select: { media: true, assets: true } },
        },
      },
    },
  });
  if (!restaurant) notFound();

  const menuPath = `/r/${restaurant.slug}`;

  return (
    <AdminShell
      active="restaurants"
      crumbs={[{ label: "Restaurants", href: "/admin" }, { label: restaurant.name }]}
      title={restaurant.name}
      description={<span className="font-mono">{menuPath}</span>}
      actions={
        <>
          <CopyLinkButton path={menuPath} label="Copy menu link" />
          <a href={menuPath} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
            <ExternalIcon size={16} /> Open menu
          </a>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <ItemsPanel
            restaurantId={restaurant.id}
            categories={restaurant.categories.map((c) => ({ id: c.id, name: c.name }))}
            items={restaurant.items.map((i) => ({
              id: i.id,
              name: i.name,
              price: i.price,
              isAvailable: i.isAvailable,
              measurementType: i.measurementType,
              measurementValue: i.measurementValue,
              arAssetStatus: i.arAssetStatus,
              categoryId: i.categoryId,
              thumbnail: i.media[0]?.url ?? null,
              photoCount: i._count.media,
              hasModel: i._count.assets > 0,
            }))}
          />
        </div>
        <aside className="space-y-6">
          <QrCodeCard
            path={menuPath}
            fileName={`${restaurant.slug}-menu-qr`}
            title="Menu QR code"
            description="Print it for tables or the window. It opens the full menu."
          />
          <CategoriesPanel
            restaurantId={restaurant.id}
            categories={restaurant.categories.map((c) => ({ id: c.id, name: c.name, itemCount: c._count.items }))}
          />
          <RestaurantSettings restaurantId={restaurant.id} name={restaurant.name} slug={restaurant.slug} />
        </aside>
      </div>
    </AdminShell>
  );
}
