#!/bin/sh
set -e

# #region agent log
_dbg() {
  echo "[DEBUG-7377be] {\"sessionId\":\"7377be\",\"hypothesisId\":\"$2\",\"location\":\"railway_entrypoint.sh\",\"message\":\"$1\",\"timestamp\":$(date +%s)000}"
}
# #endregion

_dbg "container entrypoint started" "H1"
_dbg "alembic upgrade head starting" "H1"
alembic upgrade head
_dbg "alembic upgrade head finished" "H1"
_dbg "uvicorn starting" "H2"
exec uvicorn backend.app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --workers 1
