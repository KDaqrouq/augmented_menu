import Link from "next/link";
import { AdminLogoutButton } from "../AdminLogoutButton";
import { AnalyticsDashboard } from "./AnalyticsDashboard";

export default function AdminAnalyticsPage() {
  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Analytics</h1>
        <div className="flex items-center gap-4">
          <Link className="text-blue-600 underline" href="/admin">
            ← Dashboard
          </Link>
          <AdminLogoutButton />
        </div>
      </div>
      <p className="mt-2 text-gray-600">
        Restaurant-level stats, top items, device breakdown.
      </p>

      <div className="mt-6">
        <AnalyticsDashboard />
      </div>
    </main>
  );
}
