import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { AdminLogoutButton } from "../../AdminLogoutButton";
import { RestaurantManage } from "./RestaurantManage";

export default async function AdminRestaurantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const restaurant = await prisma.restaurant.findUnique({
    where: { id },
    include: {
      categories: { orderBy: { sortOrder: "asc" } },
      items: {
        include: {
          category: { select: { id: true, name: true } },
          media: { orderBy: { sortOrder: "asc" }, take: 1 },
        },
      },
    },
  });
  if (!restaurant) notFound();

  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link href="/admin" className="text-blue-600 underline">
            ← Admin
          </Link>
          <h1 className="text-2xl font-bold">{restaurant.name}</h1>
        </div>
        <AdminLogoutButton />
      </div>
      <p className="mt-1 text-gray-600">
        Slug: <code className="font-mono">{restaurant.slug}</code>
      </p>
      <div className="mt-3 rounded border border-gray-200 bg-gray-50 p-3">
        <p className="text-sm font-medium text-gray-700">QR / Menu link (share this URL)</p>
        <p className="mt-1 font-mono text-sm">
          /r/{restaurant.slug}
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Full URL: use your site origin + /r/{restaurant.slug}
        </p>
      </div>

      <RestaurantManage
        restaurantId={restaurant.id}
        slug={restaurant.slug}
        categories={restaurant.categories}
        items={restaurant.items}
      />
    </main>
  );
}
