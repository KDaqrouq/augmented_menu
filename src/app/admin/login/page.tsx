"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import Link from "next/link";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { Alert, Field, buttonClass, inputClass } from "@/components/ui";

function AdminLoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = safeRedirectPath(searchParams.get("from"));
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Login failed");
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setError("Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Admin password" htmlFor="password">
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={inputClass}
          autoComplete="current-password"
          autoFocus
          required
        />
      </Field>
      {error && <Alert>{error}</Alert>}
      <button type="submit" disabled={loading} className={buttonClass("primary", "md", "w-full")}>
        {loading ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-brand-50 to-stone-50 p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 font-display text-xl text-white">
            A
          </span>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-900">Sign in to Admin</h1>
          <p className="mt-1 text-sm text-stone-500">Manage menus, dishes and 3D models.</p>
        </div>
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-card">
          <Suspense fallback={<div className="h-[148px]" />}>
            <AdminLoginForm />
          </Suspense>
        </div>
        <p className="mt-6 text-center text-sm text-stone-500">
          <Link href="/" className="hover:text-stone-800">
            ← Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
