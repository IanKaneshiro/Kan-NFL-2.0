import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-6 px-4">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Kan NFL Pick&apos;em</h1>
        <p className="mt-2 text-slate-400">
          Sign in with the password you set for this season.
        </p>
      </div>
      <LoginForm />
    </main>
  );
}
