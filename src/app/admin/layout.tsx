export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[var(--ground)] text-[var(--cream)]">
      {children}
    </div>
  );
}
