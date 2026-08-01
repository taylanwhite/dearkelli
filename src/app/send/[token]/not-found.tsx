export default function SendNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--ground)] px-6 text-center">
      <div>
        <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--cream)]">
          This link doesn&apos;t look right
        </p>
        <p className="mt-3 text-[var(--cream)]/60">
          Ask whoever invited you for a fresh one.
        </p>
      </div>
    </main>
  );
}
