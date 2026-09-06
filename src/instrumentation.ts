export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { ensureCommissioner } = await import("@/db/ensure-commissioner");
    await ensureCommissioner();
  } catch (e) {
    console.error("ensureCommissioner failed", e);
  }
}
