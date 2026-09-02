#!/bin/zsh

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
APP_DIR="${WHITEPAPER_APP_DIR:-$(cd "$SCRIPT_DIR/.." && pwd -P)}"
GIT_ROOT="${WHITEPAPER_GIT_ROOT:-$(git -C "$APP_DIR" rev-parse --show-toplevel)}"
BACKEND_DIR="${WHITEPAPER_BACKEND_DIR:-$APP_DIR/backend}"
FRONTEND_DIR="${WHITEPAPER_FRONTEND_DIR:-$APP_DIR/frontend}"
DB_PATH="${WHITEPAPER_DB_PATH:-$BACKEND_DIR/data/whitepaper.db}"
UPLOAD_DIR="${WHITEPAPER_UPLOAD_DIR:-$BACKEND_DIR/uploads}"
LOG_DIR="${WHITEPAPER_UPDATE_LOG_DIR:-$BACKEND_DIR/data/update_logs}"
ALLOW_DIRTY="${WHITEPAPER_UPDATE_ALLOW_DIRTY:-0}"

timestamp="$(date '+%Y%m%d_%H%M%S')"
mkdir -p "$LOG_DIR"
log_file="$LOG_DIR/update_$timestamp.log"
exec > >(tee -a "$log_file") 2>&1

info() {
  print -- "==> $*"
}

fail() {
  print -- "!! $*" >&2
  exit "${2:-1}"
}

require_cmd() {
  local cmd="$1"
  command -v "$cmd" >/dev/null 2>&1 || fail "Missing command: $cmd" 12
}

backup_runtime_data() {
  local backup_root="$BACKEND_DIR/data/update_backups"
  local backup_dir="$backup_root/$timestamp"
  mkdir -p "$backup_dir"

  if [[ -f "$DB_PATH" ]]; then
    info "Backing up database: $DB_PATH"
    cp "$DB_PATH" "$backup_dir/whitepaper.db"
  fi

  if [[ -d "$UPLOAD_DIR" ]]; then
    info "Backing up upload directory: $UPLOAD_DIR"
    tar -czf "$backup_dir/uploads.tgz" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
  fi

  info "Backup complete: $backup_dir"
}

old_commit="$(git -C "$GIT_ROOT" rev-parse --short HEAD 2>/dev/null || true)"
branch="$(git -C "$GIT_ROOT" rev-parse --abbrev-ref HEAD 2>/dev/null || true)"

info "Whitepaper remote update started"
info "Git repository: $GIT_ROOT"
info "Current branch: ${branch:-unknown}"
info "Current revision: ${old_commit:-unknown}"
info "Update log: $log_file"

require_cmd git
require_cmd tar

dirty_status="$(git -C "$GIT_ROOT" status --porcelain)"
if [[ -n "$dirty_status" && "$ALLOW_DIRTY" != "1" ]]; then
  print -- "$dirty_status"
  fail "The working tree has uncommitted changes, so the update was stopped. Commit or clean them first, or explicitly allow a dirty-tree update in the system page." 20
fi

backup_runtime_data

info "Fetching the remote revision"
git -C "$GIT_ROOT" fetch --prune
git -C "$GIT_ROOT" pull --ff-only

if [[ -x "$BACKEND_DIR/.venv/bin/python" && -f "$BACKEND_DIR/requirements.txt" ]]; then
  info "Checking backend dependencies"
  "$BACKEND_DIR/.venv/bin/python" -m pip install -r "$BACKEND_DIR/requirements.txt"
fi

if [[ -f "$FRONTEND_DIR/package.json" ]]; then
  require_cmd npm
  if [[ ! -d "$FRONTEND_DIR/node_modules" ]]; then
    info "Installing frontend dependencies"
    npm --prefix "$FRONTEND_DIR" install
  fi
  info "Building frontend static files"
  npm --prefix "$FRONTEND_DIR" run build
fi

new_commit="$(git -C "$GIT_ROOT" rev-parse --short HEAD 2>/dev/null || true)"
info "Update complete: ${old_commit:-unknown} -> ${new_commit:-unknown}"
