import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { buttonClass } from "@/components/ui";
import { ExternalIcon } from "@/components/icons";
import { AdminShell } from "@/app/admin/AdminShell";
import { EditItemForm } from "./EditItemForm";
import { ItemPhotosSection } from "./ItemPhotosSection";
import { ItemGenerate3DSection } from "./ItemGenerate3DSection";

type Props = { params: Promise<{ id: string; itemId: string }> };

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { itemId } = await params;
  const item = await prisma.menuItem.findUnique({ where: { id: itemId }, select: { name: true } });
  return { title: item?.name ?? "Dish" };
}

export default async function AdminEditItemPage({ params }: Props) {
  const { id: restaurantId, itemId } = await params;
  const item = await prisma.menuItem.findFirst({
    where: { id: itemId, restaurantId },
    include: {
      restaurant: {
        select: {
          name: true,
          slug: true,
          categories: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } },
        },
      },
      media: { orderBy: { sortOrder: "asc" }, select: { id: true, url: true, sortOrder: true } },
      _count: { select: { assets: true } },
    },
  });
  if (!item) notFound();

  const publicPath = `/r/${item.restaurant.slug}/item/${item.id}`;

  return (
    <AdminShell
      active="restaurants"
      crumbs={[
        { label: "Restaurants", href: "/admin" },
        { label: item.restaurant.name, href: `/admin/restaurants/${restaurantId}` },
        { label: item.name },
      ]}
      title={item.name}
      actions={
        item.isAvailable && (
          <a href={publicPath} target="_blank" rel="noopener noreferrer" className={buttonClass("secondary", "sm")}>
            <ExternalIcon size={16} /> View on menu
          </a>
        )
      }
    >
      <div className="grid items-start gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-6">
          <ItemPhotosSection itemId={item.id} media={item.media} />
          <EditItemForm
            itemId={item.id}
            restaurantId={restaurantId}
            categories={item.restaurant.categories}
            hasModel={item._count.assets > 0}
            initial={{
              name: item.name,
              description: item.description ?? "",
              price: item.price ?? "",
              isAvailable: item.isAvailable,
              categoryId: item.categoryId ?? "",
              measurementType: item.measurementType,
              measurementValue: item.measurementValue,
            }}
          />
        </div>
        <div className="lg:sticky lg:top-20">
          <ItemGenerate3DSection
            itemId={item.id}
            initialStatus={item.arAssetStatus}
            initialPhotoCount={item.media.length}
            previewPath={`${publicPath}/ar`}
          />
        </div>
      </div>
    </AdminShell>
  );
}
