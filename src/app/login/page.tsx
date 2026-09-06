import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex max-w-lg flex-col items-center gap-6 px-4 py-16">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Sign in</h1>
        <p className="mt-2 text-gray-400">
          Use the password you set for this season.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
