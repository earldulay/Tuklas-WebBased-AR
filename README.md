# Tuklas AR Science Lab

Full-stack browser-delivered WebAR PWA for Grade 9 Predict-Observe-Explain science activities.

## Tech Stack

- Frontend: React, TypeScript, Vite, Three.js, AR.js
- Offline storage: IndexedDB with localStorage fallback metadata
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL through Prisma ORM

## Project Structure

```text
.
├── backend
│   ├── prisma
│   │   └── schema.prisma
│   └── src
│       ├── data
│       ├── lib
│       ├── routes
│       ├── app.ts
│       └── server.ts
├── frontend
│   ├── public
│   │   ├── assets
│   │   ├── manifest.webmanifest
│   │   └── service-worker.js
│   └── src
│       ├── components
│       ├── data
│       ├── lib
│       ├── types
│       ├── App.tsx
│       └── main.tsx
├── .env.example
└── package.json
```

## Getting Started

Install dependencies:

```bash
npm install
```

Create environment files from `.env.example`.

For the backend, set `DATABASE_URL` to your PostgreSQL connection string:

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/tuklas_ar?schema=public"
PORT=4000
CLIENT_ORIGIN="http://localhost:5173"
```

For the frontend, set:

```bash
VITE_API_URL="http://localhost:4000/api"
```

Generate Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

Start the API:

```bash
npm run dev:backend
```

Start the frontend in another terminal:

```bash
npm run dev:frontend
```

Open `http://localhost:5173`.

## Current Features

- Student and teacher/demo entry modes
- Six-module POE activity library
- Marker-based AR mode foundation with AR.js dependency loaded for the observation view
- Three.js-powered interactive 3D fallback scene
- Local saved activity records through IndexedDB
- Offline preparation through a service worker
- JSON export of student work
- Backend `/api/modules`, `/api/sync`, and `/api/health` routes
- PostgreSQL schema for modules and activity records

## Offline Sync Model

Student work is saved locally first. When the device is online, the Settings screen can sync unsynced IndexedDB records to the Express API, which persists them in PostgreSQL.

Describe the app as offline-capable after initial download and setup. Browser storage may still be cleared or evicted by the device.

## Recommended Testing

```bash
npm run typecheck
npm run build
```

Before expanding all modules, test the Newton's-law activity on the weakest available Android phone and one iPhone Safari/home-screen install.
