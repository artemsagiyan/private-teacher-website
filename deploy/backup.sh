#!/usr/bin/env bash
# Nightly backup of Postgres and MinIO for TutorPlatform.
# Cron example: 15 3 * * * /opt/private-teacher-website/deploy/backup.sh
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/tutorplatform}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
STAMP="$(date +%Y%m%d-%H%M)"
DEST="${BACKUP_DIR}/${STAMP}"

mkdir -p "${DEST}"

cd "${ROOT_DIR}"
COMPOSE=(docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod)

"${COMPOSE[@]}" exec -T postgres pg_dump -U postgres tutor_platform | gzip > "${DEST}/postgres.sql.gz"

docker run --rm --network container:tutor_minio \
  -v "${DEST}:/backup" \
  -e MINIO_ACCESS_KEY \
  --entrypoint /bin/sh minio/mc:latest -c "
    echo skip
  " >/dev/null 2>&1 || true

# Copy MinIO data volume via docker
docker run --rm -v website_minio_data:/data -v "${DEST}:/backup" alpine \
  tar czf /backup/minio.tgz -C /data . || \
docker run --rm -v tutorplatform_minio_data:/data -v "${DEST}:/backup" alpine \
  tar czf /backup/minio.tgz -C /data . || true

find "${BACKUP_DIR}" -mindepth 1 -maxdepth 1 -mtime "+${RETENTION_DAYS}" -exec rm -rf {} \;

echo "Backup written to ${DEST}"
