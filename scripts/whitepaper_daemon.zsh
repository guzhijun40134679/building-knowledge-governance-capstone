#!/bin/zsh

set -eu

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_DIR="$REPO_DIR/frontend"
FRONTEND_DIST_DIR="${FRONTEND_DIST_DIR:-$FRONTEND_DIR/dist}"
PYTHON_BIN="${PYTHON_BIN:-$BACKEND_DIR/.venv/bin/python}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
HOST="${WHITEPAPER_DAEMON_HOST:-0.0.0.0}"
LOG_DIR="$BACKEND_DIR/data/runtime_logs"
PID_FILE="$LOG_DIR/backend.pid"
RUNTIME_STATUS_PATH="${WHITEPAPER_RUNTIME_STATUS_PATH:-$BACKEND_DIR/data/runtime_status.json}"
MONITOR_LOG="$LOG_DIR/daemon-monitor.log"
HEALTH_URL="http://127.0.0.1:$BACKEND_PORT/health"

mkdir -p "$LOG_DIR"
touch "$MONITOR_LOG"

log() {
  print -r -- "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >>"$MONITOR_LOG"
}

append_path_dir() {
  local dir="$1"
  [[ -d "$dir" ]] || return 0
  case ":$PATH:" in
    *":$dir:"*) ;;
    *) PATH="$dir:$PATH" ;;
  esac
}

bootstrap_runtime_path() {
  append_path_dir "/opt/homebrew/bin"
  append_path_dir "/opt/homebrew/sbin"
  append_path_dir "/usr/local/bin"
  append_path_dir "/usr/local/sbin"
  append_path_dir "$HOME/.local/bin"
  append_path_dir "$HOME/bin"
  append_path_dir "$HOME/.pyenv/shims"
}

write_runtime_status() {
  local recovery_at="$1"
  local recovery_reason="$2"
  /usr/bin/python3 - "$RUNTIME_STATUS_PATH" "$recovery_at" "$recovery_reason" <<'PY'
import json
import os
import sys
from pathlib import Path

status_path = Path(sys.argv[1])
recovery_at = sys.argv[2]
recovery_reason = sys.argv[3]
status_path.parent.mkdir(parents=True, exist_ok=True)
data = {}
if status_path.exists():
    try:
        data = json.loads(status_path.read_text("utf-8"))
    except Exception:
        data = {}
data["runtime_mode"] = "daemon"
data["backend_healthy"] = True
data["frontend_healthy"] = Path(os.environ.get("FRONTEND_DIST_DIR", "")).joinpath("index.html").is_file()
data["last_recovery_at"] = recovery_at
data["last_recovery_reason"] = recovery_reason
status_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), "utf-8")
PY
}

frontend_dist_available() {
  [[ -f "$FRONTEND_DIST_DIR/index.html" ]]
}

ensure_frontend_dist() {
  if frontend_dist_available; then
    return 0
  fi
  if ! command -v npm >/dev/null 2>&1; then
    log "npm is unavailable; frontend/dist cannot be built automatically."
    return 1
  fi
  log "frontend/dist was not found; running npm run build."
  (
    cd "$FRONTEND_DIR" || exit 1
    npm run build
  ) >>"$MONITOR_LOG" 2>&1 || return 1
  frontend_dist_available
}

get_lan_ip() {
  local iface=""
  local ip=""
  iface="$(route get default 2>/dev/null | awk '/interface:/{print $2; exit}')"
  if [[ -n "$iface" ]]; then
    ip="$(ipconfig getifaddr "$iface" 2>/dev/null || true)"
  fi
  if [[ -z "$ip" ]]; then
    ip="$(ifconfig 2>/dev/null | awk '/inet / && $2 !~ /^127\./ {print $2; exit}')"
  fi
  print -- "$ip"
}

build_cors_allow_origins() {
  local lan_ip=""
  lan_ip="$(get_lan_ip)"
  if [[ -n "$lan_ip" ]]; then
    print -- "http://localhost:$BACKEND_PORT,http://127.0.0.1:$BACKEND_PORT,http://$lan_ip:$BACKEND_PORT"
  else
    print -- "http://localhost:$BACKEND_PORT,http://127.0.0.1:$BACKEND_PORT"
  fi
}

backend_running() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid=""
  pid="$(<"$PID_FILE")"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" >/dev/null 2>&1
}

backend_healthy() {
  command -v curl >/dev/null 2>&1 || return 1
  curl -fsS "$HEALTH_URL" >/dev/null 2>&1
}

stop_backend() {
  if ! backend_running; then
    rm -f "$PID_FILE"
    return 0
  fi
  local pid=""
  pid="$(<"$PID_FILE")"
  kill "$pid" >/dev/null 2>&1 || true
  rm -f "$PID_FILE"
}

start_backend() {
  bootstrap_runtime_path
  [[ -x "$PYTHON_BIN" ]] || {
    log "Backend virtual environment not found: $PYTHON_BIN"
    return 1
  }
  ensure_frontend_dist || return 1
  stop_backend
  local cors_allow_origins=""
  cors_allow_origins="$(build_cors_allow_origins)"
  log "Starting the daemon backend on port $BACKEND_PORT."
  (
    cd "$BACKEND_DIR" || exit 1
    CORS_ALLOW_ORIGINS="$cors_allow_origins" \
      FRONTEND_DIST_DIR="$FRONTEND_DIST_DIR" \
      WHITEPAPER_RUNTIME_MODE="daemon" \
      WHITEPAPER_BIND_HOST="$HOST" \
      WHITEPAPER_USE_PACKAGED_FRONTEND="1" \
      WHITEPAPER_RUNTIME_STATUS_PATH="$RUNTIME_STATUS_PATH" \
      "$PYTHON_BIN" -m uvicorn main:app --host "$HOST" --port "$BACKEND_PORT"
  ) >>"$MONITOR_LOG" 2>&1 &
  print -- "$!" >"$PID_FILE"
}

ensure_backend_healthy() {
  local reason="$1"
  if backend_healthy; then
    return 0
  fi
  write_runtime_status "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$reason"
  start_backend || return 1
  for _attempt in {1..20}; do
    if backend_healthy; then
      log "Service recovered: $reason"
      return 0
    fi
    sleep 2
  done
  log "The service still fails its health check after restart: $reason"
  return 1
}

main() {
  ensure_backend_healthy "daemon_boot"
  while true; do
    if ! backend_running; then
      ensure_backend_healthy "backend_process_exited" || true
    elif ! backend_healthy; then
      ensure_backend_healthy "health_check_failed_after_sleep_or_disconnect" || true
    fi
    sleep 15
  done
}

main "$@"
