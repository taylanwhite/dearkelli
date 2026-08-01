export default function GatherNotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--ground)] px-6 text-center">
      <div>
        <p className="font-[family-name:var(--font-display)] text-2xl text-[var(--cream)]">
          This gather link isn&apos;t right
        </p>
        <p className="mt-3 text-[var(--cream)]/60">
          Ask Taylan for the one he sent you.
        </p>
      </div>
    </main>
  );
}
