import { Suspense } from "react";
import { PasswordForm } from "@/components/PasswordForm";

export default function LoginPage() {
  return (
    <main className="relative flex min-h-dvh items-center justify-center bg-[var(--ground)] px-6">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(201,162,39,0.28),_transparent_55%),radial-gradient(ellipse_at_bottom,_rgba(44,90,69,0.12),_transparent_50%)]" />
      <div className="relative w-full max-w-md text-center">
        <h1 className="font-[family-name:var(--font-display)] text-4xl text-[var(--forest-deep)] sm:text-5xl">
          For Kelli
        </h1>
        <p className="mt-4 mb-10 text-[var(--cream)]/60">
          Everyone who loves you is already inside.
        </p>
        <Suspense fallback={null}>
          <PasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
