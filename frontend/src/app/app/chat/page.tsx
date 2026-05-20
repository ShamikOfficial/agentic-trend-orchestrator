import { Suspense } from "react";
import ChatPage from "@/app/chat/page";

export default function AppChatPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen w-full items-center justify-center px-4 py-16 text-muted-foreground">
          Loading chat…
        </main>
      }
    >
      <ChatPage />
    </Suspense>
  );
}
