import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

const getArg = (name) => { const i = process.argv.indexOf(`--${name}`); return i >= 0 ? process.argv[i + 1] : undefined; };
const email = getArg('email');
const name = getArg('name') || 'Aurum Admin';
const password = getArg('password');
const databaseUrl = process.env.DATABASE_URL || 'postgres://aurum_user:ChangeThisStrongPassword!@localhost:5432/aurum_db';

if (!email || !password) {
  console.error('Usage: npm run create-admin --workspace apps/admin-api -- --email admin@aurumschool.com --name "Aurum Admin" --password "ChangeMe123!"');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: databaseUrl });
const hash = await bcrypt.hash(password, 12);
const result = await pool.query(`INSERT INTO admin_users (full_name,email,password_hash,role,is_active) VALUES ($1,$2,$3,'admin',true) ON CONFLICT (email) DO UPDATE SET full_name=EXCLUDED.full_name,password_hash=EXCLUDED.password_hash,is_active=true,updated_at=now() RETURNING email`, [name, email, hash]);
console.log(`Admin user ready: ${result.rows[0].email}`);
await pool.end();
