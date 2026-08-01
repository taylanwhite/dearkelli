export default function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[#151021] text-[#F6F0E8]">{children}</div>
  );
}
