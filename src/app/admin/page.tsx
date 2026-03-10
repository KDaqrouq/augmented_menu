import Link from "next/link";
import { AdminLogoutButton } from "./AdminLogoutButton";
import { AdminDashboard } from "./AdminDashboard";
import { AddRestaurantForm } from "./AddRestaurantForm";

export default function AdminHomePage() {
  return (
    <main className="min-h-screen p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <AdminLogoutButton />
      </div>
      <p className="mt-2 text-gray-600">Restaurants and menu CRUD. Generate QR link per restaurant.</p>

      <div className="mt-6 flex flex-col gap-6">
        <AdminDashboard />
        <div>
          <h2 className="text-lg font-semibold">Add restaurant</h2>
          <AddRestaurantForm />
        </div>
        <div className="flex gap-4">
          <Link className="text-blue-600 underline" href="/admin/analytics">
            Analytics
          </Link>
          <Link className="text-blue-600 underline" href="/">
            Back to home
          </Link>
        </div>
      </div>
    </main>
  );
}

