import bcrypt from 'bcryptjs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import morgan from 'morgan';
import multer from 'multer';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';
import { z } from 'zod';

dotenv.config();
const env = {
  port: Number(process.env.PORT || 4001),
  databaseUrl: process.env.DATABASE_URL || 'postgres://aurum_user:ChangeThisStrongPassword!@localhost:5432/aurum_db',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5174').split(',').map((x) => x.trim()),
  jwtSecret: process.env.JWT_SECRET || 'dev-only-change-this-secret',
  cookieSecure: String(process.env.COOKIE_SECURE || 'false') === 'true',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  publicUploadBaseUrl: process.env.PUBLIC_UPLOAD_BASE_URL || 'http://localhost:4000/uploads',
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 5)
};
const pool = new pg.Pool({ connectionString: env.databaseUrl });
const app = express();
fs.mkdirSync(path.resolve(env.uploadDir), { recursive: true });

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan('dev'));
app.use(cors({ credentials: true, origin: (origin, cb) => (!origin || env.corsOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS blocked')))}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use('/uploads', express.static(path.resolve(env.uploadDir)));
app.get('/health', (_req,res) => res.json({ status: 'ok', service: 'aurum-admin-api' }));

const cookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: env.cookieSecure, maxAge: 1000 * 60 * 60 * 8 });
const slugify = (s) => String(s || '').toLowerCase().trim().replace(/['"]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');
const userView = (u) => ({ id: u.id, fullName: u.full_name, email: u.email, role: u.role });

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.aurum_admin_session;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const payload = jwt.verify(token, env.jwtSecret);
    const result = await pool.query('SELECT id,full_name,email,role,is_active FROM admin_users WHERE id=$1', [payload.sub]);
    const user = result.rows[0];
    if (!user || !user.is_active) return res.status(401).json({ message: 'Invalid session' });
    req.user = user;
    return next();
  } catch { return res.status(401).json({ message: 'Invalid or expired session' }); }
}

app.post('/api/auth/login', rateLimit({ windowMs: 15*60*1000, max: 20, standardHeaders: true, legacyHeaders: false }), async (req,res,next) => {
  try {
    const data = z.object({ email: z.string().email(), password: z.string().min(8) }).parse(req.body);
    const result = await pool.query('SELECT id,full_name,email,password_hash,role,is_active FROM admin_users WHERE lower(email)=lower($1)', [data.email]);
    const user = result.rows[0];
    if (!user || !user.is_active || !(await bcrypt.compare(data.password, user.password_hash))) return res.status(401).json({ message: 'Invalid email or password' });
    await pool.query('UPDATE admin_users SET last_login_at=now() WHERE id=$1', [user.id]);
    const token = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, { expiresIn: '8h' });
    res.cookie('aurum_admin_session', token, cookieOptions());
    res.json({ user: userView(user) });
  } catch(e) { next(e); }
});
app.post('/api/auth/logout', (_req,res) => { res.clearCookie('aurum_admin_session', cookieOptions()); res.json({ message: 'Logged out' }); });
app.get('/api/auth/me', requireAuth, (req,res) => res.json({ user: userView(req.user) }));

const contentSchema = z.object({ title: z.string().min(3), slug: z.string().optional(), summary: z.string().optional().nullable(), body: z.string().optional(), description: z.string().optional(), status: z.enum(['draft','published','archived']).default('draft'), eventDate: z.string().optional().nullable(), activityDate: z.string().optional().nullable(), location: z.string().optional().nullable(), displayOrder: z.coerce.number().int().optional(), coverImageId: z.string().uuid().optional().nullable(), expiresAt: z.string().optional().nullable(), imageIds: z.array(z.string().uuid()).optional().default([]), videos: z.array(z.object({ title: z.string().optional().nullable(), videoUrl: z.string().url(), provider: z.string().optional().default('external') })).optional().default([]) });
const configs = {
  events: { table: 'events', fields: ['title','slug','summary','body','event_date','location','cover_image_id','status','published_at','created_by','updated_by'], build: (d,u) => [d.title,slugify(d.slug||d.title),d.summary||null,d.body,d.eventDate||null,d.location||null,d.coverImageId||null,d.status,d.status==='published'?new Date():null,u,u] },
  announcements: { table: 'announcements', fields: ['title','slug','summary','body','cover_image_id','status','published_at','expires_at','created_by','updated_by'], build: (d,u) => [d.title,slugify(d.slug||d.title),d.summary||null,d.body,d.coverImageId||null,d.status,d.status==='published'?new Date():null,d.expiresAt||null,u,u] },
  workshops: { table: 'workshops', fields: ['title','slug','summary','description','cover_image_id','display_order','status','created_by','updated_by'], build: (d,u) => [d.title,slugify(d.slug||d.title),d.summary||null,d.description||d.body,d.coverImageId||null,d.displayOrder||0,d.status||'published',u,u] },
  'student-activities': { table: 'student_activities', fields: ['title','slug','summary','body','activity_date','cover_image_id','status','published_at','created_by','updated_by'], build: (d,u) => [d.title,slugify(d.slug||d.title),d.summary||null,d.body,d.activityDate||null,d.coverImageId||null,d.status,d.status==='published'?new Date():null,u,u] }
};

