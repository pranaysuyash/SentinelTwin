#!/usr/bin/env bash
set -uo pipefail

ROOT="/Users/pranay/Projects/SentinelTwin"
APP="$ROOT/apps/studio"
URL="${SENTINELTWIN_WATCH_URL:-http://localhost:3000/}"
LOG="${SENTINELTWIN_WATCH_LOG:-/tmp/sentineltwin-studio-watch.log}"
SERVER_LOG="${SENTINELTWIN_SERVER_LOG:-/tmp/sentineltwin-studio-watch-server.log}"
PID_FILE="${SENTINELTWIN_SERVER_PID:-/tmp/sentineltwin-studio-watch-server.pid}"
MODE="${SENTINELTWIN_SERVER_MODE:-dev}"
HEALTH_TIMEOUT="${SENTINELTWIN_WATCH_HEALTH_TIMEOUT:-45}"
FAIL_THRESHOLD="${SENTINELTWIN_WATCH_FAIL_THRESHOLD:-3}"

stamp() { date "+%Y-%m-%d %H:%M:%S"; }

log() {
  printf "[%s] %s\n" "$(stamp)" "$*" | tee -a "$LOG"
}

port_pid() {
  lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null | head -1
}

healthy() {
  local body
  body="$(curl -fsS --max-time "$HEALTH_TIMEOUT" "$URL" 2>/dev/null || true)"
  [[ "$body" == *"SentinelTwin"* && "$body" != *"Internal Server Error"* ]]
}

start_server() {
  local existing
  existing="$(port_pid || true)"
  if [[ -n "$existing" ]]; then
    log "port 3000 already has listener pid=$existing; leaving it running to avoid interrupting a recording"
    return 0
  fi

  : > "$SERVER_LOG"
  if [[ "$MODE" == "prod" ]]; then
    log "starting production server on 3000"
    (cd "$APP" && pnpm exec next start -p 3000 -H 127.0.0.1 >>"$SERVER_LOG" 2>&1 & echo $! > "$PID_FILE")
  else
    log "starting webpack dev server on 3000"
    (cd "$ROOT" && STUDIO_DEV_BUNDLER=webpack pnpm dev >>"$SERVER_LOG" 2>&1 & echo $! > "$PID_FILE")
  fi
}

unhealthy_count=0
log "watchdog started mode=$MODE url=$URL timeout=${HEALTH_TIMEOUT}s threshold=$FAIL_THRESHOLD"
while true; do
  if healthy; then
    unhealthy_count=0
    log "healthy"
  else
    unhealthy_count=$((unhealthy_count + 1))
    if [[ "$unhealthy_count" -lt "$FAIL_THRESHOLD" ]]; then
      log "unhealthy check ${unhealthy_count}/${FAIL_THRESHOLD}; waiting before any restart"
    else
      log "unhealthy ${unhealthy_count}/${FAIL_THRESHOLD}; ensuring a server is present"
      start_server
      sleep 18
      if healthy; then
        unhealthy_count=0
        log "recovered"
      else
        log "still unhealthy; latest server log:"
        tail -40 "$SERVER_LOG" | tee -a "$LOG"
      fi
    fi
  fi
  sleep "${SENTINELTWIN_WATCH_INTERVAL:-20}"
done
