import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import multer from 'multer';
import fs from 'node:fs';
import path from 'node:path';
import { databaseName, getById, initDb, insert, list, now, run } from './db.js';

const app = express();
const port = process.env.PORT || 4000;
const uploadDir = path.resolve('uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 8 * 1024 * 1024 } });

await initDb();

app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use('/uploads', express.static(uploadDir));

const publicUrl = (_req, file) => (file ? `/uploads/${file.filename}` : null);
const required = (body, fields) => fields.filter((field) => !String(body[field] ?? '').trim());
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'CampusX API', database: databaseName });
});

app.get('/api/dashboard', asyncRoute(async (_req, res) => {
  res.json({
    lostItems: await list('lost_items'),
    notes: await list('notes'),
    studySquads: await list('study_squads'),
    marketplaceItems: await list('marketplace_items'),
    events: await list('events'),
    gpaPredictions: await list('gpa_predictions')
  });
}));

app.get('/api/lost-items', asyncRoute(async (_req, res) => res.json(await list('lost_items'))));
app.post('/api/lost-items', upload.single('photo'), asyncRoute(async (req, res) => {
  const missing = required(req.body, ['title', 'description', 'location', 'contact']);
  if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });
  const row = await insert('lost_items', ['title', 'description', 'location', 'contact', 'status', 'photo_url', 'created_at'], [
    req.body.title,
    req.body.description,
    req.body.location,
    req.body.contact,
    'open',
    publicUrl(req, req.file),
    now()
  ]);
  res.status(201).json(row);
}));
app.patch('/api/lost-items/:id/claim', asyncRoute(async (req, res) => {
  await run("UPDATE lost_items SET status = 'claimed' WHERE id = ?", [req.params.id]);
  res.json(await getById('lost_items', req.params.id));
}));

app.get('/api/notes', asyncRoute(async (_req, res) => res.json(await list('notes'))));
app.post('/api/notes', upload.single('file'), asyncRoute(async (req, res) => {
  const missing = required(req.body, ['title', 'subject', 'note_type', 'description', 'contact']);
  if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });
  const row = await insert('notes', ['title', 'subject', 'note_type', 'description', 'exchange_for', 'contact', 'file_url', 'created_at'], [
    req.body.title,
    req.body.subject,
    req.body.note_type,
    req.body.description,
    req.body.exchange_for || 'Open to exchange',
    req.body.contact,
    publicUrl(req, req.file),
    now()
  ]);
  res.status(201).json(row);
}));

app.get('/api/study-squads', asyncRoute(async (_req, res) => res.json(await list('study_squads'))));
app.post('/api/study-squads', asyncRoute(async (req, res) => {
  const missing = required(req.body, ['subject', 'year', 'availability', 'style', 'goals', 'contact']);
  if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });
  const row = await insert('study_squads', ['subject', 'year', 'availability', 'style', 'goals', 'contact', 'created_at'], [
    req.body.subject,
    req.body.year,
    req.body.availability,
    req.body.style,
    req.body.goals,
    req.body.contact,
    now()
  ]);
  res.status(201).json(row);
}));

app.get('/api/marketplace', asyncRoute(async (_req, res) => res.json(await list('marketplace_items'))));
app.post('/api/marketplace', upload.single('photo'), asyncRoute(async (req, res) => {
  const missing = required(req.body, ['title', 'category', 'price', 'item_condition', 'description', 'contact']);
  if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });
  const row = await insert('marketplace_items', ['title', 'category', 'price', 'item_condition', 'description', 'contact', 'photo_url', 'created_at'], [
    req.body.title,
    req.body.category,
    Number(req.body.price),
    req.body.item_condition,
    req.body.description,
    req.body.contact,
    publicUrl(req, req.file),
    now()
  ]);
  res.status(201).json(row);
}));

app.get('/api/events', asyncRoute(async (_req, res) => res.json(await list('events'))));
app.post('/api/events', asyncRoute(async (req, res) => {
  const missing = required(req.body, ['title', 'host', 'event_date', 'location', 'description']);
  if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });
  const row = await insert('events', ['title', 'host', 'event_date', 'location', 'description', 'rsvp_count', 'created_at'], [
    req.body.title,
    req.body.host,
    req.body.event_date,
    req.body.location,
    req.body.description,
    0,
    now()
  ]);
  res.status(201).json(row);
}));
app.post('/api/events/:id/rsvp', asyncRoute(async (req, res) => {
  await run('UPDATE events SET rsvp_count = rsvp_count + 1 WHERE id = ?', [req.params.id]);
  res.json(await getById('events', req.params.id));
}));

function predictGrade({ marks, attendance, assignments }) {
  const score = Number(marks) * 0.65 + Number(attendance) * 0.15 + Number(assignments) * 0.2;
  if (score >= 90) return ['O', 10];
  if (score >= 80) return ['A+', 9];
  if (score >= 70) return ['A', 8];
  if (score >= 60) return ['B+', 7];
  if (score >= 50) return ['B', 6];
  if (score >= 40) return ['C', 5];
  return ['At risk', 0];
}

app.get('/api/gpa-predictions', asyncRoute(async (_req, res) => res.json(await list('gpa_predictions'))));
app.post('/api/gpa-predictions', asyncRoute(async (req, res) => {
  const missing = required(req.body, ['subject', 'marks', 'attendance', 'assignments']);
  if (missing.length) return res.status(400).json({ error: `Missing: ${missing.join(', ')}` });
  const [grade, points] = predictGrade(req.body);
  const row = await insert('gpa_predictions', ['subject', 'marks', 'attendance', 'assignments', 'predicted_grade', 'predicted_points', 'created_at'], [
    req.body.subject,
    Number(req.body.marks),
    Number(req.body.attendance),
    Number(req.body.assignments),
    grade,
    points,
    now()
  ]);
  res.status(201).json(row);
}));

const distDir = path.resolve('dist');
if (fs.existsSync(distDir)) {
  app.use(express.static(distDir));
  app.get(/^(?!\/api|\/uploads).*/, (_req, res) => res.sendFile(path.join(distDir, 'index.html')));
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong' });
});

app.listen(port, () => {
  console.log(`CampusX running on http://localhost:${port} with ${databaseName}`);
});
