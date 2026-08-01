import { Suspense } from "react";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";

export default function AdminLoginPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <div className="w-full max-w-md text-center">
        <h1 className="font-[family-name:var(--font-display)] text-2xl font-semibold text-[var(--gold-deep)]">
          Site admin
        </h1>
        <p className="mt-2 mb-8 text-sm text-[var(--cream)]/50">
          Separate from Kelli&apos;s password.
        </p>
        <Suspense fallback={null}>
          <AdminLoginForm />
        </Suspense>
      </div>
    </main>
  );
}
