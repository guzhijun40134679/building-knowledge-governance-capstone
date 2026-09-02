#!/bin/zsh

set -u
unsetopt BG_NICE 2>/dev/null || true

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
FRONTEND_DIST_DIR="${FRONTEND_DIST_DIR:-$FRONTEND_DIR/dist}"
PYTHON_BIN="$BACKEND_DIR/.venv/bin/python"
AUTO_YES=0
START_AFTER_INSTALL="ask"

for arg in "$@"; do
  case "$arg" in
    --yes|-y)
      AUTO_YES=1
      ;;
    --start)
      START_AFTER_INSTALL=1
      ;;
    --no-start)
      START_AFTER_INSTALL=0
      ;;
  esac
done

info() {
  print -- "==> $*" >&2
}

warn() {
  print -- "!! $*" >&2
}

pause_before_exit() {
  [[ "$AUTO_YES" == "1" ]] && return 0
  print -- ""
  print -- "Press Return to close this window."
  read -r _
}

fail() {
  print -- ""
  print -- "Installation failed: $*" >&2
  pause_before_exit
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

  hash -r 2>/dev/null || true
}

ask_yes_no() {
  local question="$1"
  local default_answer="${2:-y}"
  local answer=""
  local suffix="[Y/n]"

  if [[ "$default_answer" == "n" ]]; then
    suffix="[y/N]"
  fi

  if [[ "$AUTO_YES" == "1" ]]; then
    [[ "$default_answer" == "y" ]]
    return $?
  fi

  read "answer?$question $suffix "
  answer="${answer:l}"
  if [[ -z "$answer" ]]; then
    answer="$default_answer"
  fi

  # Keep the Chinese affirmative token for input compatibility with existing operators.
  [[ "$answer" == "y" || "$answer" == "yes" || "$answer" == "是" ]]
}

python_version_ok() {
  local python_cmd="$1"
  "$python_cmd" -c 'import sys; raise SystemExit(0 if sys.version_info >= (3, 9) else 1)' >/dev/null 2>&1
}

