import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Agentic Trend Orchestrator",
  description: "Production web UI for trend orchestration workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body suppressHydrationWarning className="min-h-full flex flex-col">
        <header className="fixed inset-x-0 top-0 z-40 border-b bg-background/95 backdrop-blur">
          <nav className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 md:px-8">
            <p className="text-sm font-semibold tracking-wide">Agentic Trend Orchestrator</p>
            <div className="flex items-center gap-2 text-sm">
              <Link className="rounded-md px-3 py-1.5 hover:bg-muted" href="/">
                Home
              </Link>
              <Link className="rounded-md px-3 py-1.5 hover:bg-muted" href="/team">
                Team
              </Link>
              <Link className="rounded-md px-3 py-1.5 hover:bg-muted" href="/workflow">
                Workflow
              </Link>
            </div>
          </nav>
        </header>
        <div className="pt-16">{children}</div>
      </body>
    </html>
  );
}
