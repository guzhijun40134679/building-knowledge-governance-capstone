#!/bin/zsh

set -eu

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
REPO_DIR="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
TEMPLATE_PATH="$REPO_DIR/ops/launchd/com.whitepaper.daemon.plist.template"
DAEMON_SCRIPT="$REPO_DIR/scripts/whitepaper_daemon.zsh"
LOG_DIR="$REPO_DIR/backend/data/runtime_logs"
FRONTEND_DIST_DIR="$REPO_DIR/frontend/dist"
RUNTIME_STATUS_PATH="$REPO_DIR/backend/data/runtime_status.json"
TARGET_DIR="$HOME/Library/LaunchAgents"
TARGET_PLIST="$TARGET_DIR/com.whitepaper.daemon.plist"

mkdir -p "$TARGET_DIR" "$LOG_DIR"

/usr/bin/python3 - "$TEMPLATE_PATH" "$TARGET_PLIST" "$DAEMON_SCRIPT" "$REPO_DIR" "$FRONTEND_DIST_DIR" "$RUNTIME_STATUS_PATH" "$LOG_DIR" <<'PY'
import sys
from pathlib import Path

template = Path(sys.argv[1]).read_text("utf-8")
target = Path(sys.argv[2])
script_path = sys.argv[3]
repo_dir = sys.argv[4]
frontend_dist_dir = sys.argv[5]
runtime_status_path = sys.argv[6]
log_dir = sys.argv[7]

rendered = (
    template.replace("__SCRIPT_PATH__", script_path)
    .replace("__WORK_DIR__", repo_dir)
    .replace("__FRONTEND_DIST_DIR__", frontend_dist_dir)
    .replace("__RUNTIME_STATUS_PATH__", runtime_status_path)
    .replace("__LOG_DIR__", log_dir)
)
target.write_text(rendered, "utf-8")
PY

chmod +x "$DAEMON_SCRIPT"
launchctl bootout "gui/$(id -u)/com.whitepaper.daemon" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$TARGET_PLIST"
launchctl enable "gui/$(id -u)/com.whitepaper.daemon"
launchctl kickstart -k "gui/$(id -u)/com.whitepaper.daemon"

echo "Installed launchd daemon: $TARGET_PLIST"
echo "Log directory: $LOG_DIR"
