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
