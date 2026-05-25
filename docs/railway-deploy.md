# Railway deployment (Basic plan)

## Services

1. **FastAPI** — this repo, start command from [`railway.toml`](../railway.toml):
   - `alembic upgrade head && uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT --workers 1`
2. **PostgreSQL** — add plugin, link `DATABASE_URL` to the API service.
3. **Volume** — mount `/data` on the API service for uploads and backups.

## Environment variables (API)

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | Injected by Postgres plugin |
| `UPLOAD_ROOT` | `/data/uploads` |
| `TREND_VIDEO_ROOT` | `/data/trend_videos` |
| `AUTH_JWT_SECRET` | Same as Vercel `AUTH_SECRET` |
| `AUTH_JWT_ISSUER` | `https://your-app.vercel.app` |
| `GEMINI_API_KEY` | Platform trial key |
| `LLM_MONTHLY_TOKEN_BUDGET` | `200000` |
| `LLM_MAX_REQUESTS_PER_DAY` | `50` |
| `LLM_GLOBAL_DISABLED` | `false` |
| `ALLOW_PASSWORD_AUTH` | `false` in production |
| `TREND_ANALYTICS_ENABLED` | `false` (recommended) |
| `ADMIN_API_KEY` | Random secret for usage summary |
| `CORS_ORIGINS` | Your Vercel production URL |

## Environment variables (Vercel)

| Variable | Purpose |
|----------|---------|
| `AUTH_SECRET` | Auth.js signing (match `AUTH_JWT_SECRET`) |
| `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` | Google OAuth |
| `AUTH_URL` / `NEXTAUTH_URL` | `https://your-app.vercel.app` |

## Backups

Schedule Railway Cron (or a job service) to run [`scripts/backup_db.sh`](../scripts/backup_db.sh):

```bash
BACKUP_DIR=/data/backups DATABASE_URL=$DATABASE_URL bash scripts/backup_db.sh
```

Keeps 7 days of `pg_dump` files on the volume.

## Deploy order

1. Postgres + migrations (`alembic upgrade head` on deploy).
2. API smoke test: `GET /api/v1/health`.
3. Attach volume; redeploy; test `POST /workflow/uploads`.
4. Configure Vercel Auth.js; sign in → API calls with Bearer JWT.
