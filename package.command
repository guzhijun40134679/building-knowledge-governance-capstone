#!/bin/zsh

set -eu
unsetopt BG_NICE 2>/dev/null || true

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
RELEASE_ROOT="$SCRIPT_DIR/release"
PACKAGE_DIR="$RELEASE_ROOT/whitepaper-capstone-package"
ZIP_PATH="$RELEASE_ROOT/whitepaper-capstone-package.zip"
DMG_PATH="$RELEASE_ROOT/whitepaper-capstone-installer.dmg"

info() {
  print -- "==> $*" >&2
}

warn() {
  print -- "!! $*" >&2
}

fail() {
  print -- ""
  print -- "Packaging failed: $*" >&2
  print -- "Press Return to close this window."
  read -r _
  exit 1
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

  if ! command -v node >/dev/null 2>&1; then
    local nvm_dir="${NVM_DIR:-$HOME/.nvm}"
    if [[ -s "$nvm_dir/nvm.sh" ]]; then
      export NVM_DIR="$nvm_dir"
      # shellcheck source=/dev/null
      source "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true
      nvm use --lts >/dev/null 2>&1 || nvm use default >/dev/null 2>&1 || true
    fi
  fi

  hash -r 2>/dev/null || true
}

require_cmd() {
  local cmd="$1"
  local hint="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Missing command: $cmd. $hint"
  fi
}

ensure_frontend_deps() {
  if [[ ! -d "$FRONTEND_DIR/node_modules" || ! -e "$FRONTEND_DIR/node_modules/.bin/vite" ]]; then
    info "Frontend dependencies are missing; installing them now..."
    (cd "$FRONTEND_DIR" && npm install) || fail "Failed to install frontend dependencies."
  fi
}

print -- ""
print -- "Whitepaper Capstone Packager"
print -- "This creates a distribution directory plus zip/dmg packages. The packaged app does not require Node.js."
print -- ""

bootstrap_runtime_path
require_cmd node "Install Node.js 18 or newer first."
require_cmd npm "Install npm first."
require_cmd rsync "rsync is required to assemble the package."

ensure_frontend_deps

info "Building the frontend..."
(cd "$FRONTEND_DIR" && npm run build) || fail "Frontend build failed."

[[ -f "$FRONTEND_DIR/dist/index.html" ]] || fail "dist/index.html was not produced by the frontend build."

rm -rf "$PACKAGE_DIR" || fail "Could not remove the previous package directory."
mkdir -p "$PACKAGE_DIR/frontend" || fail "Could not create the package directory."

info "Assembling a code-only package..."
rsync -a --delete \
  --exclude '.DS_Store' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.venv/' \
  --exclude 'data/' \
  --exclude 'uploads/' \
  --exclude 'pdf_library/' \
  --exclude 'image_library/' \
  --exclude '*.pdf' \
  --exclude '*.xlsx' \
  --exclude '*.xls' \
  --exclude '*.png' \
  --exclude '*.jpg' \
  --exclude '*.jpeg' \
  --exclude '*.webp' \
  --exclude '*.db' \
  --exclude '*.sqlite' \
  --exclude '*.sqlite3' \
  --exclude '*.db-wal' \
  --exclude '*.db-shm' \
  --exclude '*.log' \
  --exclude '__pycache__/' \
  --exclude '*.pyc' \
  --exclude '*.pyo' \
  "$BACKEND_DIR/" "$PACKAGE_DIR/backend/" || fail "Failed to copy the backend source."

# Runtime databases, canonical workbooks, uploads, source documents, and credentials are intentionally never packaged.
mkdir -p "$PACKAGE_DIR/backend/data" || fail "Could not create the empty runtime data directory."

rsync -a --delete "$FRONTEND_DIR/dist/" "$PACKAGE_DIR/frontend/dist/" || fail "Failed to copy the frontend build."

cp "$SCRIPT_DIR/install.command" "$PACKAGE_DIR/install.command" || fail "Failed to copy install.command."
cp "$SCRIPT_DIR/start.command" "$PACKAGE_DIR/start.command" || fail "Failed to copy start.command."
chmod +x "$PACKAGE_DIR/install.command" "$PACKAGE_DIR/start.command" || fail "Could not mark the launcher scripts executable."

