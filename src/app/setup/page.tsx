import { SetupForm } from "@/components/setup-form";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Set your password</h1>
        <p className="mt-2 text-slate-400">
          One-time setup. After this you log in yourself all season.
        </p>
      </div>
      <SetupForm token={sp.token ?? ""} />
    </main>
  );
}
