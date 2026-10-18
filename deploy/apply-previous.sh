#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
ENV_FILE="${ROOT}/deploy/.env.prod"
COMPOSE=(docker compose -f "${ROOT}/docker-compose.yml" -f "${ROOT}/deploy/docker-compose.prod.yml" -f "${ROOT}/deploy/docker-compose.ports.yml" --env-file "${ENV_FILE}")
log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
rand_hex() { openssl rand -hex "${1:-24}"; }
rand_alnum() { openssl rand -base64 48 | tr -dc 'A-Za-z0-9' | head -c "${1:-24}"; }

if [[ ! -f "$ENV_FILE" ]]; then
  admin_pass="$(rand_alnum 20)"
  cat > "$ENV_FILE" <<EOF
DOMAIN=www.ekaterina-math.ru
PUBLIC_URL=https://www.ekaterina-math.ru
PUBLIC_LIVEKIT_URL=wss://www.ekaterina-math.ru
JWT_SECRET=$(rand_hex 32)
JWT_REFRESH_SECRET=$(rand_hex 32)
DATABASE_PASSWORD=$(rand_alnum 24)
MINIO_ACCESS_KEY=tuto
MINIO_SECRET_KEY=$(rand_alnum 32)
LIVEKIT_API_KEY=lk$(rand_alnum 12)
LIVEKIT_API_SECRET=$(rand_hex 24)
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
EOF
  chmod 600 "$ENV_FILE"
fi
sed -i 's|^PUBLIC_URL=.*|PUBLIC_URL=https://www.ekaterina-math.ru|' "$ENV_FILE"
sed -i 's|^PUBLIC_LIVEKIT_URL=.*|PUBLIC_LIVEKIT_URL=wss://www.ekaterina-math.ru|' "$ENV_FILE"
sed -i 's|^DOMAIN=.*|DOMAIN=www.ekaterina-math.ru|' "$ENV_FILE"
set -a
source "$ENV_FILE"
set +a

cat > "${ROOT}/infra/livekit.prod.yaml" <<EOF
port: 7880
rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: true
  node_ip: 195.161.62.2
redis:
  # LiveKit runs with host networking in the shared-VPS compose override.
  address: 127.0.0.1:6379
keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}
webhook:
  api_key: ${LIVEKIT_API_KEY}
  urls:
    # LiveKit runs with host networking in this shared-VPS deployment.
    - http://127.0.0.1:3010/api/lessons/livekit-webhook
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
  address: 127.0.0.1:6379
health_port: 8080
prometheus_port: 8081
backup_storage: /out
EOF

rendered="$("${COMPOSE[@]}" config)"
if printf '%s\n' "$rendered" | grep -E 'published: "?300[012]"?' >/dev/null; then
  die "Refusing to bind ports 3000-3002"
fi

log "Building the previous site"
"${COMPOSE[@]}" up -d --build postgres redis minio backend frontend livekit
for i in $(seq 1 120); do
  curl -fsS --max-time 5 http://127.0.0.1:3012/ >/dev/null 2>&1 && curl -fsS --max-time 5 http://127.0.0.1:3010/api/health >/dev/null 2>&1 && break
  sleep 5
  if [[ "$i" -eq 120 ]]; then die "Site did not become ready"; fi
done
cp -a /etc/nginx/sites-available/easyphys.ru "/etc/nginx/sites-available/easyphys.ru.bak.$(date +%Y%m%d%H%M%S)"
cp "${ROOT}/deploy/nginx/shared-vps.conf" /etc/nginx/sites-available/easyphys.ru
nginx -t
systemctl reload nginx
echo SITE_READY
log "Starting model, transcription and recorder from this version"
if ! "${COMPOSE[@]}" up -d transcriber ollama ollama-pull egress; then
  echo "WARN: extra services did not all start"
fi
echo DEPLOY_DONE
echo "ADMIN_EMAIL=${ADMIN_EMAIL}"
echo "ADMIN_PASSWORD=${ADMIN_PASSWORD}"
echo "SITE=https://www.ekaterina-math.ru"
