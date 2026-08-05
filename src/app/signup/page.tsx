import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Suspense>
        <AuthForm mode="signup" />
      </Suspense>
    </main>
  );
}
