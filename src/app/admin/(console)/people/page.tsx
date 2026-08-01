import { PeopleAdmin } from "@/components/admin/PeopleAdmin";
import { getAdminPeople } from "@/lib/admin-data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function AdminPeoplePage() {
  const people = await getAdminPeople();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-[var(--cream)]">People</h1>
        <p className="mt-1 text-sm text-[var(--cream)]/45">
          Add, edit, regenerate invite links, or remove someone.
        </p>
      </div>
      <PeopleAdmin
        initialPeople={people.map((p) => ({
          ...p,
          createdAt: p.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
