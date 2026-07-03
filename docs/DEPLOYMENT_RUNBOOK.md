# Deployment Runbook

## Domain routing

| Domain | Service |
|---|---|
| `aurumschool.com` and `www.aurumschool.com` | Public website |
| `api.aurumschool.com` | Public API |
| `admin.aurumschool.com` | Admin portal |
| `admin-api.aurumschool.com` | Admin API |

## Build locally

```bash
npm install
npm run build
```

## Docker local environment

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Production notes

1. Keep PostgreSQL on a separate VPS or managed DB.
2. Create `aurum_user` and `aurum_db` with `docs/RUNBOOK_DATABASE.md`.
3. Store secrets in `.env` on the server, not in Git.
4. Use the Traefik labels in `infrastructure/docker/docker-compose.prod.yml` as the production model.
5. Mount uploads as a persistent volume.
6. Back up PostgreSQL and uploads every day.

## Health checks

```bash
curl https://api.aurumschool.com/health
curl https://admin-api.aurumschool.com/health
```
