import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { getSession } from "@/auth/session";
import { getDb, schemaTables } from "@/db";

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
  if (!rows[0]) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">{children}</main>
  );
}
