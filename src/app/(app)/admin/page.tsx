import { redirect } from "next/navigation";
import { getSession } from "@/auth/session";
import { AdminPanel } from "@/components/admin-panel";

export default async function AdminPage() {
  const session = await getSession();
  if (session.role !== "commissioner") redirect("/picks");
  return <AdminPanel />;
}
