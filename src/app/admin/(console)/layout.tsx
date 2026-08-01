import { AdminNav } from "@/components/admin/AdminNav";

export default function AdminConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminNav />
      <div className="mx-auto max-w-5xl px-5 py-8">{children}</div>
    </>
  );
}
