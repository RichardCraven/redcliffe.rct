# Redcliffe CRM — Technology Stack & Architecture

This document provides a comprehensive technical overview of the **Redcliffe CRM** application, including architecture patterns, frontend frameworks, backend proxy infrastructure, external integrations, design systems, and developer diagnostics tooling.

---

## 1. System Architecture Overview

Redcliffe CRM is built with a modern decoupled client-server architecture:

```
┌─────────────────────────────────────────────────────────────┐
│                 Angular 17 Single Page App                  │
│  - Standalone Components & RxJS Reactive Streams            │
│  - Dark / Light Glassmorphic Design System                  │
│  - Deep Linking & In-App Dev Console with Live Perf HUD     │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST / JSON (HTTP)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Node.js / Express Proxy Server              │
│  - Session Token Negotiation & Transparent Auto-Refresh     │
│  - Streaming CSV Ingestion (Multer + csv-parse)             │
│  - Local File-Backed DB Store (backend/data/redcliffe_db)   │
└───────────────┬─────────────────────────────┬───────────────┘
                │ KREST API                   │ Graph API
                ▼                             ▼
┌──────────────────────────────┐ ┌────────────────────────────┐
│   SpiceCRM / SuiteCRM Cloud  │ │  Microsoft Outlook Graph   │
│  (Accounts, Meetings, Users) │ │   (Calendar & Event Sync)  │
└──────────────────────────────┘ └────────────────────────────┘
```

---

## 2. Frontend Technology Stack

| Layer / Tool | Version | Purpose / Description |
| :--- | :--- | :--- |
| **Angular** | `17.3.0` | Core framework using modern **Standalone Components** (no `NgModule` boilerplate), functional `provideRouter`, and dependency injection via `inject()`. |
| **TypeScript** | `~5.4.2` | Strictly-typed application logic, interfaces, and compile-time verification. |
| **RxJS** | `~7.8.0` | Asynchronous streams, state broadcasting (`Subject`, `BehaviorSubject`), and functional HTTP interceptors (`sessionInterceptor`). |
| **Angular Router** | `17.3.0` | Dynamic tab routing and synchronization with browser query parameters (`?tab=account_<id>`). |
| **Zone.js** | `~0.14.3` | Angular change-detection zone runtime. |
| **Google Fonts** | CDN | **Outfit** for headlines/branding and **Inter** for UI data tables and telemetry readouts. |
| **Material Icons** | Google Fonts | Material Icons Round used throughout navigation, actions, and status badges. |

### Frontend Highlights & Design Patterns
- **Glassmorphism Design System**: Custom CSS3 variables (`:root` and `[data-theme="light"]`) utilizing `backdrop-filter: blur(16px)`, subtle translucent borders (`rgba(255, 255, 255, 0.08)`), and deep midnight slate themes.
- **Accessible Color Palette**: High contrast WCAG 2.1 AA/AAA compliance (e.g., `#38bdf8` Sky Cyan and `#f43f5e` Rose pills).
- **Tab & Workspace Manager**: Multi-tab browsing model allowing users to open multiple accounts, meetings, and reports concurrently with active state preserved in URL query parameters.
- **Privacy Enforcement**: Internal database UUIDs (`account_id`, `meeting_id`, `individual_id`) are suppressed from client-facing display cards, presenting business labels and badges instead.
- **In-App Developer Console (`Shift + Space`)**:
  - Interactive CLI environment with real-time command evaluation (`help`, `ping`, `perf`, `flush`, `reauth`, `token`, `status`, `clear`).
  - **Real-Time Performance HUD**: Live FPS counter, main-thread jitter (ms), and V8 JavaScript heap memory meter (`performance.memory`).
  - **Heap & Array Purger**: One-click baseline array flush with memory reclamation heuristics.

---

## 3. Backend Proxy & Middleware Stack

