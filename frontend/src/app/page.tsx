import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function Home() {
  const modules = [
    {
      title: "Team Assistant",
      description: "Summaries, task extraction, ownership, and reminders.",
      status: "In progress",
    },
    {
      title: "Workflow and Milestones",
      description: "Stage transitions from Idea to Publish with checkpoints.",
      status: "In progress",
    },
    {
      title: "Trend and Query Workspace",
      description: "Trend clustering, semantic search, and ideation outputs.",
      status: "Planned",
    },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-6 py-12 md:px-10">
      <section className="space-y-4">
        <p className="text-sm font-medium text-muted-foreground">
          Agentic Trend Orchestrator
        </p>
        <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Production frontend foundation is ready.
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          This UI is built with Next.js, Tailwind, and shadcn/ui. Use this
          workspace to implement feature modules against the FastAPI contracts.
        </p>
        <div className="flex gap-3">
          <Link className={buttonVariants()} href="/team">
            Open Team Module
          </Link>
          <Link className={buttonVariants({ variant: "outline" })} href="/workflow">
            Open Workflow Module
          </Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        {modules.map((module) => (
          <article key={module.title} className="rounded-lg border bg-card p-5">
            <h2 className="font-semibold">{module.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {module.description}
            </p>
            <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {module.status}
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
