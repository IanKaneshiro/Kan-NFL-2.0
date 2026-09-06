import { getSession } from "@/auth/session";
import { jsonOk } from "@/lib/api";

export async function POST() {
  const session = await getSession();
  session.destroy();
  return jsonOk({ ok: true });
}