find_python3() {
  local candidate=""
  local resolved=""

  for candidate in python3 /opt/homebrew/bin/python3 /usr/local/bin/python3 /usr/bin/python3; do
    if [[ "$candidate" == */* ]]; then
      if [[ -x "$candidate" ]] && python_version_ok "$candidate"; then
        print -- "$candidate"
        return 0
      fi
    else
      resolved="$(command -v "$candidate" 2>/dev/null || true)"
      if [[ -n "$resolved" ]] && python_version_ok "$resolved"; then
        print -- "$resolved"
        return 0
      fi
    fi
  done

  return 1
}

ensure_python_runtime() {
  local python_cmd=""
  local brew_bin=""

  bootstrap_runtime_path
  python_cmd="$(find_python3 || true)"
  if [[ -n "$python_cmd" ]]; then
    info "Found Python: $python_cmd"
    print -- "$python_cmd"
    return 0
  fi

  warn "Python 3.9 or newer was not found."
  brew_bin="$(command -v brew 2>/dev/null || true)"
  if [[ -n "$brew_bin" ]] && ask_yes_no "Install Python with Homebrew?" "y"; then
    "$brew_bin" install python || fail "Homebrew could not install Python."
    hash -r 2>/dev/null || true
    python_cmd="$(find_python3 || true)"
    if [[ -n "$python_cmd" ]]; then
      info "Python installation complete: $python_cmd"
      print -- "$python_cmd"
      return 0
    fi
  fi

  if command -v open >/dev/null 2>&1; then
    open "https://www.python.org/downloads/macos/" >/dev/null 2>&1 || true
  fi
  fail "Install Python 3.9 or newer, then run install.command again."
}

ensure_backend_venv() {
  local python_cmd="$1"

  if [[ ! -x "$PYTHON_BIN" ]] || ! python_version_ok "$PYTHON_BIN"; then
    info "Creating or updating the backend Python virtual environment..."
    "$python_cmd" -m venv "$BACKEND_DIR/.venv" || fail "Could not create the Python virtual environment."
    PYTHON_BIN="$BACKEND_DIR/.venv/bin/python"
  fi

  "$PYTHON_BIN" -m ensurepip --upgrade >/dev/null 2>&1 || true
  "$PYTHON_BIN" -m pip --version >/dev/null 2>&1 || fail "pip is unavailable in the virtual environment."
}

install_backend_deps() {
  info "Installing backend dependencies..."
  "$PYTHON_BIN" -m pip install --upgrade pip setuptools wheel || fail "Could not update the Python packaging tools."
  "$PYTHON_BIN" -m pip install -r "$BACKEND_DIR/requirements.txt" || fail "Could not install backend dependencies."
}

ensure_backend_deps() {
  if ! "$PYTHON_BIN" -c "import fastapi, uvicorn, openpyxl, dotenv, fitz" >/dev/null 2>&1; then
    install_backend_deps
    return
  fi

  info "Backend dependencies are ready."
}

ensure_frontend_dist() {
  if [[ -f "$FRONTEND_DIST_DIR/index.html" ]]; then
    info "Frontend build is ready: $FRONTEND_DIST_DIR"
    return 0
  fi

  warn "frontend/dist/index.html was not found."
  if [[ ! -f "$FRONTEND_DIR/package.json" ]]; then
    fail "This package has no frontend build. Run package.command again on the source machine."
  fi

  bootstrap_runtime_path
  if ! command -v node >/dev/null 2>&1 || ! command -v npm >/dev/null 2>&1; then
    fail "Node.js and npm are required to build the frontend here. Prefer sharing the output of package.command."
  fi

  info "Installing frontend dependencies and building static files..."
  (cd "$FRONTEND_DIR" && npm install && npm run build) || fail "Frontend build failed."
  [[ -f "$FRONTEND_DIST_DIR/index.html" ]] || fail "frontend/dist/index.html is still missing after the build."
}

read_env_value() {
  local env_file="$1"
  local key="$2"

  [[ -f "$env_file" ]] || return 0
  awk -F= -v key="$key" '
    $1 == key {
      value = substr($0, index($0, "=") + 1)
    }
    END {
      print value
    }
  ' "$env_file" | sed "s/^[[:space:]\"']*//;s/[[:space:]\"']*$//"
}

write_env_value() {
  local env_file="$1"
  local key="$2"
  local value="$3"
  local temp_file=""

  temp_file="$(mktemp "${TMPDIR:-/tmp}/whitepaper_env.XXXXXX")" || fail "Could not create a temporary configuration file."

  awk -v key="$key" -v value="$value" '
    BEGIN { updated = 0 }
    $0 ~ "^[[:space:]]*" key "=" {
      print key "=" value
      updated = 1
      next
    }
    { print }
    END {
      if (!updated) {
        print key "=" value
      }
    }
  ' "$env_file" > "$temp_file" || {
    rm -f "$temp_file"
    fail "Could not update backend/.env.local."
  }

  mv "$temp_file" "$env_file" || {
    rm -f "$temp_file"
    fail "Could not write backend/.env.local."
  }
}

value_is_placeholder() {
  local value="$1"
  local normalized=""

  normalized="$(printf "%s" "$value" | tr '[:upper:]' '[:lower:]')"
  case "$normalized" in
    ""|"your_key_here"|"your_real_key"|"change_me"|"changeme"|"xxx")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

ensure_env_file() {
  local env_local="$BACKEND_DIR/.env.local"
  local env_example="$BACKEND_DIR/.env.local.example"
  local fallback_example="$BACKEND_DIR/.env.example"

  if [[ -f "$env_local" ]]; then
    info "Local configuration already exists: $env_local"
    return
  fi

  if [[ -f "$env_example" ]]; then
    cp "$env_example" "$env_local" || fail "Could not create backend/.env.local."
  elif [[ -f "$fallback_example" ]]; then
    cp "$fallback_example" "$env_local" || fail "Could not create backend/.env.local."
  else
    print -- "DEEPSEEK_API_KEY=" > "$env_local" || fail "Could not create backend/.env.local."
  fi

  info "Created local configuration: $env_local"
}

prompt_secret_value() {
  local env_file="$1"
  local key="$2"
  local label="$3"
  local required="${4:-0}"
  local current=""
  local answer=""
  local value=""

  current="$(read_env_value "$env_file" "$key")"
  if ! value_is_placeholder "$current"; then
    if ! ask_yes_no "$label is already configured. Replace it?" "n"; then
      return 0
    fi
  fi

  while true; do
    print -- ""
    print -- "$label"
    read -rs "value?Enter $key (input is hidden; press Return to skip): "
    print -- ""
    value="$(printf "%s" "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

    if [[ -n "$value" ]]; then
      write_env_value "$env_file" "$key" "$value"
      info "Saved $key."
      return 0
    fi

    if [[ "$required" != "1" ]]; then
      write_env_value "$env_file" "$key" ""
      warn "Skipped $key. The related optional feature will remain disabled."
      return 0
    fi

    if ! ask_yes_no "$key is required. Try again?" "y"; then
      fail "Missing required setting: $key."
    fi
  done
}

prompt_text_value() {
  local env_file="$1"
  local key="$2"
  local label="$3"
  local required="${4:-0}"
  local current=""
  local value=""

  current="$(read_env_value "$env_file" "$key")"
  if [[ -n "$current" ]]; then
    read "value?$label is already configured. Press Return to keep it, or enter a replacement: "
    if [[ -z "$value" ]]; then
      return 0
    fi
  else
    read "value?$label: "
  fi

  value="$(printf "%s" "$value" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  if [[ -z "$value" && "$required" == "1" ]]; then
    fail "$key cannot be empty."
  fi
  write_env_value "$env_file" "$key" "$value"
}

configure_api_keys() {
  local env_local="$BACKEND_DIR/.env.local"
  local vision_key=""

  print -- ""
  print -- "Optional AI configuration"
  print -- "Secrets are written only to backend/.env.local and are never included in a package."

  prompt_secret_value "$env_local" "DEEPSEEK_API_KEY" "LLM API key for optional extraction and summaries" "0"
  prompt_text_value "$env_local" "DEEPSEEK_MODEL" "LLM model name (for example deepseek-chat or a provider-specific model)" "0"
  prompt_text_value "$env_local" "DEEPSEEK_BASE_URL" "LLM base URL (for example https://api.deepseek.com)" "0"

  vision_key="$(read_env_value "$env_local" "VISION_API_KEY")"
  if ! value_is_placeholder "$vision_key" || ask_yes_no "Configure an optional Vision API for images and scanned PDFs?" "n"; then
    prompt_secret_value "$env_local" "VISION_API_KEY" "Vision API key for optional OCR review" "1"
    prompt_text_value "$env_local" "VISION_MODEL" "Vision model name (for example gpt-4o-mini or a provider-specific model)" "1"
    prompt_text_value "$env_local" "VISION_BASE_URL" "Vision base URL (leave empty for OpenAI, or enter the compatible provider URL)" "0"
  else
    write_env_value "$env_local" "VISION_API_KEY" ""
    write_env_value "$env_local" "VISION_MODEL" ""
    write_env_value "$env_local" "VISION_BASE_URL" ""
    info "Skipped Vision configuration."
  fi
}

password_is_acceptable() {
  local value="$1"
  [[ ${#value} -ge 12 ]] && ! value_is_placeholder "$value"
}

prompt_initial_password() {
  local env_file="$1"
  local key="$2"
  local label="$3"
  local current=""
  local value=""
  local confirmation=""

  current="$(read_env_value "$env_file" "$key")"
  if password_is_acceptable "$current"; then
    if ! ask_yes_no "$label already has an initial password. Replace it?" "n"; then
      return 0
    fi
  fi

  while true; do
    print -- ""
    print -- "$label initial password (required; at least 12 characters)"
    read -rs "value?Enter $key: "
    print -- ""
    if ! password_is_acceptable "$value"; then
      warn "Use a non-placeholder password with at least 12 characters."
      continue
    fi
    read -rs "confirmation?Enter it again: "
    print -- ""
    if [[ "$value" != "$confirmation" ]]; then
      warn "The passwords did not match."
      continue
    fi
    write_env_value "$env_file" "$key" "$value"
    info "Saved the initial password for $label."
    return 0
  done
}

configure_initial_accounts() {
  local env_local="$BACKEND_DIR/.env.local"

  print -- ""
  print -- "Required local account passwords"
  print -- "Use a different password for each role. These values seed only a brand-new local database."
  prompt_initial_password "$env_local" "WHITEPAPER_SUPERADMIN_PASSWORD" "Super Admin"
  prompt_initial_password "$env_local" "WHITEPAPER_ADMIN_PASSWORD" "Admin"
  prompt_initial_password "$env_local" "WHITEPAPER_EMPLOYEE_PASSWORD" "Employee"
  prompt_initial_password "$env_local" "WHITEPAPER_VIEWER_PASSWORD" "Viewer"
}

main() {
  local python_cmd=""

  print -- ""
  print -- "Whitepaper Capstone Installer"
  print -- "This prepares Python, backend dependencies, the frontend build, required local passwords, and optional AI settings."
  print -- ""

  [[ -d "$BACKEND_DIR" ]] || fail "Backend directory not found: $BACKEND_DIR"
  [[ -d "$FRONTEND_DIR" ]] || fail "Frontend directory not found: $FRONTEND_DIR"
  [[ -f "$BACKEND_DIR/requirements.txt" ]] || fail "backend/requirements.txt was not found."

  python_cmd="$(ensure_python_runtime)"
  ensure_backend_venv "$python_cmd"
  ensure_backend_deps
  ensure_frontend_dist
  ensure_env_file
  configure_initial_accounts
  configure_api_keys

  print -- ""
  info "Installation complete."
  print -- "Backend virtual environment: $BACKEND_DIR/.venv"
  print -- "Local configuration: $BACKEND_DIR/.env.local"
  print -- "Run start.command to launch the app."

  if [[ "$START_AFTER_INSTALL" == "1" ]] || { [[ "$START_AFTER_INSTALL" == "ask" ]] && ask_yes_no "Launch Whitepaper now?" "y"; }; then
    exec "$SCRIPT_DIR/start.command"
  fi

  pause_before_exit
}

main "$@"
