# Augmented Menu

QR-accessible web menu with AR item viewing at accurate real-world scale.

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Database (Postgres, e.g. Supabase)**
   - Copy `.env.example` to `.env` and set `DATABASE_URL` to your Postgres connection string.
   - For Supabase, use the connection string from Project Settings → Database (add `?sslmode=require` if needed).
   - Apply migrations and seed demo data (run from your machine so the DB is reachable):
     ```bash
     npx prisma migrate deploy
     npx prisma db seed
     ```
   - Health check: http://localhost:3000/api/health
   - **Admin (v1):** Set `ADMIN_PASSWORD` in `.env`. Admin and `/api/admin/*` are protected by a single-password gate (no user table).

3. **Redis (for 3D job queue, Phase 3)**
   - Set `REDIS_URL` in `.env` (e.g. `redis://localhost:6379`).
   - Run the worker in a separate terminal so “Generate 3D” jobs are processed:
     ```bash
     npm run worker
     ```

4. **Run development server**
   ```bash
   npm run dev
   ```
   - App: http://localhost:3000
   - Health (DB check): http://localhost:3000/api/health

## Tech stack (v1)

- Next.js (App Router), TypeScript, Tailwind CSS
- Prisma + PostgreSQL
- BullMQ + Redis (model-generation job queue)
- Public routes: `/r/[slug]` (restaurant menu)
- Admin routes: `/admin`
