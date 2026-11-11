import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublicMenu } from "@/lib/menu";
import { MenuPageClient } from "./MenuPageClient";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const menu = await getPublicMenu(slug);
  return menu ? { title: `${menu.restaurant.name} menu` } : { title: "Menu not found" };
}

export default async function RestaurantMenuPage({ params }: Props) {
  const { slug } = await params;
  const menu = await getPublicMenu(slug);
  if (!menu) notFound();

  return <MenuPageClient slug={slug} restaurant={menu.restaurant} categories={menu.categories} />;
}