if [[ -d "$SCRIPT_DIR/scripts" ]]; then
  rsync -a --delete --exclude '.DS_Store' "$SCRIPT_DIR/scripts/" "$PACKAGE_DIR/scripts/" || fail "Failed to copy operational scripts."
  chmod +x "$PACKAGE_DIR/scripts/install_launchd.command" "$PACKAGE_DIR/scripts/whitepaper_daemon.zsh" 2>/dev/null || true
fi

if [[ -d "$SCRIPT_DIR/ops" ]]; then
  rsync -a --delete --exclude '.DS_Store' "$SCRIPT_DIR/ops/" "$PACKAGE_DIR/ops/" || fail "Failed to copy launchd configuration."
fi

cp "$SCRIPT_DIR/README.md" "$PACKAGE_DIR/README.md" || fail "Failed to copy README.md."
cp "$SCRIPT_DIR/SECURITY_AND_PRIVACY.md" "$PACKAGE_DIR/SECURITY_AND_PRIVACY.md" || fail "Failed to copy SECURITY_AND_PRIVACY.md."
if [[ -d "$SCRIPT_DIR/docs" ]]; then
  rsync -a --delete --exclude '.DS_Store' "$SCRIPT_DIR/docs/" "$PACKAGE_DIR/docs/" || fail "Failed to copy capstone documents."
fi
for artifact in \
  whitepaper-system-architecture.html \
  whitepaper-system-architecture.archify.json \
  whitepaper-business-workflow.html \
  whitepaper-business-workflow.archify.json; do
  cp "$SCRIPT_DIR/$artifact" "$PACKAGE_DIR/$artifact" || fail "Failed to copy $artifact."
done
if [[ -f "$SCRIPT_DIR/MAC_INSTALL_HELP.txt" ]]; then
  cp "$SCRIPT_DIR/MAC_INSTALL_HELP.txt" "$PACKAGE_DIR/MAC_INSTALL_HELP.txt" || fail "Failed to copy MAC_INSTALL_HELP.txt."
fi
find "$PACKAGE_DIR" -name '.DS_Store' -type f -delete

info "Creating compressed packages..."
rm -f "$ZIP_PATH" "$DMG_PATH" || fail "Could not remove previous package files."

if command -v ditto >/dev/null 2>&1; then
  COPYFILE_DISABLE=1 ditto -c -k --norsrc --noextattr --keepParent "$PACKAGE_DIR" "$ZIP_PATH" || warn "Could not create the zip; the distribution directory is still usable."
elif command -v zip >/dev/null 2>&1; then
  (cd "$RELEASE_ROOT" && COPYFILE_DISABLE=1 zip -qry "$(basename "$ZIP_PATH")" "$(basename "$PACKAGE_DIR")" -x "*/.DS_Store" "__MACOSX/*") || warn "Could not create the zip; the distribution directory is still usable."
else
  warn "Neither ditto nor zip is available; skipping the zip archive."
fi

if command -v hdiutil >/dev/null 2>&1; then
  hdiutil create -volname "Whitepaper Capstone" -srcfolder "$PACKAGE_DIR" -ov -format UDZO "$DMG_PATH" >/dev/null || warn "Could not create the dmg; use the zip or distribution directory instead."
else
  warn "hdiutil is unavailable; skipping the dmg image."
fi

print -- ""
info "Package complete: $PACKAGE_DIR"
[[ -f "$ZIP_PATH" ]] && info "Zip package: $ZIP_PATH"
[[ -f "$DMG_PATH" ]] && info "DMG package: $DMG_PATH"
print -- "You can share the dmg, zip, or distribution directory."
print -- "On first use, run install.command; afterwards run start.command."
print -- ""
print -- "Notes:"
print -- "- The package does not require Node.js."
print -- "- The target Mac still needs Python 3.9 or newer; the installer can use Homebrew when available."
print -- "- First-time setup creates .venv, installs backend dependencies, and asks for local account passwords. LLM and Vision integrations are optional."
print -- "- The package intentionally contains no runtime database, canonical Excel workbook, upload, source document, API key, or local status file."
print -- ""
print -- "Press Return to close this window."
read -r _