| Component | Version | Purpose / Description |
| :--- | :--- | :--- |
| **Node.js** | `>=18.0.0` | Asynchronous server-side JavaScript runtime with native `fetch` and ES module / CommonJS support. |
| **Express** | `^4.19.2` | Minimalist HTTP proxy server routing traffic between the Angular client and external APIs. |
| **cors** | `^2.8.5` | Cross-Origin Resource Sharing middleware enabling secure cross-port communication during development and production. |
| **dotenv** | `^16.4.5` | Environment variable management isolating API URLs and authentication credentials. |
| **multer** | `^1.4.5-lts.1` | Multipart/form-data handler for streaming client CSV file uploads directly in memory. |
| **csv-parse** | `^5.5.6` | High-throughput streaming CSV parser for ingesting Master Client Lists and account records. |

### Backend Responsibilities & Data Flow
- **SpiceCRM Session Management**:
  - Performs initial Basic Auth handshake (`/authentication/login`).
  - Stores and injects active session token into upstream KREST calls.
  - Automatically catches 401 Unauthorized responses and performs on-demand reauthentication before retrying downstream queries.
- **Local File-Backed Database**:
  - Implemented via `backend/db.js` writing to `backend/data/redcliffe_db.json`.
  - Persists custom individual records, notes, and local metadata independently of SpiceCRM schema locks.
- **Telemetry & Logging Middleware**:
  - Every incoming route is timed with millisecond duration tracking, method tags, and status symbols (`✓` / `❌`).

---

## 4. External Integrations

### SpiceCRM / SuiteCRM (KREST API)
- **Base Endpoint**: `https://spice.pfcd.ca/api`
- **Authenticated Modules**:
  - `/module/Accounts` — Enterprise accounts, company details, industry classifications, and group benefit plan details.
  - `/module/Meetings` — Client meeting records, status tracking, and attendee lists.
  - `/module/Users` — CRM user directory and account assignment.
  - `/module/KReports` — Advanced aggregated reporting and query exports.

### Microsoft Graph (Outlook Integration)
- Connects to Microsoft Graph API (`/outlook/events`) for two-way calendar sync, schedule conflict detection, and event management.

---

## 5. Directory Structure Overview

```
Redcliffe/
├── tech_stack.md                   # This documentation file
├── tech_stck.md                    # Canonical reference alias
├── reports_wiring.md               # SpiceCRM KReports architecture & DB wiring
├── reporting_implementation_plan.md # Roadmap for report execution, drill-downs & CSV export
├── Redcliffe Master Client List.csv # Master data import template
├── client_portal_credentials.md    # Portal credential reference
├── process documentation.md        # Business processes & workflows
├── spicecrm_onboarding_guide.md    # SpiceCRM integration manual
│
├── backend/
│   ├── server.js                   # Express proxy server & API routes
│   ├── db.js                       # JSON file-backed persistence layer
│   ├── package.json                # Node dependencies (Express, multer, csv-parse)
│   ├── .env                        # Private environment variables (CRM URL, credentials)
│   └── data/
│       └── redcliffe_db.json       # Local persistent entities store
│
└── frontend/
    ├── package.json                # Angular 17 dependencies & CLI configuration
    ├── angular.json                # Angular workspace & build configuration
    ├── tsconfig.json               # TypeScript compiler rules
    └── src/
        ├── index.html              # App shell, fonts, and icon imports
        ├── styles.css              # Global themes, CSS variables, glassmorphic styling
        ├── main.ts                 # Application bootstrap (bootstrapApplication)
        └── app/
            ├── app.component.ts    # Root component
            ├── app.config.ts       # Application providers & HTTP interceptors
            ├── app.routes.ts       # Route declarations
            ├── services/
            │   └── crm.service.ts  # Central CRM data service, HTTP client & session interceptor
            └── components/
                ├── dashboard/      # Main CRM workspace (Accounts, Meetings, Tabs, Dev Console)
                │   ├── dashboard.component.ts
                │   ├── dashboard.component.html
                │   └── dashboard.component.css
                └── login/          # Authentication view
                    ├── login.component.ts
                    ├── login.component.html
                    └── login.component.css
```

---

## 6. Build & Execution Commands

### Running the Backend Proxy
```bash
cd backend
npm install
node server.js
# Runs by default on http://localhost:3000
```

### Running the Frontend Application
```bash
cd frontend
npm install
npm start # or 'ng serve'
# Available at http://localhost:4200
```

### Building for Production
```bash
cd frontend
npm run build
# Compiles optimized distribution bundle to frontend/dist/
```
