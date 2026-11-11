import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getPublicItem } from "@/lib/menu";
import { getMobilePlatform } from "@/lib/device";
import { ItemDetailView } from "./ItemDetailView";

type Props = { params: Promise<{ slug: string; itemId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, itemId } = await params;
  const data = await getPublicItem(slug, itemId);
  return data
    ? { title: `${data.item.name} · ${data.restaurant.name}`, description: data.item.description }
    : { title: "Dish not found" };
}

export default async function ItemDetailPage({ params }: Props) {
  const { slug, itemId } = await params;
  const data = await getPublicItem(slug, itemId);
  if (!data) notFound();

  const h = await headers();
  return (
    <ItemDetailView
      slug={slug}
      data={data}
      platform={getMobilePlatform(h.get("user-agent") ?? "")}
      origin={`${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`}
    />
  );
}
