import { Suspense } from "react";
import { HomeClient } from "@/components/home-client";

export default function Home() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-screen max-w-7xl items-center justify-center px-4 py-16 text-muted-foreground">
          Loading…
        </main>
      }
    >
      <HomeClient />
    </Suspense>
  );
}
