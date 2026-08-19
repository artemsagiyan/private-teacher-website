#!/usr/bin/env bash
# TutorPlatform one-shot production deploy for easyphys.ru (shared VPS + nginx).
#
# On the server:
#   git clone git@github.com:artemsagiyan/private-teacher-website.git
#   cd private-teacher-website
#   sudo bash deploy/deploy.sh
#
# Options:
#   DOMAIN=easyphys.ru EMAIL=you@mail.ru sudo -E bash deploy/deploy.sh
#   sudo bash deploy/deploy.sh --skip-ssl
#   sudo bash deploy/deploy.sh --yes

set -euo pipefail

DOMAIN="${DOMAIN:-easyphys.ru}"
LIVEKIT_HOST="${LIVEKIT_HOST:-live.${DOMAIN}}"
EMAIL="${EMAIL:-admin@${DOMAIN}}"
SKIP_SSL=0
ASSUME_YES=0
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${SCRIPT_DIR}/.env.prod"
COMPOSE=(docker compose -f "${ROOT_DIR}/docker-compose.yml" -f "${SCRIPT_DIR}/docker-compose.prod.yml" --env-file "${ENV_FILE}")

log()  { printf '\n\033[1;36m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mWARN:\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31mERROR:\033[0m %s\n' "$*" >&2; exit 1; }

for arg in "$@"; do
  case "$arg" in
    --skip-ssl) SKIP_SSL=1 ;;
    --yes|-y) ASSUME_YES=1 ;;
    --help|-h)
      sed -n '2,20p' "$0"
      exit 0
      ;;
    *) die "Unknown argument: $arg" ;;
  esac
done

[[ "$(id -u)" -eq 0 ]] || die "Run as root: sudo bash deploy/deploy.sh"

confirm() {
  local msg="$1"
  if [[ "$ASSUME_YES" -eq 1 ]]; then return 0; fi
  read -r -p "$msg [y/N] " ans
  [[ "$ans" == "y" || "$ans" == "Y" ]]
}

rand_hex() { openssl rand -hex "${1:-24}"; }
rand_alnum() { openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | head -c "${1:-32}"; }

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"
}

install_docker() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "Docker already installed"
    return
  fi
  log "Installing Docker"
  apt-get update -y
  apt-get install -y ca-certificates curl gnupg
  install -m 0755 -d /etc/apt/keyrings
  if [[ ! -f /etc/apt/keyrings/docker.asc ]]; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
  fi
  . /etc/os-release
  echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -y
  apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
  systemctl enable --now docker
}

install_packages() {
  log "Installing nginx / certbot / helpers"
  apt-get update -y
  apt-get install -y nginx openssl curl dnsutils
  if [[ "$SKIP_SSL" -eq 0 ]]; then
    apt-get install -y certbot python3-certbot-nginx
  fi
}

free_port_3000() {
  if ! ss -tlnp | grep -q ':3000'; then
    log "Port 3000 is free"
    return
  fi
  warn "Port 3000 is busy (current easyphys.ru app)."
  if confirm "Stop whatever is listening on :3000 so TutorPlatform can bind?"; then
    if command -v pm2 >/dev/null 2>&1; then
      pm2 stop all || true
    fi
    fuser -k 3000/tcp 2>/dev/null || true
    sleep 1
  else
    die "Cannot continue while :3000 is occupied"
  fi
}

