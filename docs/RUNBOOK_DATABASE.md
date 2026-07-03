# Database Runbook: Create `aurum_user` and `aurum_db`

## 1. Install PostgreSQL on Ubuntu/Debian

```bash
sudo apt update
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable postgresql
sudo systemctl start postgresql
```

## 2. Create user and database

```bash
sudo -u postgres psql
```

Inside `psql`:

```sql
CREATE USER aurum_user WITH PASSWORD 'ChangeThisStrongPassword!';
CREATE DATABASE aurum_db OWNER aurum_user;
GRANT ALL PRIVILEGES ON DATABASE aurum_db TO aurum_user;
\c aurum_db
GRANT ALL ON SCHEMA public TO aurum_user;
ALTER SCHEMA public OWNER TO aurum_user;
\q
```

## 3. Test login

```bash
psql -h localhost -U aurum_user -d aurum_db
```

## 4. Apply migration and seed data

From repo root:

```bash
psql -h localhost -U aurum_user -d aurum_db -f database/migrations/001_initial_schema.sql
psql -h localhost -U aurum_user -d aurum_db -f database/seeds/001_seed_content.sql
```

## 5. Create first admin user

```bash
npm install
npm run create-admin --workspace apps/admin-api -- \
  --email admin@aurumschool.com \
  --name "Aurum Admin" \
  --password "ChangeMe123!"
```

## Docker alternative

```bash
docker run --name aurum-postgres \
  -e POSTGRES_USER=aurum_user \
  -e POSTGRES_PASSWORD=ChangeThisStrongPassword! \
  -e POSTGRES_DB=aurum_db \
  -p 5432:5432 \
  -v aurum-postgres-data:/var/lib/postgresql/data \
  -d postgres:16-alpine
```

## Backup

```bash
pg_dump -h localhost -U aurum_user -d aurum_db > aurum_db_$(date +%F).sql
```

## Restore

```bash
psql -h localhost -U aurum_user -d aurum_db < aurum_db_YYYY-MM-DD.sql
```

## Production hardening

- Use a strong password.
- Do not expose PostgreSQL directly to the public internet.
- Restrict PostgreSQL access to the application VPS or private network.
- Back up the database and upload directory regularly.
