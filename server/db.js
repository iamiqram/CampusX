import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';

const now = () => new Date().toISOString();
const isPostgres = Boolean(process.env.DATABASE_URL);

let sqliteDb;
let pool;

if (isPostgres) {
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'disable' ? false : { rejectUnauthorized: false }
  });
} else {
  const dataDir = path.resolve('data');
  fs.mkdirSync(dataDir, { recursive: true });
  sqliteDb = new DatabaseSync(path.join(dataDir, 'campusx.sqlite'));
  sqliteDb.exec('PRAGMA foreign_keys = ON');
  sqliteDb.exec('PRAGMA journal_mode = WAL');
}

function toPostgres(sql) {
  let index = 0;
  return sql.replace(/\?/g, () => `$${++index}`);
}

export const databaseName = isPostgres ? 'PostgreSQL' : 'SQLite';

export async function run(sql, params = []) {
  if (isPostgres) {
    return pool.query(toPostgres(sql), params);
  }
  return sqliteDb.prepare(sql).run(...params);
}

export async function all(sql, params = []) {
  if (isPostgres) {
    const result = await pool.query(toPostgres(sql), params);
    return result.rows;
  }
  return sqliteDb.prepare(sql).all(...params);
}

export async function get(sql, params = []) {
  if (isPostgres) {
    const result = await pool.query(toPostgres(sql), params);
    return result.rows[0] || null;
  }
  return sqliteDb.prepare(sql).get(...params) || null;
}

export async function insert(table, columns, values) {
  const placeholders = columns.map(() => '?').join(', ');
  if (isPostgres) {
    const result = await pool.query(
      `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${toPostgres(placeholders)}) RETURNING *`,
      values
    );
    return result.rows[0];
  }

  const result = sqliteDb.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`).run(...values);
  return getById(table, result.lastInsertRowid);
}

export async function getById(table, id) {
  return get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
}

export async function list(table) {
  return all(`SELECT * FROM ${table} ORDER BY created_at DESC, id DESC`);
}

export async function initDb() {
  if (isPostgres) {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS lost_items (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        contact TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        photo_url TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notes (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        note_type TEXT NOT NULL,
        description TEXT NOT NULL,
        exchange_for TEXT,
        contact TEXT NOT NULL,
        file_url TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS study_squads (
        id SERIAL PRIMARY KEY,
        subject TEXT NOT NULL,
        year TEXT NOT NULL,
        availability TEXT NOT NULL,
        style TEXT NOT NULL,
        goals TEXT NOT NULL,
        contact TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS marketplace_items (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        price INTEGER NOT NULL,
        item_condition TEXT NOT NULL,
        description TEXT NOT NULL,
        contact TEXT NOT NULL,
        photo_url TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        host TEXT NOT NULL,
        event_date TEXT NOT NULL,
        location TEXT NOT NULL,
        description TEXT NOT NULL,
        rsvp_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS gpa_predictions (
        id SERIAL PRIMARY KEY,
        subject TEXT NOT NULL,
        marks DOUBLE PRECISION NOT NULL,
        attendance DOUBLE PRECISION NOT NULL,
        assignments DOUBLE PRECISION NOT NULL,
        predicted_grade TEXT NOT NULL,
        predicted_points DOUBLE PRECISION NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  } else {
    sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS lost_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        location TEXT NOT NULL,
        contact TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'open',
        photo_url TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        subject TEXT NOT NULL,
        note_type TEXT NOT NULL,
        description TEXT NOT NULL,
        exchange_for TEXT,
        contact TEXT NOT NULL,
        file_url TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS study_squads (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL,
        year TEXT NOT NULL,
        availability TEXT NOT NULL,
        style TEXT NOT NULL,
        goals TEXT NOT NULL,
        contact TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS marketplace_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        price INTEGER NOT NULL,
        item_condition TEXT NOT NULL,
        description TEXT NOT NULL,
        contact TEXT NOT NULL,
        photo_url TEXT,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        host TEXT NOT NULL,
        event_date TEXT NOT NULL,
        location TEXT NOT NULL,
        description TEXT NOT NULL,
        rsvp_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS gpa_predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subject TEXT NOT NULL,
        marks REAL NOT NULL,
        attendance REAL NOT NULL,
        assignments REAL NOT NULL,
        predicted_grade TEXT NOT NULL,
        predicted_points REAL NOT NULL,
        created_at TEXT NOT NULL
      );
    `);
  }

  await seedIfEmpty();
}