write_env() {
  log "Writing ${ENV_FILE}"
  local scheme="https"
  local lk_scheme="wss"
  if [[ "$SKIP_SSL" -eq 1 ]]; then
    scheme="http"
    lk_scheme="ws"
  fi

  if [[ -f "$ENV_FILE" ]]; then
    warn "Updating public URLs in existing ${ENV_FILE}"
    sed -i "s|^DOMAIN=.*|DOMAIN=${DOMAIN}|" "$ENV_FILE"
    sed -i "s|^PUBLIC_URL=.*|PUBLIC_URL=${scheme}://${DOMAIN}|" "$ENV_FILE"
    sed -i "s|^PUBLIC_LIVEKIT_URL=.*|PUBLIC_LIVEKIT_URL=${lk_scheme}://${LIVEKIT_HOST}|" "$ENV_FILE"
    return
  fi

  local jwt jwt_r db minio_secret lk_key lk_sec
  jwt="$(rand_hex 32)"
  jwt_r="$(rand_hex 32)"
  db="$(rand_alnum 24)"
  minio_secret="$(rand_alnum 32)"
  lk_key="lk$(rand_alnum 12)"
  lk_sec="$(rand_hex 24)"

  cat > "$ENV_FILE" <<EOF
DOMAIN=${DOMAIN}
PUBLIC_URL=${scheme}://${DOMAIN}
PUBLIC_LIVEKIT_URL=${lk_scheme}://${LIVEKIT_HOST}

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
SMTP_FROM=noreply@${DOMAIN}

WHISPER_MODEL=small
OLLAMA_MODEL=qwen2.5:3b
EOF
  chmod 600 "$ENV_FILE"
}

load_env() {
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
}

