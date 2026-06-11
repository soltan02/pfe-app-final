# STB Security — Agent Management & Analytics Platform

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Angular](https://img.shields.io/badge/Angular-21-red)
![Express](https://img.shields.io/badge/Express-5-green)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-blue)
![PySpark](https://img.shields.io/badge/PySpark-3.x-orange)

> **Projet de Fin d'Études (PFE) — Big Data Specialization**
>
> A full-stack application for managing security agents, sites, assignments, attendance, reports, and analytics for the Société Tunisienne de Banque (STB).

---

## Features

### 👥 Role-Based Access
- **Admin** — Full system access: manage users, sites, agents, and view analytics
- **Chef d'Équipe** — Team management: record attendance, create reports, handle requests
- **Agent** — Personal dashboard: view assignments, attendance, submit requests

### 📊 Operational Management
- **Agents** — CRUD operations with auto-assignment to chef's sites
- **Sites** — Branch management with one-chef-per-site business rule
- **Affectations** — Agent-to-site assignment tracking
- **Presences** — Daily attendance recording (single and bulk)
- **Rapports** — Incident/absence/health reports with validation workflow
- **Demandes** — Leave and attestation requests with chef+admin approval chain
- **Support** — Contact support messaging system

### 📈 Analytics & Big Data
- **Materialized Views** — Precomputed KPIs for instant dashboard loading
- **Forecasting** — Linear regression absenteeism trends with next-month predictions
- **PySpark ETL** — Distributed batch processing prototype → Parquet output
- **Data Quality** — Automated null detection and distribution profiling
- **Data Generator** — Create 200+ agents and 2 years of attendance data

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | **Angular 21** (standalone components) + Leaflet maps |
| Backend | **Node.js / Express 5** + JWT auth + bcrypt |
| Database | **PostgreSQL 16** + materialized views |
| Big Data | **PySpark 3.x** + Parquet |
| Maps | Leaflet with OpenStreetMap tiles |

---

## Running the App

### Easiest way (Windows)

Double-click **`start-app.bat`** in the project root. It will:
- Install dependencies if missing
- Open two terminal windows (backend + frontend)
- Start both servers automatically

### Manual way

Open **two terminals** from the project root.

### Terminal 1 — Backend

```bash
cd backend
npm install
npm run seed          # first time only — creates schema + sample data
npm run dev           # → http://localhost:3000
```

### Terminal 2 — Frontend

```bash
cd frontend
npm install
npm start             # → http://localhost:4200
```

> **Important:** Always `cd` into the folder before running commands.
> Use `npm start` (not `ng serve`) — Angular CLI is installed locally, not globally.

### Big Data / PySpark (Optional)

```bash
cd bigdata
pip install -r requirements.txt
python spark_etl.py
```

---

### Prerequisites

- **Node.js** ≥ 18
- **PostgreSQL** ≥ 14
- **Java 17+** (for PySpark, optional)

---

## Default Accounts (After Seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@stb.com.tn | password |
| Chef d'Équipe | chef@stb.com.tn | password |
| Agent | agent@stb.com.tn | password |

---

## Available Scripts

### Backend (`backend/package.json`)

| Command | Description |
|---------|-------------|
| `npm start` | Production server |
| `npm run dev` | Development server with hot reload |
| `npm run seed` | Initialize database with sample data |
| `npm run seed:bigdata` | Generate large-scale test data (200+ agents, 2 years) |
| `npm run etl` | Refresh all materialized views |

### Frontend (`frontend/package.json`)

| Command | Description |
|---------|-------------|
| `npm start` | Development server (port 4200) |
| `npm run build` | Production build |

---

## ETL Pipeline

```
npm run seed         → Create schema + sample data
npm run seed:bigdata → Generate 200+ agents with 2 years of attendance
npm run etl          → Refresh materialized views
```

For production, schedule ETL refresh via cron:
```cron
0 2 * * * cd /path/to/backend && node src/scripts/runEtl.js
```

---

## API Overview

The backend exposes **40+ REST endpoints** organized into 11 route modules:

| Module | Base Path | Access |
|--------|-----------|--------|
| Auth | `/api/auth` | Public + Admin |
| Agents | `/api/agents` | Chef+ |
| Sites | `/api/sites` | Any + Admin |
| Affectations | `/api/affectations` | Agent+ |
| Presences | `/api/presences` | Chef+ |
| Rapports | `/api/rapports` | Chef+ |
| Demandes | `/api/demandes` | Agent+ |
| Support | `/api/support` | Agent+ |
| Upload | `/api/upload` | Any |
| Analytics | `/api/analytics` | Admin only |
| Users | `/api/users` | Any |

Full API documentation: see [ARCHITECTURE.md](./ARCHITECTURE.md#5-api-endpoints)

---

## Big Data Architecture

```
Operational Tables (PostgreSQL)
    │
    ├── SQL Materialized Views ──→ Analytics API ──→ Angular Dashboard
    │     (5 views, instant KPI loading)
    │
    └── PySpark ETL ──→ Parquet Files ──→ Data Lake / ML Pipeline
          (partitioned, distributed, columnar)
```

### Materialized Views
- `mv_attendance_daily` — Daily attendance per site
- `mv_absenteeism_monthly` — Monthly absenteeism per branch
- `mv_incidents_monthly` — Monthly incidents by type
- `mv_agent_workload` — Per-agent assignment and presence stats
- `mv_site_coverage` — Agent coverage history per site

### Forecasting
The absenteeism forecast endpoint uses PostgreSQL's `REGR_SLOPE`, `REGR_INTERCEPT`, and `REGR_R2` to compute trends and next-month predictions for each branch.

---

## Project Structure

```
stb-security/
├── ARCHITECTURE.md          # Full architecture documentation
├── README.md                # This file
├── start-app.bat            # Launch app with one double-click (Windows)
├── bigdata/
│   ├── spark_etl.py         # PySpark distributed ETL
│   └── requirements.txt     # Python dependencies
├── backend/
│   ├── src/
│   │   ├── index.js         # Express entry point
│   │   ├── config/          # Database configuration
│   │   ├── middleware/       # Auth and role middleware
│   │   ├── routes/          # 11 route modules
│   │   └── scripts/         # Seed, ETL, data generation
│   └── uploads/             # Avatar storage
├── frontend/
│   ├── src/app/
│   │   ├── components/      # Shared UI components
│   │   ├── pages/           # Page components
│   │   ├── services/        # API client services
│   │   ├── guards/          # Route guards
│   │   └── interceptors/    # JWT interceptor
│   └── environments/        # API URL configuration
└── postman/                 # API collection and environment
```

---

## Security Features

- **JWT-based authentication** with 24h token expiry
- **bcrypt password hashing** (salt rounds: 10)
- **Role-based access control** (hierarchical + exact middleware)
- **Parameterized SQL queries** (SQL injection protection)
- **File upload validation** (MIME type check, size limit, randomized names)
- **CORS origin whitelisting**
- **Password change** with current password verification

---

## Deployment

### Production Checklist
1. Set `JWT_SECRET` to a strong random value (`crypto.randomBytes(48).toString('hex')`)
2. Configure `DATABASE_URL` for managed PostgreSQL
3. Build frontend: `npm run build` (from `frontend/ directory)
4. Deploy backend as Node.js service
5. Schedule ETL refresh via cron
6. Add rate limiting and security headers for production hardening

---

## Documentation

| File | Description |
|------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Complete architecture, schema, API reference |

---

## License

This project is developed for academic purposes as part of a PFE (Projet de Fin d'Études) in Big Data specialization.

---

## Authors

PFE Student — Big Data Specialization#   p f e - a p p - f i n a l  
 