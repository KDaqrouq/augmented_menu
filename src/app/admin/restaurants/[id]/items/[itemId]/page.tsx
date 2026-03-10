import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AdminLogoutButton } from "@/app/admin/AdminLogoutButton";
import { EditItemForm } from "./EditItemForm";
import { ItemPhotosSection } from "./ItemPhotosSection";
import { ItemGenerate3DSection } from "./ItemGenerate3DSection";

export default async function AdminEditItemPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id: restaurantId, itemId } = await params;
  const item = await prisma.menuItem.findFirst({
    where: { id: itemId, restaurantId },
    include: {
      category: { select: { id: true, name: true } },
      media: { orderBy: { sortOrder: "asc" } },
    },
  });
  if (!item) notFound();

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: restaurantId },
    select: { name: true, slug: true },
  });
  if (!restaurant) notFound();

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href={`/admin/restaurants/${restaurantId}`} className="text-blue-600 underline">
            ← {restaurant.name}
          </Link>
          <h1 className="text-2xl font-bold">Edit: {item.name}</h1>
        </div>
        <AdminLogoutButton />
      </div>

      <EditItemForm
        itemId={item.id}
        restaurantId={restaurantId}
        initial={{
          name: item.name,
          description: item.description ?? "",
          price: item.price ?? "",
          isAvailable: item.isAvailable,
          measurementType: item.measurementType,
          measurementValue: item.measurementValue,
        }}
      />

      <ItemPhotosSection itemId={item.id} media={item.media} />

      <ItemGenerate3DSection itemId={item.id} initialStatus={item.arAssetStatus} />
    </main>
  );
}
