"""Debug-mode startup logging (stdout for Railway + local NDJSON file)."""

from __future__ import annotations

import json
import os
import time


def agent_log(
    location: str,
    message: str,
    data: dict | None = None,
    *,
    hypothesis_id: str = "",
    run_id: str = "pre-fix",
) -> None:
    payload = {
        "sessionId": "7377be",
        "runId": run_id,
        "hypothesisId": hypothesis_id,
        "location": location,
        "message": message,
        "data": data or {},
        "timestamp": int(time.time() * 1000),
    }
    line = json.dumps(payload, default=str)
    print(f"[DEBUG-7377be] {line}", flush=True)
    try:
        log_path = os.path.join(os.getcwd(), "debug-7377be.log")
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except OSError:
        pass
