import { redirect } from "next/navigation";
import { getSession, liveUserRole } from "@/auth/session";
import { AdminPanel } from "@/components/admin-panel";

export default async function AdminPage() {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId) redirect("/login");
  const role = await liveUserRole(session.userId);
  if (role !== "commissioner") redirect("/picks");
  return <AdminPanel />;
}