for (const [route, cfg] of Object.entries(configs)) {
  app.get(`/api/${route}`, requireAuth, async (_req,res,next) => { try { const r = await pool.query(`SELECT * FROM ${cfg.table} ORDER BY created_at DESC`); res.json(r.rows); } catch(e){ next(e); } });
  app.post(`/api/${route}`, requireAuth, async (req,res,next) => { try { const d = contentSchema.parse(req.body); const vals = cfg.build(d, req.user.id); const params = vals.map((_,i)=>`$${i+1}`).join(','); const r = await pool.query(`INSERT INTO ${cfg.table} (${cfg.fields.join(',')}) VALUES (${params}) RETURNING *`, vals); if (route === 'student-activities') await replaceActivityChildren(r.rows[0].id, d); res.status(201).json(r.rows[0]); } catch(e){ next(e); } });
  app.put(`/api/${route}/:id`, requireAuth, async (req,res,next) => { try { const d = contentSchema.parse(req.body); const vals = cfg.build(d, req.user.id); const sets = cfg.fields.map((f,i)=>`${f}=$${i+1}`).join(','); const r = await pool.query(`UPDATE ${cfg.table} SET ${sets} WHERE id=$${vals.length+1} RETURNING *`, [...vals, req.params.id]); if (!r.rows[0]) return res.status(404).json({ message: 'Not found' }); if (route === 'student-activities') await replaceActivityChildren(req.params.id, d); res.json(r.rows[0]); } catch(e){ next(e); } });
  app.delete(`/api/${route}/:id`, requireAuth, async (req,res,next) => { try { const r = await pool.query(`DELETE FROM ${cfg.table} WHERE id=$1 RETURNING id`, [req.params.id]); res.status(r.rowCount ? 204 : 404).end(); } catch(e){ next(e); } });
}

async function replaceActivityChildren(activityId, d) {
  await pool.query('DELETE FROM student_activity_images WHERE activity_id=$1', [activityId]);
  await pool.query('DELETE FROM student_activity_videos WHERE activity_id=$1', [activityId]);
  for (const [i,id] of (d.imageIds || []).entries()) await pool.query('INSERT INTO student_activity_images (activity_id,image_id,display_order) VALUES ($1,$2,$3)', [activityId,id,i+1]);
  for (const [i,v] of (d.videos || []).entries()) await pool.query('INSERT INTO student_activity_videos (activity_id,title,video_url,provider,display_order) VALUES ($1,$2,$3,$4,$5)', [activityId,v.title||null,v.videoUrl,v.provider||'external',i+1]);
}

const upload = multer({ storage: multer.diskStorage({ destination: (_req,_file,cb)=>cb(null,path.resolve(env.uploadDir)), filename: (_req,file,cb)=>cb(null,`${Date.now()}-${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`) }), limits: { fileSize: env.maxUploadMb * 1024 * 1024 }, fileFilter: (_req,file,cb) => ['image/jpeg','image/png','image/webp'].includes(file.mimetype) ? cb(null,true) : cb(new Error('Only JPG, PNG, and WEBP images are allowed')) });
app.get('/api/media', requireAuth, async (_req,res,next) => { try { const r = await pool.query('SELECT * FROM app_images ORDER BY created_at DESC'); res.json(r.rows); } catch(e){ next(e); } });
app.post('/api/media/upload', requireAuth, upload.single('file'), async (req,res,next) => { try { if (!req.file) return res.status(400).json({ message: 'Image file is required' }); const publicUrl = `${env.publicUploadBaseUrl}/${req.file.filename}`; const r = await pool.query('INSERT INTO app_images (original_name,file_name,file_path,public_url,mime_type,size_bytes,category,alt_text,uploaded_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *', [req.file.originalname,req.file.filename,req.file.path,publicUrl,req.file.mimetype,req.file.size,req.body.category||'general',req.body.altText||null,req.user.id]); res.status(201).json(r.rows[0]); } catch(e){ next(e); } });
app.delete('/api/media/:id', requireAuth, async (req,res,next) => { try { const r = await pool.query('DELETE FROM app_images WHERE id=$1 RETURNING file_path', [req.params.id]); if (!r.rows[0]) return res.status(404).json({ message: 'Media item not found' }); await fsp.unlink(r.rows[0].file_path).catch(()=>undefined); res.status(204).end(); } catch(e){ next(e); } });

app.use((req,res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }));
app.use((err,_req,res,_next) => { console.error(err); if (err.name === 'ZodError') return res.status(400).json({ message: 'Validation failed', issues: err.issues }); if (err.code === '23505') return res.status(409).json({ message: 'Duplicate unique value' }); res.status(err.status || 500).json({ message: err.status ? err.message : 'Internal server error' }); });
const server = app.listen(env.port, () => console.log(`Aurum admin API listening on ${env.port}`));
process.on('SIGTERM', () => server.close(() => pool.end()));
