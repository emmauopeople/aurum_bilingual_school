import compression from 'compression';
import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import pg from 'pg';

dotenv.config();

const env = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || 'postgres://aurum_user:ChangeThisStrongPassword!@localhost:5432/aurum_db',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',').map((x) => x.trim()),
  uploadDir: process.env.UPLOAD_DIR || 'uploads'
};

const pool = new pg.Pool({ connectionString: env.databaseUrl });
const app = express();

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(morgan('dev'));
app.use(cors({ origin: (origin, cb) => (!origin || env.corsOrigins.includes(origin) ? cb(null, true) : cb(new Error('CORS blocked')))}));
app.use(express.json());
app.use('/uploads', express.static(path.resolve(env.uploadDir)));

app.get('/health', (_req, res) => res.json({ status: 'ok', service: 'aurum-public-api' }));

const imageJson = `json_build_object('id', img.id, 'publicUrl', img.public_url, 'altText', img.alt_text, 'category', img.category) AS cover_image`;
const cleanRows = (rows) => rows.map((r) => ({ ...r, cover_image: r.cover_image?.id ? r.cover_image : null }));

async function list(table, fields = '*', order = 'created_at DESC', limit = 20) {
  const result = await pool.query(`SELECT ${fields}, ${imageJson} FROM ${table} t LEFT JOIN app_images img ON img.id = t.cover_image_id WHERE t.status = 'published' ORDER BY ${order} LIMIT $1`, [limit]);
  return cleanRows(result.rows);
}

app.get('/api/home', async (_req, res, next) => {
  try {
    const [events, announcements, workshops, activities] = await Promise.all([
      list('events', 't.id,t.title,t.slug,t.summary,t.body,t.event_date,t.location,t.published_at', 'COALESCE(t.event_date,t.published_at::date) DESC', 3),
      list('announcements', 't.id,t.title,t.slug,t.summary,t.body,t.published_at,t.expires_at', 't.published_at DESC NULLS LAST', 3),
      list('workshops', 't.id,t.title,t.slug,t.summary,t.description,t.display_order', 't.display_order ASC', 10),
      list('student_activities', 't.id,t.title,t.slug,t.summary,t.body,t.activity_date,t.published_at', 'COALESCE(t.activity_date,t.published_at::date) DESC', 3)
    ]);
    res.json({ events, announcements, workshops, activities });
  } catch (e) { next(e); }
});

app.get('/api/events', async (req, res, next) => { try { res.json(await list('events','t.id,t.title,t.slug,t.summary,t.body,t.event_date,t.location,t.published_at','COALESCE(t.event_date,t.published_at::date) DESC', Number(req.query.limit || 20))); } catch(e){ next(e); } });
app.get('/api/announcements', async (req, res, next) => { try { res.json(await list('announcements','t.id,t.title,t.slug,t.summary,t.body,t.published_at,t.expires_at','t.published_at DESC NULLS LAST', Number(req.query.limit || 20))); } catch(e){ next(e); } });
app.get('/api/workshops', async (_req, res, next) => { try { res.json(await list('workshops','t.id,t.title,t.slug,t.summary,t.description,t.display_order','t.display_order ASC', 50)); } catch(e){ next(e); } });
app.get('/api/student-activities', async (req, res, next) => { try { res.json(await list('student_activities','t.id,t.title,t.slug,t.summary,t.body,t.activity_date,t.published_at','COALESCE(t.activity_date,t.published_at::date) DESC', Number(req.query.limit || 20))); } catch(e){ next(e); } });

async function detail(req, res, next, table, fields) {
  try {
    const result = await pool.query(`SELECT ${fields}, ${imageJson} FROM ${table} t LEFT JOIN app_images img ON img.id = t.cover_image_id WHERE t.status = 'published' AND t.slug = $1 LIMIT 1`, [req.params.slug]);
    const row = cleanRows(result.rows)[0];
    if (!row) return res.status(404).json({ message: 'Not found' });
    if (table === 'student_activities') {
      const [images, videos] = await Promise.all([
        pool.query('SELECT i.id,i.public_url,i.alt_text,sai.caption,sai.display_order FROM student_activity_images sai JOIN app_images i ON i.id=sai.image_id WHERE sai.activity_id=$1 ORDER BY sai.display_order', [row.id]),
        pool.query('SELECT id,title,video_url,provider,display_order FROM student_activity_videos WHERE activity_id=$1 ORDER BY display_order', [row.id])
      ]);
      row.images = images.rows;
      row.videos = videos.rows;
    }
    return res.json(row);
  } catch (e) { next(e); }
}

app.get('/api/events/:slug', (req,res,next) => detail(req,res,next,'events','t.id,t.title,t.slug,t.summary,t.body,t.event_date,t.location,t.published_at'));
app.get('/api/announcements/:slug', (req,res,next) => detail(req,res,next,'announcements','t.id,t.title,t.slug,t.summary,t.body,t.published_at,t.expires_at'));
app.get('/api/student-activities/:slug', (req,res,next) => detail(req,res,next,'student_activities','t.id,t.title,t.slug,t.summary,t.body,t.activity_date,t.published_at'));

app.use((req, res) => res.status(404).json({ message: `Route not found: ${req.method} ${req.originalUrl}` }));
app.use((err, _req, res, _next) => { console.error(err); res.status(err.status || 500).json({ message: err.status ? err.message : 'Internal server error' }); });

const server = app.listen(env.port, () => console.log(`Aurum public API listening on ${env.port}`));
process.on('SIGTERM', () => server.close(() => pool.end()));
