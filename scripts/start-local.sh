#!/usr/bin/env bash
set -u

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
status_file="$repo_root/logs/local-autostart.status"
compose_log="$repo_root/logs/local-autostart.compose.log"
mkdir -p "$repo_root/logs"

for attempt in $(seq 1 90); do
  if docker info --format '{{.ServerVersion}}' >/dev/null 2>&1; then
    if (cd "$repo_root" && docker compose up -d >"$compose_log" 2>&1); then
      printf 'success' >"$status_file"
    else
      printf 'failure' >"$status_file"
    fi
    exit 0
  fi
  sleep 4
done

printf 'failure' >"$status_file"
