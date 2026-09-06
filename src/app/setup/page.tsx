import { SetupForm } from "@/components/setup-form";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Set your password</h1>
        <p className="mt-2 text-gray-400">
          One-time setup. After this you log in yourself all season.
        </p>
      </div>
      <SetupForm token={sp.token ?? ""} />
    </main>
  );
}
