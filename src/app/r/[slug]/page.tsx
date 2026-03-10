import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { MenuPageClient } from "./MenuPageClient";

export default async function RestaurantMenuPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const restaurant = await prisma.restaurant.findUnique({
    where: { slug },
    include: {
      categories: {
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            where: { isAvailable: true },
            include: {
              media: { orderBy: { sortOrder: "asc" }, take: 1 },
            },
          },
        },
      },
    },
  });

  if (!restaurant) notFound();

  const categories = restaurant.categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    sortOrder: cat.sortOrder,
    items: cat.items.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description ?? undefined,
      price: item.price ?? undefined,
      thumbnail: item.media[0]?.url ?? undefined,
      arAssetStatus: item.arAssetStatus,
    })),
  }));

  return (
    <MenuPageClient
      slug={slug}
      restaurantId={restaurant.id}
      restaurantName={restaurant.name}
      categories={categories}
    />
  );
}
