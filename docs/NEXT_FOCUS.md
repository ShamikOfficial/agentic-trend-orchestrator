# Next focus (active development)

Working backlog for making this the interview-depth flagship:

1. **Eval harness** — fixed prompts/fixtures for task extraction + summary quality; record pass/fail, not only unit tests.
2. **Failure catalog** — document LLM drift, empty notes, duplicate tasks, schedule parse misses (expand README table with links to tests).
3. **Auth hardening path** — replace local MVP auth store notes with explicit “demo vs production” checklist.
4. **CI** — push `.github/workflows/ci.yml` once GitHub token has `workflow` scope; keep `pytest backend/tests` green on `main`.
5. **Demo script** — 3-minute HM walkthrough: login → assistant → board → chat → trend page.

Do not expand thin satellite repos until this one can carry a 45-minute technical interview alone.
