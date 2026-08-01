import { SiteNav } from "@/components/SiteNav";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[var(--ground)]">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(232,177,76,0.1),_transparent_50%),radial-gradient(ellipse_at_bottom_right,_rgba(228,137,155,0.08),_transparent_45%)]" />
      <div className="relative">
        <SiteNav />
        {children}
      </div>
    </div>
  );
}
