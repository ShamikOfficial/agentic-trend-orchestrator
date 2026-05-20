import { Suspense } from "react";
import { LoginPageClient } from "@/components/login-page-client";

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen w-full items-center justify-center px-4 py-16 text-muted-foreground">
          Loading…
        </main>
      }
    >
      <LoginPageClient />
    </Suspense>
  );
}
