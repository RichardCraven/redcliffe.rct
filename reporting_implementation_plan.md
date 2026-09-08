# Reporting Implementation Plan: Redcliffe CRM

This document outlines the phased engineering plan to implement live report execution, interactive tabular presentation, entity drill-downs, CSV data exporting, and visual KPI summaries within the **Redcliffe CRM** application.

---

## 1. Objectives & Architectural Blueprint

The goal is to elevate the current **Report Catalog Browser** in Redcliffe into a **Live Report Execution Engine** that interfaces with SpiceCRM's KReporter framework.

```
┌─────────────────────────────────────────────────────────────┐
│                 Redcliffe CRM Frontend                      │
│  - "Run Report" Action in Reports Workspace                 │
│  - Interactive Glassmorphic Report Viewer Overlay           │
│  - Dynamic Results Table (Sorting, Filtering, Column Map)  │
│  - KPI Summary Stat Cards & Visual Distribution Chart       │
│  - 1-Click Entity Drill-Down & CSV Export                   │
└──────────────────────────────┬──────────────────────────────┘
                               │ REST / JSON (HTTP)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 Node.js / Express Proxy                     │
│  - GET /api/reports/:id/data                                │
│    ↳ Combines GET /module/KReports/:id (metadata)           │
│      with POST /module/KReports/:id/presentation/dynamicopt │
│  - GET /api/reports/:id/export/csv                          │
│    ↳ Proxies /module/KReports/plugins/action/kcsvexport     │
└──────────────────────────────┬──────────────────────────────┘
                               │ KREST API
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 SpiceCRM Backend (KReports)                 │
│  - Dynamic SQL Compiler across Entity Tables                │
│  - Native CSV Formatter & Presentation Exporter             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Phased Implementation Roadmap

### Step 1: Live Report Runner & Dynamic Results Grid
- **Backend API (`backend/server.js`)**:
  - Implement `GET /api/reports/:id/data`:
    - Authenticates with SpiceCRM via session token.
    - Fetches the report metadata definition (`/module/KReports/:id`) to extract human-readable column headers and field mappings from `listfields`.
    - Dispatches a execution request to `POST /module/KReports/:id/presentation/dynamicoptions` to retrieve query records.
    - Transforms raw field hashes (e.g. `k41193e0...`) into clean column labels while preserving underlying entity identifiers (`_id`, `_module`).
- **Frontend Service (`frontend/src/app/services/crm.service.ts`)**:
  - Define `ReportExecutionResult` and `ReportColumn` data models.
  - Implement `getReportData(reportId: string): Observable<ReportExecutionResult>`.
- **Frontend Workspace (`dashboard.component.ts` & `dashboard.component.html`)**:
  - Add primary *"Run Report"* button on each report row.
  - Create the **Report Viewer Interface**:
    - Slide-over / modal container with glassmorphic styling.
    - Real-time search bar to filter results client-side across all columns.
    - Dynamic table header generation with click-to-sort controls.
    - Responsive pagination and empty/loading states.

### Step 2: Entity Drill-Down & CSV Export
- **Entity Drill-Down**:
  - Detect when records represent `Accounts` or `Contacts`.
  - Wire row click events to `selectAccount()` or open corresponding record workspaces.
  - Provide visual indicators (clickable pill badges and external link icons).
- **Native CSV Export**:
  - Backend proxy route `GET /api/reports/:id/export/csv` connecting to `POST /module/KReports/plugins/action/kcsvexport/export`.
  - Frontend *"Export CSV"* action triggering automatic file download.

### Step 3: KPI Stat Cards & Visual Summaries
- **KPI Metric Stat Cards**:
  - Total records count.
  - Automatic detection of numeric columns (e.g., Balances, Counts, Premiums) with calculated `SUM` and `AVERAGE`.
  - Categorical entity breakdown.
- **Visual Distribution Chart**:
  - Lightweight, dependency-free CSS/SVG distribution breakdown (e.g., top values or category spreads) designed to blend into Redcliffe's dark/light theme.

---

## 3. Verification & Quality Gates
1. Angular build passes with zero TypeScript errors (`npm run build`).
2. Live reports (e.g. `Contact Spouse FHSA Balance`, `Renewal Pipeline Report`, `*Benefits Only Clients`) execute and populate tabular results.
3. CSV export downloads correctly formatted files with header rows.
4. Drill-down correctly opens related entities without page reloads.
