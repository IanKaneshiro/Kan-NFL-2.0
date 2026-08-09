import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/auth/session";
import { getDb, schemaTables } from "@/db";
import { Nav } from "@/components/nav";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) redirect("/login");

  const db = getDb();
  const t = schemaTables();
  const rows = await db
    .select()
    .from(t.users)
    .where(eq(t.users.id, session.userId));
  const user = rows[0];
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <Nav
        displayName={user.displayName}
        isCommissioner={user.role === "commissioner"}
      />
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
