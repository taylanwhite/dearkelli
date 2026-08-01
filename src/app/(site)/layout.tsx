import { SiteNav } from "@/components/SiteNav";
import { StopMediaOnNavigate } from "@/components/StopMediaOnNavigate";

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <StopMediaOnNavigate />
      <div className="relative">
        <SiteNav />
        {children}
      </div>
    </div>
  );
}
