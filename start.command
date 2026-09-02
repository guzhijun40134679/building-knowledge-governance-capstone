#!/bin/zsh

set -u
unsetopt BG_NICE 2>/dev/null || true

SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd -P)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
FRONTEND_DIST_DIR="${FRONTEND_DIST_DIR:-$FRONTEND_DIR/dist}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"
PORT_SCAN_LIMIT="${PORT_SCAN_LIMIT:-30}"
PYTHON_BIN="$BACKEND_DIR/.venv/bin/python"
RESTART_REQUEST_FILE="$BACKEND_DIR/data/restart_requested"
BACKEND_PID=""
FRONTEND_PID=""
RUNTIME_MODE=""

info() {
  print -- "==> $*" >&2
}

warn() {
  print -- "!! $*" >&2
}

fail() {
  print -- ""
  print -- "Startup failed: $*" >&2
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

frontend_dist_available() {
  [[ -f "$FRONTEND_DIST_DIR/index.html" ]]
}

require_cmd() {
  local cmd="$1"
  local hint="$2"
  if ! command -v "$cmd" >/dev/null 2>&1; then
    fail "Missing command: $cmd. $hint"
  fi
}

port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  return 1
}

check_port_free() {
  local port="$1"
  local name="$2"
  if port_in_use "$port"; then
    warn "$name port $port is already in use:"
    lsof -nP -iTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
    fail "Stop the process using port $port, or set BACKEND_PORT/FRONTEND_PORT to another port."
  fi
}

