import { BrandMark } from "@/components/brand-mark";
import { SetupForm } from "@/components/setup-form";

export default async function SetupPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const sp = await searchParams;
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-16">
      <BrandMark size={48} />
      <div className="text-center">
        <h1 className="text-3xl font-bold">Set your password</h1>
        <p className="mt-2 text-gray-400">
          One-time setup. After this you log in yourself all season.
        </p>
      </div>
      <div className="w-full rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <SetupForm token={sp.token ?? ""} />
      </div>
    </main>
  );
}
