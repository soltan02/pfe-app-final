# STB Security — Architecture Documentation
## Projet de Fin d'Études (PFE) — Big Data Specialization

---

## 1. Project Overview

**STB Security** is a full-stack web application for managing security agents, sites, assignments, and reports for the **Société Tunisienne de Banque (STB)**. It provides role-based access for three user types and includes a **Big Data / Analytics layer** with materialized views, forecasting, and a PySpark distributed ETL prototype.

### Core Objectives

- Centralize security agent management across STB branches.
- Track attendance, incidents, and operational reports digitally.
- Provide role-specific dashboards (admin, chef d'équipe, agent).
- Deliver analytical KPIs and absenteeism forecasting for management.
- Demonstrate Big Data pipeline readiness through distributed ETL.

---

## 2. Technology Stack

| Layer | Technology | Version | Purpose |
|-------|-----------|---------|---------|
| Frontend | Angular | 21 (standalone components) | Role-based UI with dashboard and analytics |
| Backend | Node.js / Express | 5 (beta) | REST API with JWT auth and role middleware |
| Database | PostgreSQL | 16+ | Operational store + materialized views |
| Authentication | JWT + bcryptjs | — | Stateless token-based auth |
| Maps | Leaflet + OpenStreetMap | 1.9 | Site location visualization |
| Analytics (SQL) | PostgreSQL Materialized Views | — | Precomputed KPIs for dashboards |
| Analytics (Distributed) | PySpark | 3.x | Distributed ETL prototype → Parquet |
| ETL Orchestration | Node.js scripts + cron | — | View refresh and data generation |

---

## 3. System Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Angular 21)                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────────┐        │
│  │ Auth     │  │Dashboard │  │Admin     │  │ Analytics/       │        │
│  │ Service  │  │ (3 roles)│  │ Modules  │  │ Forecasting UI   │        │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────────┬─────────┘        │
│       │             │             │                  │                  │
│  ┌────┴─────────────┴─────────────┴──────────────────┴──────────┐       │
│  │          Auth Interceptor (JWT attachment) + Route Guards     │       │
│  └───────────────────────────────────────────────────────────────┘       │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ HTTP (REST)
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        BACKEND (Express 5 / Node.js)                      │
│                                                                          │
│  ┌──────────┐  ┌────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ JWT Auth │  │ Role       │  │ Route Modules│  │ File Upload      │   │
│  │ Middleware│  │ Middleware │  │ (11 routes)  │  │ (Multer/avatars)  │   │
│  └──────────┘  └────────────┘  └──────┬───────┘  └──────────────────┘   │
│                                        │                                 │
│  ┌─────────────────────────────────────┴──────────────────────────────┐  │
│  │  Routes: auth · agents · sites · affectations · presences         │  │
│  │          rapports · demandes · support · upload · analytics · users│  │
│  └────────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────┬─────────────────────────────────────────┘
                                 │ SQL
                                 ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        DATABASE (PostgreSQL)                              │
│                                                                          │
│  ┌──────────────────────────────────┐  ┌──────────────────────────────┐  │
│  │  Operational Tables              │  │  Analytics Layer              │  │
│  │  · users · agents · sites        │  │  · mv_attendance_daily       │  │
│  │  · affectations · presences      │  │  · mv_absenteeism_monthly    │  │
│  │  · rapports · demandes           │  │  · mv_incidents_monthly      │  │
│  └──────────────────────────────────┘  │  · mv_agent_workload         │  │
│                                         │  · mv_site_coverage         │  │
│                                         └──────────────┬───────────────┘  │
└─────────────────────────────────────────────────────────┼─────────────────┘
                                                           │ (JDBC)
                                                           ▼
┌──────────────────────────────────────────────────────────────────────────┐
│                        BIG DATA LAYER (PySpark)                          │
│                                                                          │
│  ┌──────────────────────┐  ┌────────────────┐  ┌────────────────────┐   │
│  │  spark_etl.py        │  │  Data Quality   │  │  Parquet Output    │   │
│  │  · JDBC read with    │  │  Checks         │  │  · attendance      │   │
│  │    partitioning      │  │  · Null counts  │  │  · absenteeism     │   │
│  │  · DataFrame aggs    │  │  · Distributions│  │  · incidents       │   │
│  │  · Forecast prep     │  └────────────────┘  │  · workload         │   │
│  └──────────────────────┘                       │  · coverage         │   │
│                                                  └────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database Schema

### 4.1 Entity-Relationship Overview

```
users ──→ agents (agent_id FK)
sites ──→ users (chef_id FK)
affectations ──→ agents (agent_id FK)
affectations ──→ sites (site_id FK)
presences ──→ agents (agent_id FK)
presences ──→ sites (site_id FK)
rapports ──→ agents (agent_id FK)
rapports ──→ sites (site_id FK)
rapports ──→ users (created_by FK, valide_par FK)
demandes ──→ agents (agent_id FK)
demandes ──→ users (valide_par FK)
```

### 4.2 Table Specifications

#### `users` (Login accounts)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | Auto-increment |
| nom | VARCHAR(255) | Display name |
| email | VARCHAR(255) | Login credential |
| password | VARCHAR(255) | bcrypt hash |
| role | VARCHAR(20) | `agent` / `chef_equipe` / `admin` |
| agent_id | INTEGER | FK → agents.id (nullable) |
| avatar_url | TEXT | Profile picture path |

#### `agents` (Security personnel)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| nom | VARCHAR(100) | Last name |
| prenom | VARCHAR(100) | First name |
| matricule | VARCHAR(20) | Unique badge number |
| telephone | VARCHAR(20) | Phone number |
| adresse | TEXT | Address |
| statut | VARCHAR(10) | `actif` / `inactif` |

#### `sites` (Bank branches)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| nom | VARCHAR(255) | e.g. "STB Tunis Centre" |
| adresse | TEXT | Physical address |
| ville | VARCHAR(100) | City |
| statut | VARCHAR(10) | `actif` / `inactif` |
| chef_id | INTEGER | FK → users.id (team leader) |

#### `affectations` (Agent-to-site assignments)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| agent_id | INTEGER | FK → agents.id |
| site_id | INTEGER | FK → sites.id |
| date_debut | DATE | Assignment start |
| date_fin | DATE | Assignment end (nullable) |
| statut | VARCHAR(20) | `en cours` / `completed` |
| chef_id | INTEGER | FK → users.id (creator) |

#### `presences` (Daily attendance records)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| agent_id | INTEGER | FK → agents.id |
| site_id | INTEGER | FK → sites.id |
| date | DATE | Attendance date |
| heure_arrivee | TIME | Check-in time |
| heure_depart | TIME | Check-out time |
| statut | VARCHAR(10) | `present` / `absent` / `retard` / `conge` |
| created_at | TIMESTAMP | |

#### `rapports` (Incident and operational reports)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| agent_id | INTEGER | FK → agents.id |
| site_id | INTEGER | FK → sites.id |
| type | VARCHAR(20) | `incident` / `absence` / `sante` / `autre` |
| contenu | TEXT | Description |
| date | DATE | Report date |
| statut | VARCHAR(20) | `pending` / `approved` / `rejected` |
| created_by | INTEGER | FK → users.id |
| valide_par | INTEGER | FK → users.id (admin) |
| created_at | TIMESTAMP | |

#### `demandes` (Leave/attestation requests and support tickets)
| Column | Type | Notes |
|--------|------|-------|
| id | SERIAL PK | |
| agent_id | INTEGER | FK → agents.id |
| type | VARCHAR(30) | `conge` / `attestation_presence` / `attestation_travail` / `support` |
| date_debut | DATE | Start date |
| date_fin | DATE | End date |
| motif | TEXT | Reason |
| statut | VARCHAR(20) | `pending` / `approved` / `rejected` |
| chef_approved | BOOLEAN | Team leader approval |
| valide_par | INTEGER | FK → users.id |
| created_at | TIMESTAMP | |

---

## 5. API Endpoints

### 5.1 Authentication
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | /api/auth/login | Public | Login with email/password → JWT |
| GET | /api/auth/me | Any | Current user full profile |
| PUT | /api/auth/change-password/:userId | Admin | Change any user's password |
| PUT | /api/auth/change-role/:userId | Admin | Change user role |
| GET | /api/auth/users-list | Admin | List all users with site info |

### 5.2 Agents
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /api/agents | Chef+ | List agents (filtered by site for chefs) |
| GET | /api/agents/me/profile | Agent | Current agent's profile |
| GET | /api/agents/:id | Chef+ | Single agent details |
| POST | /api/agents | Chef+ | Create agent + auto-assign to chef's sites |
| PUT | /api/agents/:id | Admin | Update agent |
| DELETE | /api/agents/:id | Admin | Delete agent (cascade to affectations/presences) |

### 5.3 Sites
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /api/sites | Any | All sites |
| GET | /api/sites/my-sites | Any | User's assigned sites |
| GET | /api/sites/assigned-chefs | Admin | IDs of chefs managing sites |
| GET | /api/sites/:id | Any | Single site |
| POST | /api/sites | Admin | Create site (one chef per site rule) |
| PUT | /api/sites/:id | Admin | Update site |
| DELETE | /api/sites/:id | Admin | Delete site |

### 5.4 Affectations (Assignments)
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /api/affectations/mes-affectations | Agent | Agent's assignments |
| GET | /api/affectations | Chef+ | All assignments |
| POST | /api/affectations | Chef+ | Create assignment |
| PUT | /api/affectations/:id | Chef+ | Update assignment |
| DELETE | /api/affectations/:id | Chef+ | Delete assignment |

### 5.5 Presences (Attendance)
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /api/presences/team-agents | Chef | Agents for attendance recording |
| GET | /api/presences/agents | Any | Agents list for pointage |
| GET | /api/presences/me/monthly/:month | Any | Own monthly attendance |
| GET | /api/presences/yearly/:year | Any | Yearly attendance stats |
| GET | /api/presences/monthly/:month | Chef | Monthly attendance grid |
| POST | /api/presences | Chef | Record single attendance |
| POST | /api/presences/bulk | Chef | Bulk record attendance |
| DELETE | /api/presences | Chef | Delete attendance record |
| GET | /api/presences/day/:date | Chef | Daily attendance for site |

### 5.6 Rapports (Reports)
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /api/rapports | Chef+ | Chef's reports |
| POST | /api/rapports | Chef+ | Create report |
| GET | /api/rapports/admin/all | Admin | All reports |
| GET | /api/rapports/admin/full-report | Admin | Full report with stats |
| PUT | /api/rapports/:id/validate | Admin | Approve report |

### 5.7 Demandes (Requests/Tickets)
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /api/demandes/my-requests | Agent | Agent's requests |
| POST | /api/demandes/my-requests | Agent | Create request |
| GET | /api/demandes/team-requests | Chef | Team's requests |
| GET | /api/demandes | Admin/Chef | All requests (filtered) |
| PUT | /api/demandes/:id/chef-approve | Chef | Approve request |
| PUT | /api/demandes/:id/chef-reject | Chef | Reject request |
| PUT | /api/demandes/:id/admin-approve | Admin | Final approve |
| PUT | /api/demandes/:id/admin-reject | Admin | Final reject |
| DELETE | /api/demandes/:id | Owner/Admin | Delete request |

### 5.8 Support
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | /api/support | Agent+ | Send support message |
| GET | /api/support | Admin | List support messages |

### 5.9 Upload
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| POST | /api/upload/avatar | Any | Upload profile picture (2MB limit, images only) |

### 5.10 Analytics & Big Data
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /api/analytics/summary | Admin | KPI summary (agent/site/presence/report counts) |
| GET | /api/analytics/attendance-trend | Admin | Monthly attendance trend per site |
| GET | /api/analytics/absenteeism-by-branch | Admin | Per-branch absenteeism stats |
| GET | /api/analytics/incidents-monthly | Admin | Monthly incidents by type |
| GET | /api/analytics/agent-workload | Admin | Agent workload stats |
| GET | /api/analytics/coverage | Admin | Site coverage metrics |
| GET | /api/analytics/forecast-absenteeism | Admin | Linear regression forecast with trend direction |
| POST | /api/analytics/generate | Admin | Generate Big Data (200 agents, 2 years) + refresh MVs |

### 5.11 Dashboard
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /api/dashboard/stats | Any | Dashboard counters |

### 5.12 Users
| Method | Path | Access | Description |
|--------|------|--------|-------------|
| GET | /api/users | Admin | List users |
| PUT | /api/users/profile | Any | Update own profile |
| PUT | /api/users/change-own-password | Any | Change own password |

---

## 6. Role-Based Access Control

### 6.1 Role Hierarchy

```
admin (level 3)  →  chef_equipe (level 2)  →  agent (level 1)
```

### 6.2 Middleware

Two authorization strategies are implemented:

1. **Hierarchical (`role()`)** — allows if user's level ≥ required level.
   - Used for routes where higher roles inherit access (e.g., admin inherits chef capabilities).
2. **Exact (`role.exact()`)** — requires exact role match.
   - Used for chef-only routes (attendance recording, team management) that admin must not access.

### 6.3 Permissions Matrix

| Feature | Agent | Chef d'Équipe | Admin |
|---------|-------|---------------|-------|
| View Dashboard | ✅ | ✅ | ✅ |
| View Assignments | ✅ | ✅ | ✅ |
| View/Edit Profile | ✅ | ✅ | ✅ |
| Contact Support | ✅ | ✅ | ✅ |
| Manage Team | ❌ | ✅ | ✅ |
| Edit Assignments | ❌ | ✅ | ✅ |
| Record Attendance | ❌ | ✅ | ❌ |
| View Monthly Grid | ❌ | ✅ | ❌ |
| Create Reports | ❌ | ✅ | ❌ |
| View All Reports | ❌ | ❌ | ✅ |
| Manage Agents | ❌ | ✅ | ✅ |
| Manage Sites | ❌ | ❌ | ✅ |
| Manage Users | ❌ | ❌ | ✅ |
| View Analytics | ❌ | ❌ | ✅ |
| Generate Big Data | ❌ | ❌ | ✅ |

---

## 7. Big Data / Analytics Layer

### 7.1 Architecture

The application separates operational transactions from analytical processing:

```
Operational Tables (PostgreSQL)
    │
    ├── SQL Materialized Views ──→ Analytics API ──→ Angular Dashboard
    │     (5 views, refreshed on demand)
    │
    └── PySpark ETL ──→ Parquet Files ──→ Data Lake (future: ML / dashboards)
          (distributed, partitioned, columnar)
```

### 7.2 Materialized Views

| View | Source Tables | Key Metrics |
|------|--------------|-------------|
| `mv_attendance_daily` | presences, sites | Daily total/present/absent/late/leave per site |
| `mv_absenteeism_monthly` | presences, sites | Monthly absence/tardiness rates per branch |
| `mv_incidents_monthly` | rapports, sites | Monthly incidents pending/approved per type |
| `mv_agent_workload` | agents, affectations, presences, rapports | Per-agent assignment/presence/report stats |
| `mv_site_coverage` | sites, affectations | Agent coverage history per site |

All views are refreshed concurrently via: `npm run etl`

### 7.3 Forecasting

The `/api/analytics/forecast-absenteeism` endpoint uses PostgreSQL regression functions:

- `REGR_SLOPE` — absenteeism trend (positive = rising, negative = improving)
- `REGR_INTERCEPT` — baseline absence rate
- `REGR_R2` — model fit quality
- **Next-month forecast** — computed from trend line
- **Trend direction** — classified as `rising`, `improving`, or `stable`

### 7.4 PySpark ETL

The distributed ETL prototype (`bigdata/spark_etl.py`):

- Reads all operational tables via JDBC with **partitioning** for parallel reads.
- Computes matching aggregates using **Spark DataFrames**.
- Runs **data quality checks** (null counts, distribution profiling).
- Writes all outputs to **Parquet** (columnar format, analytics-optimized).
- Supports `SPARK_MASTER` environment variable — switch from `local[*]` to `yarn` or `k8s://`.

### 7.5 Data Generation

The `POST /api/analytics/generate` endpoint (admin-only):
1. Seeds 200+ agents with realistic Tunisian names.
2. Creates chef_equipe accounts for each STB branch.
3. Generates 2 years of daily attendance records (150K+ presences).
4. Creates scattered reports and requests.
5. Refreshes all materialized views.

---

## 8. Security Model

| Concern | Implementation |
|---------|---------------|
| Authentication | JWT (24h expiry), bcrypt password hashing |
| Authorization | Role middleware (hierarchical + exact) |
| Route protection | Frontend guards + backend middleware |
| File upload | MIME type validation, 2MB limit, randomized filenames |
| CORS | Whitelist-based origin validation |
| Password policy | Minimum 8 characters (admin set), 4 characters (self-service) |
| SQL injection | Parameterized queries (pg library `$1` placeholders) |

### Production Hardening Needed

Before production deployment, the following should be addressed:
- Login rate limiting (`express-rate-limit`)
- Security headers (Helmet middleware)
- JWT secret validation at startup
- Stricter password lifecycle (random temporary passwords, not matricule-based)
- Resource-level authorization (ownership checks for chef-managed records)

---

## 9. Project Structure

```
stb-security/
├── ARCHITECTURE.md           # This file
├── README.md                 # Setup and usage guide
├── .gitignore
├── backend/
│   ├── src/
│   │   ├── index.js          # Express entry point, CORS, route mounting
│   │   ├── config/db.js      # PostgreSQL connection pool
│   │   ├── middleware/
│   │   │   ├── auth.js       # JWT verification
│   │   │   └── roles.js      # Role-based access control
│   │   ├── routes/           # 11 route modules
│   │   └── scripts/          # Seed, ETL, Big Data generation
│   ├── uploads/avatars/      # Profile pictures
│   └── .env.example          # Environment variable template
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/   # Shared components (navbar)
│   │   │   ├── pages/        # Page components (20+ modules)
│   │   │   ├── services/     # API client services
│   │   │   ├── guards/       # Auth route guard
│   │   │   ├── interceptors/ # JWT attachment interceptor
│   │   │   ├── app.ts        # Root component
│   │   │   └── app.routes.ts # Route definitions
│   │   ├── environments/     # API URL configuration
│   │   └── assets/           # Static assets (logo, default avatar)
│   └── angular.json
├── bigdata/
│   ├── spark_etl.py          # PySpark distributed ETL
│   └── requirements.txt      # Python dependencies
└── postman/                  # API collection and environment
```

---

## 10. Deployment

### Local Development

```bash
# Backend
cd backend
cp .env.example .env    # Configure database and JWT secret
npm install
npm run seed            # Initialize database with sample data
npm run dev             # Start development server (port 3000)

# Frontend
cd frontend
npm install
ng serve               # Start Angular dev server (port 4200)

# PySpark ETL (optional)
cd bigdata
pip install -r requirements.txt
python spark_etl.py
```

### Production

Deployment steps:

1. Set environment variables (DATABASE_URL, JWT_SECRET, FRONTEND_URL).
2. Build frontend: `ng build --configuration production`.
3. Deploy backend static files / Node.js service.
4. Schedule ETL refresh: `crontab -e → 0 2 * * * cd /app && npm run etl`.

---

## 11. ETL Pipeline

```
npm run seed         → Initial schema + sample data
npm run seed:bigdata → Large-scale test data (200+ agents, 2 years)
npm run etl          → Refresh all materialized views
npm start            → Production server
```

Scheduled view refresh (Linux cron):
```cron
0 2 * * * cd /path/to/backend && node src/scripts/runEtl.js >> /var/log/stb-etl.log 2>&1
```

---

## 12. Key Dependencies

### Backend (Node.js)
| Package | Purpose |
|---------|---------|
| express | HTTP framework |
| pg | PostgreSQL client |
| jsonwebtoken | JWT signing/verification |
| bcryptjs | Password hashing |
| cors | Cross-Origin Resource Sharing |
| multer | File upload handling |
| dotenv | Environment configuration |

### Frontend (Angular)
| Package | Purpose |
|---------|---------|
| @angular/router | Client-side routing |
| @angular/forms | Reactive forms |
| leaflet | Interactive maps (OpenStreetMap) |
| rxjs | Reactive state management |

### Big Data (Python)
| Package | Purpose |
|---------|---------|
| pyspark | Distributed data processing |
| (postgresql JDBC driver) | Spark ↔ PostgreSQL connectivity |