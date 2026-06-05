# CampusX

CampusX is a full-stack college social app with a real Express backend and a SQLite database. It includes:

- Lost & Found board with photo uploads and claim status
- Notes marketplace with PDF/image upload support
- Study squad finder by subject, batch, availability, and study style
- Campus marketplace for textbooks, calculators, lab coats, and other gear
- Event feed with one-tap RSVP
- GPA predictor that stores saved predictions

## Run locally

```bash
npm install
npm run build
npm start
```

Open `http://127.0.0.1:4000`.

For development with hot reload:

```bash
npm run dev
```

The API runs on `http://127.0.0.1:4000` and Vite runs on `http://127.0.0.1:5173`.

## Host publicly

The app supports two database modes:

- Local development: SQLite, saved in `data/campusx.sqlite`
- Production hosting: PostgreSQL, enabled by setting `DATABASE_URL`

Recommended simple hosting shape:

1. Push this project to GitHub.
2. Create a PostgreSQL database on your host, Neon, Supabase, Railway, Render, or another managed Postgres provider.
3. Create a Node/Express web service from the GitHub repo.
4. Set the build command:

```bash
npm install && npm run build
```

5. Set the start command:

```bash
npm start
```

6. Add this environment variable in the host dashboard:

```bash
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE?sslmode=require
```

When `DATABASE_URL` exists, CampusX automatically creates the PostgreSQL tables and stores posts, marketplace listings, events, RSVPs, and GPA predictions in that cloud database.

### Uploaded photos and PDFs

Database records are stored in PostgreSQL, but uploaded files are stored in the app's `uploads/` folder. On many hosts, the filesystem is temporary unless you attach persistent storage.

For a first public version, attach a persistent disk and mount it at `uploads/`. For a stronger production version, move uploads to Cloudinary, S3, or another object storage provider.

## Data and uploads

- SQLite database: `data/campusx.sqlite`
- Uploaded files/photos: `uploads/`

Both folders are ignored by Git so local campus data is not accidentally committed.

## API overview

- `GET /api/dashboard`
- `POST /api/lost-items`
- `PATCH /api/lost-items/:id/claim`
- `POST /api/notes`
- `POST /api/study-squads`
- `POST /api/marketplace`
- `POST /api/events`
- `POST /api/events/:id/rsvp`
- `POST /api/gpa-predictions`