async function seedIfEmpty() {
  const count = await get('SELECT COUNT(*) AS total FROM lost_items');
  if (Number(count.total) > 0) return;

  await insert('lost_items', ['title', 'description', 'location', 'contact', 'status', 'photo_url', 'created_at'], [
    'Black Casio calculator',
    'Found near the electronics lab after the morning practical.',
    'E-block, Lab 204',
    'arjun@campus.edu',
    'open',
    null,
    now()
  ]);
  await insert('lost_items', ['title', 'description', 'location', 'contact', 'status', 'photo_url', 'created_at'], [
    'Blue bottle',
    'Steel bottle with a small sticker on the lid.',
    'Main library, second floor',
    'meera@campus.edu',
    'open',
    null,
    now()
  ]);

  await insert('notes', ['title', 'subject', 'note_type', 'description', 'exchange_for', 'contact', 'file_url', 'created_at'], [
    'DBMS normalization notes',
    'Database Systems',
    'PDF',
    'Clean unit-wise notes with examples and solved questions.',
    'Operating Systems unit 3',
    'nisha@campus.edu',
    null,
    now()
  ]);
  await insert('notes', ['title', 'subject', 'note_type', 'description', 'exchange_for', 'contact', 'file_url', 'created_at'], [
    'Signals handwritten set',
    'Signals and Systems',
    'Handwritten',
    'Scanned notes from lectures 1 to 12.',
    'Free',
    'rahul@campus.edu',
    null,
    now()
  ]);

  await insert('study_squads', ['subject', 'year', 'availability', 'style', 'goals', 'contact', 'created_at'], [
    'Data Structures',
    '2nd year',
    'Weeknights after 7 PM',
    'Problem-solving sprints',
    'Crack lab viva and mid-sem prep',
    'isha@campus.edu',
    now()
  ]);
  await insert('study_squads', ['subject', 'year', 'availability', 'style', 'goals', 'contact', 'created_at'], [
    'Engineering Maths',
    '1st year',
    'Weekend mornings',
    'Concept revision',
    'Pass calculus quiz with confidence',
    'dev@campus.edu',
    now()
  ]);

  await insert('marketplace_items', ['title', 'category', 'price', 'item_condition', 'description', 'contact', 'photo_url', 'created_at'], [
    'Let Us C book',
    'Textbook',
    180,
    'Good',
    'No missing pages, light highlighting in first three chapters.',
    'kabir@campus.edu',
    null,
    now()
  ]);
  await insert('marketplace_items', ['title', 'category', 'price', 'item_condition', 'description', 'contact', 'photo_url', 'created_at'], [
    'Lab coat medium',
    'Lab gear',
    250,
    'Like new',
    'Used for one semester.',
    'sana@campus.edu',
    null,
    now()
  ]);

  await insert('events', ['title', 'host', 'event_date', 'location', 'description', 'rsvp_count', 'created_at'], [
    'CodeSprint 24h Hackathon',
    'Coding Club',
    '2026-06-18T09:00',
    'Innovation Hub',
    'Team up for a campus-wide build sprint with mentors and prizes.',
    42,
    now()
  ]);
  await insert('events', ['title', 'host', 'event_date', 'location', 'description', 'rsvp_count', 'created_at'], [
    'AI in Healthcare Seminar',
    'IEEE Student Branch',
    '2026-06-22T14:00',
    'Auditorium A',
    'Faculty and alumni talks on applied machine learning.',
    27,
    now()
  ]);
}

export { now };