choose_available_port() {
  local preferred_port="$1"
  local name="$2"
  local port="$preferred_port"
  local attempts=0

  while (( attempts <= PORT_SCAN_LIMIT )); do
    if ! port_in_use "$port"; then
      if [[ "$port" != "$preferred_port" ]]; then
        warn "$name port $preferred_port is busy; using port $port instead."
      fi
      print -- "$port"
      return 0
    fi
    ((port++))
    ((attempts++))
  done

  fail "No free $name port was found in the $((PORT_SCAN_LIMIT + 1))-port range starting at $preferred_port. Stop a process or choose another port."
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

read_env_value() {
  local env_file="$1"
  local key="$2"

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

api_key_is_placeholder() {
  local api_key="$1"
  local normalized=""

  normalized="$(printf "%s" "$api_key" | tr '[:upper:]' '[:lower:]')"

  case "$normalized" in
    ""|"your_key_here"|"your_real_key"|"change_me"|"xxx")
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

prompt_for_api_key() {
  local env_local="$1"
  local api_key=""
  local action=""

  print -- ""
  print -- "Configure a DeepSeek API key for optional AI features."
  print -- "The key is written only to backend/.env.local and is never printed."

  while true; do
    read -rs "api_key?Enter DEEPSEEK_API_KEY (input is hidden): "
    print -- ""
    api_key="$(printf "%s" "$api_key" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"

    if ! api_key_is_placeholder "$api_key"; then
      write_env_value "$env_local" "DEEPSEEK_API_KEY" "$api_key"
      info "Saved backend/.env.local."
      return 0
    fi

    warn "No usable DEEPSEEK_API_KEY was entered."
    read "action?Press Return to try again, or enter q to cancel: "
    if [[ "${action:l}" == "q" ]]; then
      fail "Run the launcher again when the API key is available."
    fi
  done
}

ensure_env_file() {
  local env_local="$BACKEND_DIR/.env.local"
  local env_example="$BACKEND_DIR/.env.local.example"
  local api_key=""

  if [[ ! -f "$env_local" ]]; then
    if [[ -f "$env_example" ]]; then
      cp "$env_example" "$env_local" || fail "Could not create backend/.env.local."
      warn "Created backend/.env.local from .env.local.example."
    else
      print -- "DEEPSEEK_API_KEY=" > "$env_local" || fail "Could not create backend/.env.local."
      warn "Created backend/.env.local."
    fi
  fi

  api_key="$(read_env_value "$env_local" "DEEPSEEK_API_KEY")"
  if api_key_is_placeholder "$api_key"; then
    warn "DEEPSEEK_API_KEY is not configured. The app will run with optional AI explanations disabled."
  fi
}

ensure_initial_passwords() {
  local env_local="$BACKEND_DIR/.env.local"
  local key=""
  local value=""
  for key in \
    WHITEPAPER_SUPERADMIN_PASSWORD \
    WHITEPAPER_ADMIN_PASSWORD \
    WHITEPAPER_EMPLOYEE_PASSWORD \
    WHITEPAPER_VIEWER_PASSWORD; do
    value="$(read_env_value "$env_local" "$key")"
    if api_key_is_placeholder "$value" || [[ ${#value} -lt 12 ]]; then
      fail "$key must be configured with at least 12 characters. Run install.command first."
    fi
  done
}

install_backend_deps() {
  info "Installing backend dependencies..."
  "$PYTHON_BIN" -m pip install -r "$BACKEND_DIR/requirements.txt" || fail "Could not install backend dependencies."
}

ensure_backend_deps() {
  if [[ ! -x "$PYTHON_BIN" ]]; then
    info "backend/.venv was not found; creating a Python virtual environment..."
    python3 -m venv "$BACKEND_DIR/.venv" || fail "Could not create the Python virtual environment."
    PYTHON_BIN="$BACKEND_DIR/.venv/bin/python"

    install_backend_deps
    return
  fi

  if ! "$PYTHON_BIN" -c "import fastapi, uvicorn, fitz" >/dev/null 2>&1; then
    warn "Backend dependencies are incomplete; installing the missing packages..."
    install_backend_deps
  fi
}

install_frontend_deps() {
  info "Installing frontend dependencies..."
  (cd "$FRONTEND_DIR" && npm install) || fail "Could not install frontend dependencies."
}

ensure_frontend_deps() {
  if [[ ! -d "$FRONTEND_DIR/node_modules" || ! -e "$FRONTEND_DIR/node_modules/.bin/vite" ]]; then
    warn "Frontend dependencies are incomplete; installing them now..."
    install_frontend_deps
  fi
}

ensure_packaged_frontend() {
  if frontend_dist_available; then
    return
  fi
  require_cmd node "Node.js 18 or newer is required to build the packaged frontend."
  require_cmd npm "npm is required to build the packaged frontend."
  ensure_frontend_deps
  info "No frontend build was found; building frontend/dist..."
  (cd "$FRONTEND_DIR" && npm run build) || fail "Frontend build failed."
  frontend_dist_available || fail "frontend/dist/index.html is still missing after the build."
}

cleanup() {
  print -- ""
  info "Stopping local services..."
  for pid in "$FRONTEND_PID" "$BACKEND_PID"; do
    if [[ -n "$pid" ]] && kill -0 "$pid" >/dev/null 2>&1; then
      pkill -TERM -P "$pid" >/dev/null 2>&1 || true
      kill "$pid" >/dev/null 2>&1 || true
    fi
  done
}

wait_for_backend() {
  if ! command -v curl >/dev/null 2>&1; then
    sleep 4
    return
  fi

  local health_url="http://127.0.0.1:$BACKEND_PORT/health"
  for _attempt in {1..30}; do
    if curl -fsS "$health_url" >/dev/null 2>&1; then
      return
    fi
    sleep 1
  done

  warn "The backend /health check has not succeeded; the service log may contain more detail."
}

start_backend_process() {
  info "Starting backend: http://$HOST:$BACKEND_PORT"
  (
    cd "$BACKEND_DIR" || exit 1
    if [[ "$RUNTIME_MODE" == "dev" ]]; then
      CORS_ALLOW_ORIGINS="$CORS_ALLOW_ORIGINS" FRONTEND_DIST_DIR="$FRONTEND_DIST_DIR" WHITEPAPER_RUNTIME_MODE="dev" WHITEPAPER_BIND_HOST="$HOST" WHITEPAPER_ALLOW_DEFAULT_PASSWORD_ON_LAN_RUNTIME="$ALLOW_DEFAULT_PASSWORD_ON_LAN_FOR_RUN" "$PYTHON_BIN" -m uvicorn main:app --reload --host "$HOST" --port "$BACKEND_PORT"
    else
      CORS_ALLOW_ORIGINS="$CORS_ALLOW_ORIGINS" FRONTEND_DIST_DIR="$FRONTEND_DIST_DIR" WHITEPAPER_RUNTIME_MODE="daemon" WHITEPAPER_BIND_HOST="$HOST" WHITEPAPER_USE_PACKAGED_FRONTEND="1" WHITEPAPER_ALLOW_DEFAULT_PASSWORD_ON_LAN_RUNTIME="$ALLOW_DEFAULT_PASSWORD_ON_LAN_FOR_RUN" "$PYTHON_BIN" -m uvicorn main:app --host "$HOST" --port "$BACKEND_PORT"
    fi
  ) &
  BACKEND_PID=$!
}

print -- ""
print -- "Whitepaper Capstone Local Launcher"
print -- "Development mode is for local debugging; daemon mode is for a trusted LAN host."
print -- "The launcher can create the virtual environment and install dependencies. AI integrations are optional."
print -- ""
read "RUNTIME_MODE_CHOICE?Choose runtime mode [1=daemon recommended, 2=development, Return=1]: "
RUNTIME_MODE_CHOICE="${RUNTIME_MODE_CHOICE:-1}"
if [[ "$RUNTIME_MODE_CHOICE" == "2" ]]; then
  RUNTIME_MODE="dev"
else
  RUNTIME_MODE="daemon"
fi
read "MODE?Choose network mode [1=local only, 2=trusted LAN, Return=1]: "
MODE="${MODE:-1}"
if [[ "$MODE" != "2" ]]; then
  MODE="1"
fi
ALLOW_DEFAULT_PASSWORD_ON_LAN_FOR_RUN="${WHITEPAPER_ALLOW_DEFAULT_PASSWORD_ON_LAN:-}"

bootstrap_runtime_path
require_cmd python3 "Install Python 3.9 or newer first."
if [[ "$RUNTIME_MODE" == "dev" ]]; then
  require_cmd node "Install Node.js 18 or newer first."
  require_cmd npm "Install npm first."
else
  ensure_packaged_frontend
  info "Daemon mode enabled: the backend serves the packaged frontend; Vite will not start."
fi

ensure_env_file
ensure_initial_passwords
BACKEND_PORT="$(choose_available_port "$BACKEND_PORT" "backend")"

ensure_backend_deps
if [[ "$RUNTIME_MODE" == "dev" ]]; then
  FRONTEND_PORT="$(choose_available_port "$FRONTEND_PORT" "frontend")"
  ensure_frontend_deps
fi

if [[ "$MODE" == "2" ]]; then
  LAN_IP="$(get_lan_ip)"
  if [[ -z "$LAN_IP" ]]; then
    fail "No LAN address was detected. Check the network connection or use local-only mode."
  fi

  if [[ "${ALLOW_DEFAULT_PASSWORD_ON_LAN_FOR_RUN:-}" != "1" ]]; then
    print -- ""
    warn "LAN mode exposes the service to other devices on the same network. The backend rejects unchanged initial passwords by default."
    print -- "Recommended: start locally and change the initial passwords before enabling LAN access."
    print -- "For a temporary trusted-network test, you can explicitly accept the risk for this run."
    read "LAN_PASSWORD_RISK?Choose [1=use local-only mode, 2=accept risk for this run, Return=1]: "
    LAN_PASSWORD_RISK="${LAN_PASSWORD_RISK:-1}"
    if [[ "$LAN_PASSWORD_RISK" == "2" ]]; then
      ALLOW_DEFAULT_PASSWORD_ON_LAN_FOR_RUN="1"
      warn "Initial-password risk accepted for this run. Use only on a trusted network."
    else
      MODE="1"
      warn "Switched to local-only mode."
    fi
  fi
fi

if [[ "$MODE" == "2" ]]; then

  HOST="0.0.0.0"
  if [[ "$RUNTIME_MODE" == "dev" ]]; then
    FRONTEND_URL="http://$LAN_IP:$FRONTEND_PORT"
    API_BASE="http://$LAN_IP:$BACKEND_PORT"
    CORS_ALLOW_ORIGINS="http://localhost:$FRONTEND_PORT,http://127.0.0.1:$FRONTEND_PORT,http://$LAN_IP:$FRONTEND_PORT"
  else
    FRONTEND_URL="http://$LAN_IP:$BACKEND_PORT"
    API_BASE="$FRONTEND_URL"
    CORS_ALLOW_ORIGINS="http://localhost:$BACKEND_PORT,http://127.0.0.1:$BACKEND_PORT,http://$LAN_IP:$BACKEND_PORT"
  fi
  warn "LAN mode allows devices on the same network to reach this service. Use only on a trusted network."
else
  HOST="127.0.0.1"
  if [[ "$RUNTIME_MODE" == "dev" ]]; then
    FRONTEND_URL="http://localhost:$FRONTEND_PORT"
    API_BASE="http://127.0.0.1:$BACKEND_PORT"
    CORS_ALLOW_ORIGINS="http://localhost:$FRONTEND_PORT,http://127.0.0.1:$FRONTEND_PORT"
  else
    FRONTEND_URL="http://localhost:$BACKEND_PORT"
    API_BASE="http://127.0.0.1:$BACKEND_PORT"
    CORS_ALLOW_ORIGINS="http://localhost:$BACKEND_PORT,http://127.0.0.1:$BACKEND_PORT"
  fi
fi

trap cleanup INT TERM EXIT

start_backend_process
wait_for_backend

if [[ "$RUNTIME_MODE" == "dev" ]]; then
  info "Starting frontend: $FRONTEND_URL"
  (
    cd "$FRONTEND_DIR" || exit 1
    VITE_API_BASE="$API_BASE" npm run dev -- --host "$HOST" --port "$FRONTEND_PORT" --strictPort
  ) &
  FRONTEND_PID=$!
else
  info "The packaged frontend is served by the backend: $FRONTEND_URL"
fi

print -- ""
info "Open: $FRONTEND_URL"
if [[ "$MODE" == "2" || "$RUNTIME_MODE" == "dev" ]]; then
  info "Backend API: $API_BASE"
fi
print -- "Press Control-C to stop the services."
print -- ""

if command -v open >/dev/null 2>&1; then
  open "$FRONTEND_URL" >/dev/null 2>&1 || true
fi

while true; do
  if ! kill -0 "$BACKEND_PID" >/dev/null 2>&1; then
    if [[ -f "$RESTART_REQUEST_FILE" ]]; then
      rm -f "$RESTART_REQUEST_FILE"
      info "A system update completed; restarting the backend..."
      start_backend_process
      wait_for_backend
      continue
    fi
    fail "The backend process exited."
  fi
  if [[ "$RUNTIME_MODE" == "dev" ]] && ! kill -0 "$FRONTEND_PID" >/dev/null 2>&1; then
    fail "The frontend process exited."
  fi
  sleep 2
done
