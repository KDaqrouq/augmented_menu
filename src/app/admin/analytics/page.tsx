import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { AdminShell } from "../AdminShell";
import { AnalyticsDashboard } from "./AnalyticsDashboard";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AdminAnalyticsPage() {
  const restaurants = await prisma.restaurant.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  return (
    <AdminShell active="analytics" title="Analytics" description="How diners use your menus and AR.">
      <AnalyticsDashboard restaurants={restaurants} />
    </AdminShell>
  );
}
