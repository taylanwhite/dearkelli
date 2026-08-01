import { MediaAdmin } from "@/components/admin/MediaAdmin";
import { getAdminMedia } from "@/lib/admin-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminMediaPage() {
  const items = await getAdminMedia();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[#F6F0E8]">Uploads</h1>
        <p className="mt-1 text-sm text-[#F6F0E8]/45">
          Filter by status, open files, requeue for{" "}
          <code className="text-[#F6F0E8]/60">npm run process</code>, or delete.
        </p>
      </div>
      <MediaAdmin
        initialMedia={items.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
