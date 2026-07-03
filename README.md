# Aurum Bilingual School Website Platform

Public school website + separate secured admin portal for **Aurum Bilingual School**.

This repo contains a working monorepo foundation:

- React/Vite public website
- React/Vite admin portal
- Express public API
- Express admin API
- PostgreSQL schema, migration, and seed data
- Media upload support using backend persistent storage
- Docker development setup
- Production Docker/Traefik scaffolding
- GitHub Actions CI
- Database runbook for `aurum_user` and `aurum_db`

## Repository structure

```text
apps/
  public-web/       Public website
  admin-web/        Secured admin portal
  public-api/       Published-content API
  admin-api/        Admin auth, CRUD, media API

database/
  migrations/
  seeds/
  schema/

docs/
  RUNBOOK_DATABASE.md
  DEPLOYMENT_RUNBOOK.md

infrastructure/
  docker/
```

## Quick start

```bash
npm install
cp apps/public-api/.env.example apps/public-api/.env
cp apps/admin-api/.env.example apps/admin-api/.env
cp apps/public-web/.env.example apps/public-web/.env
cp apps/admin-web/.env.example apps/admin-web/.env
```

Create PostgreSQL database/user using `docs/RUNBOOK_DATABASE.md`, then apply schema:

```bash
psql -h localhost -U aurum_user -d aurum_db -f database/migrations/001_initial_schema.sql
psql -h localhost -U aurum_user -d aurum_db -f database/seeds/001_seed_content.sql
```

Create first admin:

```bash
npm run create-admin --workspace apps/admin-api -- \
  --email admin@aurumschool.com \
  --name "Aurum Admin" \
  --password "ChangeMe123!"
```

Run all apps:

```bash
npm run dev
```

Default local URLs:

| App | URL |
|---|---|
| Public web | http://localhost:5173 |
| Admin web | http://localhost:5174 |
| Public API | http://localhost:4000 |
| Admin API | http://localhost:4001 |

## Docker development

```bash
docker compose -f docker-compose.dev.yml up --build
```

## Public API

```text
GET /health
GET /api/home
GET /api/events
GET /api/events/:slug
GET /api/announcements
GET /api/announcements/:slug
GET /api/workshops
GET /api/student-activities
GET /api/student-activities/:slug
```

## Admin API

```text
POST   /api/auth/login
POST   /api/auth/logout
GET    /api/auth/me
GET    /api/events
POST   /api/events
PUT    /api/events/:id
DELETE /api/events/:id
GET    /api/announcements
POST   /api/announcements
PUT    /api/announcements/:id
DELETE /api/announcements/:id
GET    /api/workshops
POST   /api/workshops
PUT    /api/workshops/:id
DELETE /api/workshops/:id
GET    /api/student-activities
POST   /api/student-activities
PUT    /api/student-activities/:id
DELETE /api/student-activities/:id
GET    /api/media
POST   /api/media/upload
DELETE /api/media/:id
```

## Domains for production

| Domain | Service |
|---|---|
| `aurumschool.com` and `www.aurumschool.com` | Public website |
| `api.aurumschool.com` | Public API |
| `admin.aurumschool.com` | Admin portal |
| `admin-api.aurumschool.com` | Admin API |

## Security baseline

- Admin site is separate from public site.
- Admin API uses HTTP-only session cookies.
- Passwords are hashed with bcryptjs.
- Express Helmet is enabled.
- Admin login has rate limiting.
- Write requests are validated with Zod.
- Uploads are restricted to JPG, PNG, and WEBP.
- Database includes audit-log table for future governance.
