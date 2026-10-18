# TutorPlatform production deploy

Automated install for a shared VPS (nginx + existing sites on :3001/:3002).

## One command

```bash
git clone git@github.com:artemsagiyan/private-teacher-website.git
cd private-teacher-website
sudo bash deploy/deploy.sh --yes
```

## What it does

1. Installs Docker Engine + Compose plugin (if missing)
2. Installs/reloads nginx + certbot
3. Frees host port `:3000` (old easyphys app) after confirmation
4. Writes `deploy/.env.prod` with strong secrets
5. Starts `docker compose` with `deploy/docker-compose.prod.yml`
6. Configures nginx:
   - `easyphys.ru` → frontend `:3000`, `/api` → backend `:3010`
   - `live.easyphys.ru` → LiveKit `:7880`
7. Keeps neighbour vhosts (`ekaterina-math.ru`, `nadejda-repetitor.ru`)
8. Requests Let's Encrypt certificates

## DNS required

| Host | Type | Value |
|------|------|-------|
| `easyphys.ru` | A | server IP |
| `www.easyphys.ru` | A/CNAME | server / apex |
| `live.easyphys.ru` | A | server IP |

Without `live.*`, the site and API still work; video lessons will not.

TURN: production LiveKit advertises `live.easyphys.ru:3478/udp`. Open UDP **3478**
on the firewall (in addition to 7880–7882) so students behind symmetric NAT can
connect.

## Options

```bash
DOMAIN=easyphys.ru EMAIL=you@mail.ru sudo -E bash deploy/deploy.sh --yes
sudo bash deploy/deploy.sh --skip-ssl --yes
```

## After deploy

```bash
cd /path/to/private-teacher-website
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod ps
docker compose -f docker-compose.yml -f deploy/docker-compose.prod.yml --env-file deploy/.env.prod logs -f
```

## Bootstrap admin

Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `deploy/.env.prod`. Demo seed accounts are **not** created in production unless `ENABLE_SEED=true`.

## Backups

Nightly script: `deploy/backup.sh` (Postgres dump + MinIO volume tarball, 14-day retention).

```bash
sudo mkdir -p /var/backups/tutorplatform
sudo chmod +x deploy/backup.sh
# cron: 15 3 * * * /path/to/private-teacher-website/deploy/backup.sh
```

Restore Postgres:

```bash
gunzip -c /var/backups/tutorplatform/STAMP/postgres.sql.gz | \
  docker exec -i tutor_postgres psql -U postgres tutor_platform
```

## AI models (prod vs local)

Local compose uses `qwen3:8b` and Whisper `large-v3-turbo`. The default production setup sends recordings to the local GPU worker. VPS-side AI services are off by default; enable them with the `server-ai` Compose profile if you intentionally want server-side processing.

### Local GPU worker

Production uses `COMPUTE_MODE=remote`: the VPS stores recordings and places them in a queue, while the local computer runs Whisper and Ollama and sends the finished report back. Copy `services/compute-bot/.env.example` to `services/compute-bot/.env`, set `SITE_URL` to the public site, and copy the same `COMPUTE_SECRET` from the server's `deploy/.env.prod`. Start the CUDA stack from the repository root with `docker compose -f services/compute-bot/docker-compose.gpu.yml up -d --build`.

The CUDA stack keeps model caches on the local computer. It requires Docker GPU support for NVIDIA; the server keeps only the queue and does not perform the heavy transcription or report generation. If Docker GPU support is unavailable, run the bot directly with `node services/compute-bot/bot.mjs` while Ollama and the CUDA transcriber are already listening on `127.0.0.1`.

Downloaded lesson audio is retained on the local computer at `D:\job\website-data\audio` (mounted in the worker at `/data/audio`) after processing, so it can be transcribed without downloading again on retries. The archive is not automatically pruned; monitor free disk space and remove recordings manually when they are no longer needed.
