import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-md flex-col items-center gap-6 px-4 py-16">
      <BrandMark size={48} />
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-2 text-gray-400">
          Use the password you set for this season.
        </p>
      </div>
      <div className="w-full rounded-2xl border border-gray-800 bg-gray-900 p-6">
        <LoginForm />
      </div>
      <Link href="/" className="text-sm text-gray-500 hover:text-gray-300">
        Back home
      </Link>
    </main>
  );
}
