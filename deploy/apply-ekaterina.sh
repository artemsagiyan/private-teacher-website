#!/usr/bin/env bash
# Install TutorPlatform on www.ekaterina-math.ru without taking the other vhosts.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${ROOT}/deploy/.env.prod"
COMPOSE=(docker compose -f "${ROOT}/docker-compose.yml" -f "${ROOT}/deploy/docker-compose.prod.yml" -f "${ROOT}/deploy/docker-compose.ekaterina.yml" --env-file "${ENV_FILE}")

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker already installed: $(docker --version)"
    return
  fi
  log "Installing Docker"
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg openssl
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  . /etc/os-release
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
}

rand_hex() { openssl rand -hex "${1:-24}"; }
rand_alnum() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "${1:-24}"; }

write_env() {
  if [[ -f "$ENV_FILE" ]]; then
    log "Keeping existing ${ENV_FILE}"
    return
  fi
  log "Writing ${ENV_FILE}"
  local jwt jwt_r db minio_secret lk_key lk_sec admin_pass
  jwt="$(rand_hex 32)"
  jwt_r="$(rand_hex 32)"
  db="$(rand_alnum 24)"
  minio_secret="$(rand_alnum 32)"
  lk_key="lk$(rand_alnum 12)"
  lk_sec="$(rand_hex 24)"
  admin_pass="$(rand_alnum 20)"
  cat > "$ENV_FILE" <<EOF
DOMAIN=www.ekaterina-math.ru
PUBLIC_URL=https://www.ekaterina-math.ru
PUBLIC_LIVEKIT_URL=wss://www.ekaterina-math.ru

JWT_SECRET=${jwt}
JWT_REFRESH_SECRET=${jwt_r}
DATABASE_PASSWORD=${db}
MINIO_ACCESS_KEY=tutor
MINIO_SECRET_KEY=${minio_secret}
LIVEKIT_API_KEY=${lk_key}
LIVEKIT_API_SECRET=${lk_sec}

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@ekaterina-math.ru

WHISPER_MODEL=small
WHISPER_DEVICE=cpu
OLLAMA_MODEL=qwen2.5:3b
ENABLE_SEED=false
SMTP_DISABLED=true
ADMIN_EMAIL=admin@ekaterina-math.ru
ADMIN_PASSWORD=${admin_pass}
COMPUTE_MODE=remote
COMPUTE_SECRET=$(rand_hex 24)
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
EOF
  chmod 600 "$ENV_FILE"
}

ensure_compute_env() {
  local current secret
  current="$(grep '^COMPUTE_SECRET=' "$ENV_FILE" | cut -d= -f2- || true)"
  if [[ -z "$current" ]]; then
    secret="$(rand_hex 24)"
    if grep -q '^COMPUTE_SECRET=' "$ENV_FILE"; then
      sed -i "s|^COMPUTE_SECRET=.*|COMPUTE_SECRET=${secret}|" "$ENV_FILE"
    else
      printf 'COMPUTE_SECRET=%s\n' "$secret" >> "$ENV_FILE"
    fi
  fi
  if grep -q '^COMPUTE_MODE=' "$ENV_FILE"; then
    sed -i 's|^COMPUTE_MODE=.*|COMPUTE_MODE=remote|' "$ENV_FILE"
  else
    printf 'COMPUTE_MODE=remote\n' >> "$ENV_FILE"
  fi
  grep -q '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" || printf 'TELEGRAM_BOT_TOKEN=\n' >> "$ENV_FILE"
  grep -q '^TELEGRAM_CHAT_ID=' "$ENV_FILE" || printf 'TELEGRAM_CHAT_ID=\n' >> "$ENV_FILE"
  chmod 600 "$ENV_FILE"
}

load_env() {
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

write_livekit_configs() {
  log "Writing LiveKit configs"
  load_env
  cat > "${ROOT}/infra/livekit.prod.yaml" <<EOF
port: 7880

rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: true
  node_ip: 195.161.62.2

redis:
  address: redis:6379

keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}

webhook:
  api_key: ${LIVEKIT_API_KEY}
  urls:
    - http://backend:3001/api/lessons/livekit-webhook

turn:
  enabled: true
  domain: www.ekaterina-math.ru
  udp_port: 3478

room:
  empty_timeout: 1800
  departure_timeout: 1800
EOF

  cat > "${ROOT}/infra/egress.prod.yaml" <<EOF
api_key: ${LIVEKIT_API_KEY}
api_secret: ${LIVEKIT_API_SECRET}
ws_url: ws://livekit:7880
insecure: true

redis:
  address: redis:6379

health_port: 8080
prometheus_port: 8081
backup_storage: /out
EOF
}

assert_ports() {
  log "Checking published ports"
  local rendered
  rendered="$("${COMPOSE[@]}" config)"
  if printf '%s\n' "$rendered" | grep -E 'published: "?300[012]"?' >/dev/null; then
    printf '%s\n' "$rendered" | grep -nE 'published:|target:' | head -80
    die "Compose wants host ports 3000-3002, which belong to the old sites"
  fi
}

switch_nginx() {
  log "Switching nginx: www.ekaterina-math.ru → TutorPlatform"
  local src="/etc/nginx/sites-available/easyphys.ru"
  cp -a "$src" "${src}.bak.$(date +%Y%m%d%H%M%S)"
  cp "${ROOT}/deploy/nginx/shared-vps.conf" "$src"
  nginx -t
  systemctl reload nginx
}

wait_http() {
  local url="$1"
  local i
  for i in $(seq 1 120); do
    if curl -fsS --max-time 5 "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done
  return 1
}

main() {
  log "TutorPlatform beside the existing sites"
  install_docker
  write_env
  ensure_compute_env
  write_livekit_configs
  assert_ports
  log "Building and starting the site without the GPU model"
  "${COMPOSE[@]}" up -d --build postgres redis minio backend frontend livekit
  "${COMPOSE[@]}" ps
  log "Waiting for frontend and API"
  wait_http "http://127.0.0.1:3012/" || die "Frontend on :3012 did not become ready"
  wait_http "http://127.0.0.1:3010/api/health" || die "Backend on :3010 did not become ready"
  switch_nginx
  echo "SITE_READY"
  log "Starting lesson recorder"
  if ! "${COMPOSE[@]}" up -d egress; then
    echo "WARN: lesson recorder did not start"
  fi
  load_env
  echo "DEPLOY_DONE"
  echo "ADMIN_EMAIL=${ADMIN_EMAIL}"
  echo "ADMIN_PASSWORD=${ADMIN_PASSWORD}"
  echo "COMPUTE_SECRET=${COMPUTE_SECRET}"
  echo "SITE=https://www.ekaterina-math.ru"
}

main