write_livekit_configs() {
  log "Writing LiveKit / Egress prod configs"
  load_env
  cat > "${ROOT_DIR}/infra/livekit.prod.yaml" <<EOF
port: 7880

rtc:
  tcp_port: 7881
  udp_port: 7882
  use_external_ip: true

redis:
  address: redis:6379

keys:
  ${LIVEKIT_API_KEY}: ${LIVEKIT_API_SECRET}

webhook:
  api_key: ${LIVEKIT_API_KEY}
  urls:
    - http://backend:3001/api/lessons/livekit-webhook

room:
  empty_timeout: 1800
  departure_timeout: 1800
EOF

  cat > "${ROOT_DIR}/infra/egress.prod.yaml" <<EOF
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

backup_nginx() {
  local src="/etc/nginx/sites-enabled/easyphys.ru"
  if [[ -f "$src" ]]; then
    local bak="/etc/nginx/sites-enabled/easyphys.ru.bak.$(date +%Y%m%d%H%M%S)"
    cp -a "$src" "$bak"
    log "Backed up nginx site to ${bak}"
  fi
}

install_nginx_site() {
  log "Configuring nginx for ${DOMAIN} + ${LIVEKIT_HOST}"

  mkdir -p /etc/nginx/conf.d
  cp "${SCRIPT_DIR}/nginx/upgrade-map.conf" /etc/nginx/conf.d/00-upgrade-map.conf

  # Preserve neighbour sites from the old combined config if present
  local old="/etc/nginx/sites-enabled/easyphys.ru"
  local others="/etc/nginx/sites-available/other-vhosts.conf"
  if [[ -f "$old" ]] && ! grep -q 'tutor_frontend' "$old" 2>/dev/null; then
    # Extract non-easyphys server blocks roughly by keeping known neighbours
    cat > "$others" <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name ekaterina-math.ru www.ekaterina-math.ru;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name nadejda-repetitor.ru www.nadejda-repetitor.ru;

    location / {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
    ln -sfn "$others" /etc/nginx/sites-enabled/other-vhosts.conf
  fi

  local conf="/etc/nginx/sites-available/tutorplatform.conf"
  sed \
    -e "s/__DOMAIN__/${DOMAIN}/g" \
    -e "s/__LIVEKIT_HOST__/${LIVEKIT_HOST}/g" \
    "${SCRIPT_DIR}/nginx/tutorplatform.conf.template" > "$conf"
  ln -sfn "$conf" /etc/nginx/sites-enabled/tutorplatform.conf

  # Disable old combined file to avoid duplicate server_name / default_server
  if [[ -f "$old" ]]; then
    rm -f "$old"
  fi
  # Also remove broken default if any
  rm -f /etc/nginx/sites-enabled/default

  nginx -t
  systemctl reload nginx
}

check_dns() {
  log "Checking DNS"
  local ip
  ip="$(curl -4 -fsS --max-time 5 ifconfig.me || curl -4 -fsS --max-time 5 icanhazip.com || true)"
  ip="$(echo "$ip" | tr -d '[:space:]')"
  [[ -n "$ip" ]] || warn "Could not detect public IP"

  local d_ip l_ip
  d_ip="$(dig +short "${DOMAIN}" A | tail -n1 || true)"
  l_ip="$(dig +short "${LIVEKIT_HOST}" A | tail -n1 || true)"

  echo "  Server IP:     ${ip:-unknown}"
  echo "  ${DOMAIN} →      ${d_ip:-none}"
  echo "  ${LIVEKIT_HOST} → ${l_ip:-none}"

  if [[ -n "$ip" && -n "$d_ip" && "$d_ip" != "$ip" ]]; then
    warn "${DOMAIN} does not point to this server (${d_ip} != ${ip})"
  fi
  if [[ -z "$l_ip" ]]; then
    warn "Add DNS A-record: ${LIVEKIT_HOST} → ${ip:-THIS_SERVER_IP}  (required for video lessons)"
  elif [[ -n "$ip" && "$l_ip" != "$ip" ]]; then
    warn "${LIVEKIT_HOST} points to ${l_ip}, expected ${ip}"
  fi
}

compose_up() {
  log "Building and starting Docker stack (this can take a long time)"
  cd "$ROOT_DIR"
  "${COMPOSE[@]}" pull || true
  "${COMPOSE[@]}" up -d --build
  "${COMPOSE[@]}" ps
}

issue_ssl() {
  if [[ "$SKIP_SSL" -eq 1 ]]; then
    warn "Skipping SSL (--skip-ssl). Site stays on HTTP."
    return
  fi

  log "Requesting Let's Encrypt certificates"
  local args=(-d "$DOMAIN" -d "www.${DOMAIN}" -d "$LIVEKIT_HOST" --non-interactive --agree-tos -m "$EMAIL" --redirect)
  if ! certbot --nginx "${args[@]}"; then
    warn "certbot failed — often because live.* DNS is missing. Retrying without ${LIVEKIT_HOST}"
    certbot --nginx -d "$DOMAIN" -d "www.${DOMAIN}" --non-interactive --agree-tos -m "$EMAIL" --redirect \
      || warn "SSL setup failed; continue on HTTP and re-run certbot later"
  fi
}

open_firewall() {
  if command -v ufw >/dev/null 2>&1; then
    log "Opening firewall ports (ufw)"
    ufw allow 80/tcp || true
    ufw allow 443/tcp || true
    ufw allow 7880/tcp || true
    ufw allow 7881/tcp || true
    ufw allow 7882/udp || true
  fi
}

print_summary() {
  load_env
  cat <<EOF

────────────────────────────────────────────────────────
  TutorPlatform deploy finished

  Site:     ${PUBLIC_URL}
  API:      ${PUBLIC_URL}/api
  Docs:     ${PUBLIC_URL}/api/docs
  LiveKit:  ${PUBLIC_LIVEKIT_URL}

  Env file: ${ENV_FILE}

  Useful:
    cd ${ROOT_DIR}
    ${COMPOSE[*]} ps
    ${COMPOSE[*]} logs -f backend frontend
    ${COMPOSE[*]} restart

  DNS checklist:
    ${DOMAIN}      A → this server
    www.${DOMAIN}  A/CNAME → ${DOMAIN}
    ${LIVEKIT_HOST} A → this server   ← needed for video

  Default seed logins (if DB is fresh):
    admin@tutor.local / Admin12345
    teacher@tutor.local / Teacher12345
    student@tutor.local / Student12345
────────────────────────────────────────────────────────
EOF
}

main() {
  log "Deploy TutorPlatform → ${DOMAIN}"
  echo "Root: ${ROOT_DIR}"
  confirm "Continue? This will replace easyphys.ru nginx vhost and use ports 3000/3010/7880-7882." \
    || die "Aborted"

  install_packages
  install_docker
  need_cmd docker
  need_cmd nginx
  open_firewall
  check_dns
  free_port_3000
  write_env
  write_livekit_configs
  backup_nginx
  compose_up
  install_nginx_site
  issue_ssl
  # Rebuild frontend if SSL changed PUBLIC_URL from http→https after first boot path
  if [[ "$SKIP_SSL" -eq 0 ]]; then
    log "Rebuilding frontend with HTTPS public URLs"
    write_env
    write_livekit_configs
    "${COMPOSE[@]}" up -d --build frontend backend
  fi
  print_summary
}

main
