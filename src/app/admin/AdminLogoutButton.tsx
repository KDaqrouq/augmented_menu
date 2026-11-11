"use client";

import { useRouter } from "next/navigation";
import { buttonClass } from "@/components/ui";
import { LogoutIcon } from "@/components/icons";

export function AdminLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button type="button" onClick={handleLogout} className={buttonClass("ghost", "sm")}>
      <LogoutIcon size={16} />
      <span className="hidden sm:inline">Log out</span>
    </button>
  );
}
