/** Frontend-only feature toggles (backend routes stay available). */

function envFlag(name: string, defaultEnabled: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (raw === undefined || raw === "") {
    return defaultEnabled;
  }
  return raw === "1" || raw === "true" || raw === "yes";
}

/** Script hub + editor flow under /app/* (excludes chat, tasks, progress). */
export const SCRIPT_GENERATION_ENABLED = envFlag(
  "NEXT_PUBLIC_ENABLE_SCRIPT_GENERATION",
  false,
);

export const TREND_DETECTION_ENABLED = envFlag("NEXT_PUBLIC_ENABLE_TREND_DETECTION", false);

export const VIDEO_UPLOAD_ENABLED = envFlag("NEXT_PUBLIC_ENABLE_VIDEO_UPLOAD", false);

export const SCRIPT_GENERATION_PATHS = [
  "/app",
  "/app/brief",
  "/app/editor",
  "/app/variations",
  "/app/storyboard",
  "/app/save",
  "/app/chat-brief",
  "/app/chat-review",
] as const;

export const TREND_DETECTION_PATHS = ["/app/trend-detection"] as const;

export const VIDEO_UPLOAD_PATHS = ["/app/upload", "/app/report"] as const;

export function isPathAllowed(pathname: string): boolean {
  const exact = (path: string) => pathname === path;
  const under = (prefix: string) =>
    pathname === prefix || pathname.startsWith(`${prefix}/`);

  if (!SCRIPT_GENERATION_ENABLED) {
    if (SCRIPT_GENERATION_PATHS.some((p) => (p === "/app" ? exact(p) : under(p)))) {
      return false;
    }
  }
  if (!TREND_DETECTION_ENABLED && TREND_DETECTION_PATHS.some((p) => under(p))) {
    return false;
  }
  if (!VIDEO_UPLOAD_ENABLED && VIDEO_UPLOAD_PATHS.some((p) => under(p))) {
    return false;
  }
  return true;
}

const CHAT_AI_ACTIONS = [
  "Summarize discussion",
  "Extract script brief",
  "Extract tasks",
  "Assign tasks",
  "Generate script",
  "Update project progress",
  "Send video report",
] as const;

export function visibleChatAiActions(): readonly string[] {
  return CHAT_AI_ACTIONS.filter((action) => {
    if (!SCRIPT_GENERATION_ENABLED && /script/i.test(action)) {
      return false;
    }
    if (!VIDEO_UPLOAD_ENABLED && /video report/i.test(action)) {
      return false;
    }
    return true;
  });
}
