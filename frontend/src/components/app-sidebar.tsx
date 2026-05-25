"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useSyncExternalStore } from "react";
import {
  BarChart2,
  CheckSquare,
  FileText,
  LogOut,
  MessageCircle,
  Settings,
  Sparkles,
  Upload,
} from "lucide-react";
import { signOut } from "next-auth/react";
import { clearBearerCache } from "@/lib/auth-session";
import { clearAuthToken } from "@/lib/auth-store";
import { loginPathWithReason } from "@/lib/auth-redirect";
import { clearChatUnreadState, getChatUnreadTotal, subscribeChatUnread } from "@/lib/chat-unread-store";
import {
  SCRIPT_GENERATION_ENABLED,
  TREND_DETECTION_ENABLED,
  VIDEO_UPLOAD_ENABLED,
} from "@/lib/feature-flags";

const nav = [
  {
    href: "/app/chat",
    label: "Chat",
    Icon: MessageCircle,
    activeFor: ["/app/chat", "/app/chat-brief", "/app/chat-tasks", "/app/chat-review", "/app/report-chat", "/chat"],
    enabled: true,
  },
  {
    href: "/app/tasks",
    label: "My Tasks",
    Icon: CheckSquare,
    activeFor: ["/app/tasks", "/workflow"],
    enabled: true,
  },
  {
    href: "/app",
    label: "Script Generation",
    Icon: FileText,
    activeFor: ["/app", "/app/brief", "/app/editor", "/app/variations", "/app/storyboard", "/app/save"],
    enabled: SCRIPT_GENERATION_ENABLED,
  },
  {
    href: "/app/trend-detection",
    label: "Trend Detection",
    Icon: Sparkles,
    activeFor: ["/app/trend-detection"],
    enabled: TREND_DETECTION_ENABLED,
  },
  {
    href: "/app/upload",
    label: "Video Upload & Report",
    Icon: Upload,
    activeFor: ["/app/upload", "/app/report"],
    enabled: VIDEO_UPLOAD_ENABLED,
  },
  {
    href: "/app/progress",
    label: "Progress Tracker",
    Icon: BarChart2,
    activeFor: ["/app/progress"],
    enabled: true,
  },
] as const;

const visibleNav = nav.filter((item) => item.enabled);

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const chatUnreadTotal = useSyncExternalStore(subscribeChatUnread, getChatUnreadTotal, () => 0);

  function handleLogout() {
    clearAuthToken();
    clearBearerCache();
    clearChatUnreadState();
    void signOut({ callbackUrl: loginPathWithReason("logged_out") });
    window.dispatchEvent(new Event("auth-changed"));
    router.replace(loginPathWithReason("logged_out"));
  }

  return (
    <aside className="sticky top-0 flex h-screen w-[72px] shrink-0 flex-col items-center border-r border-[#e5e7eb] bg-white py-5">
      <div className="mb-7 flex h-9 w-9 items-center justify-center rounded-xl bg-[#101828]">
        <span className="text-[15px] font-extrabold tracking-tight text-white">TP</span>
      </div>

      <nav className="flex flex-1 flex-col items-center gap-2">
        {visibleNav.map(({ href, label, Icon, activeFor }) => {
          const isActive = activeFor.some((path) => {
            if (pathname === path) return true;
            if (path === "/app") return false;
            return pathname.startsWith(`${path}/`);
          });
          return (
            <Link
              key={href}
              href={href}
              title={label}
              className={`relative flex h-11 w-11 items-center justify-center rounded-xl transition-colors ${
                isActive
                  ? "bg-[#101828] text-white shadow-sm"
                  : "text-[#9a9ea6] hover:bg-[#f3f4f6] hover:text-[#101828]"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              {href === "/app/chat" && chatUnreadTotal > 0 ? (
                <span
                  className="absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-white"
                  aria-label={`${chatUnreadTotal} unread chat message${chatUnreadTotal === 1 ? "" : "s"}`}
                >
                  {chatUnreadTotal > 99 ? "99+" : chatUnreadTotal}
                </span>
              ) : null}
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
