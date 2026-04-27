"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Home, LogOut, MessageCircle, Users, Workflow } from "lucide-react";
import { clearAuthToken } from "@/lib/auth-store";
import { loginPathWithReason } from "@/lib/auth-redirect";

const nav = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/team", label: "Team", Icon: Users },
  { href: "/workflow", label: "Workflow", Icon: Workflow },
  { href: "/chat", label: "Chat", Icon: MessageCircle },
] as const;

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    clearAuthToken();
    window.dispatchEvent(new Event("auth-changed"));
    router.replace(loginPathWithReason("logged_out"));
  }

  return (
    <aside className="flex h-screen w-[56px] shrink-0 flex-col items-center justify-between border-r border-black/5 bg-[#f4f4f4] py-4 md:w-[64px]">
      <nav className="flex flex-col items-center gap-3">
        {nav.map(({ href, label, Icon }) => {
          const active =
            href === "/"
              ? pathname === "/"
              : pathname === href || pathname.startsWith(`${href}/`);
          return (
            <div key={href} className="group relative">
              <Link
                href={href}
                className={`grid h-11 w-11 place-items-center rounded-xl border text-base transition hover:bg-black/5 md:h-12 md:w-12 ${
                  active
                    ? "border-black/10 bg-[#e8eefc] text-[#22335f]"
                    : "border-black/10 bg-white text-[#222]"
                }`}
                aria-current={active ? "page" : undefined}
                aria-label={label}
              >
                <Icon className="h-5 w-5 md:h-[22px] md:w-[22px]" />
              </Link>
              <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#111] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                {label}
              </span>
            </div>
          );
        })}
      </nav>
      <div className="group relative">
        <button
          className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white text-[#222] transition hover:bg-black/5 md:h-12 md:w-12"
          type="button"
          onClick={handleLogout}
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5 md:h-[22px] md:w-[22px]" />
        </button>
        <span className="pointer-events-none absolute left-[calc(100%+10px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md bg-[#111] px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
          Sign out
        </span>
      </div>
    </aside>
  );
}
