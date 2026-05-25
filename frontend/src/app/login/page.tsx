import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LoginPageClient } from "@/components/login-page-client";

function LoginLoadingFallback() {
  return (
    <main className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-gradient-to-br from-[#f8f7ff] via-[#f5f7fb] to-[#eef2ff] px-4 py-10">
      <div className="flex flex-col items-center gap-3 text-[#64748b]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" aria-hidden="true" />
        <p className="text-sm font-medium">Loading sign in…</p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingFallback />}>
      <LoginPageClient />
    </Suspense>
  );
}
