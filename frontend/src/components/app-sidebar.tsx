"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart2,
  CheckSquare,
  FileText,
  LogOut,
  MessageCircle,
  Settings,
  Upload,
} from "lucide-react";
import { clearAuthToken } from "@/lib/auth-store";
import { loginPathWithReason } from "@/lib/auth-redirect";

const nav = [
  {
    href: "/app/chat",
    label: "Chat",
    Icon: MessageCircle,
    activeFor: ["/app/chat", "/app/chat-brief", "/app/chat-tasks", "/app/chat-review", "/app/report-chat", "/chat"],
  },
  {
    href: "/app",
    label: "Script Generation",
    Icon: FileText,
    activeFor: ["/app", "/app/brief", "/app/editor", "/app/variations", "/app/storyboard", "/app/save"],
  },
  {
    href: "/app/upload",
    label: "Video Upload & Report",
    Icon: Upload,
    activeFor: ["/app/upload", "/app/report"],
  },
  {
    href: "/app/progress",
    label: "Progress Tracker",
    Icon: BarChart2,
    activeFor: ["/app/progress"],
  },
  {
    href: "/app/tasks",
    label: "My Tasks",
    Icon: CheckSquare,
    activeFor: ["/app/tasks", "/workflow"],
  },
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
    <aside className="sticky top-0 flex h-screen w-[72px] shrink-0 flex-col items-center border-r border-[#e5e7eb] bg-white py-5">
      <div className="mb-7 flex h-9 w-9 items-center justify-center rounded-xl bg-[#101828]">
        <span className="text-[15px] font-extrabold tracking-tight text-white">TP</span>
      </div>

      <nav className="flex flex-1 flex-col items-center gap-2">
        {nav.map(({ href, label, Icon, activeFor }) => {
          const isActive = activeFor.some((path) => pathname === path || pathname.startsWith(`${path}/`));
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                isActive
                  ? "bg-[#101828] text-white shadow-sm"
                  : "text-[#9a9ea6] hover:bg-[#f3f4f6] hover:text-[#101828]"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
            </Link>
          );
        })}
      </nav>

      <div className="flex flex-col items-center gap-3">
        <button
          title="Settings"
          className="flex h-11 w-11 items-center justify-center rounded-xl text-[#9a9ea6] transition-colors hover:bg-[#f3f4f6] hover:text-[#101828]"
          type="button"
        >
          <Settings className="h-5 w-5" />
        </button>
        <button
          className="flex h-11 w-11 items-center justify-center rounded-xl text-[#9a9ea6] transition-colors hover:bg-[#f3f4f6] hover:text-[#101828]"
          type="button"
          onClick={handleLogout}
          aria-label="Sign out"
          title="Log out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </aside>
  );
}
