# Store Management System — Project Documentation

> Generated from a full codebase analysis on 2026-07-19. This document describes what the
> system actually does today, as implemented — not the aspirational feature list. Where the
> current code falls short of the charter (`CLAUDE.md`), that gap is called out explicitly.

## 1. What This Project Is

An inventory / stock management system for stores operating **"in kshethram"** (temple
premises) — per the repo's own one-line README. It serves two kinds of organizations:

- **Temple** — a religious institution selling goods, either as a single store or split
  across multiple internal departments (e.g., separate counters/sections).
- **Book Store** — a temple-run bookshop that additionally needs to track books by
  **Author** and **Publisher**.

The system tracks products from the moment they're purchased from a supplier, through
storage in a central godown ("Main Store"), optional transfer to departments, sale to
customers, and (in principle) damage write-offs — with the goal of always being able to
answer "how much stock do we have, and how did it get here or leave."

**Stack**: Angular 17 (standalone components, Angular Material + ng-bootstrap, some Signals)
on the frontend (`frontend/store`), Node.js/Express 5 + raw `mysql2` (no ORM) on the backend
(`backend`), JWT-based auth.

---

## 2. High-Level Architecture

```
frontend/store/src/app/
├── core/            auth state, guards, interceptors, runtime config, store-context (dept selection)
├── layout/           header, sidebar, shell layout
├── features/
│   ├── auth/         login, change password
│   ├── dashboard/     KPI summary
│   ├── masters/       supplier, department, category, product, user, settings, author/publisher ("bookmaster")
│   ├── transactions/  opening-stock, direct-entry, purchase, order, stock-transfer, sales
│   └── reports/       stock report, stock-transfer report, purchase reports (product-wise/supplier-wise)
└── shared/           dynamic-table, dynamic-form, reusable dialogs, directives

backend/src/
├── controllers/ (19) one per domain area, raw SQL via mysql2/promise pool
├── routes/ (21)       REST endpoints, mostly one file per controller
├── middlewares/       JWT verification, role checks, error handling, rate limiting
├── services/          auth, invoice numbering, user
└── utils/             jwt signing, password hashing, image saving, stock sync (single-dept mirroring)
```

There is **no ORM and no schema file** in the repo (no `.sql` dump, no migrations folder).
The database structure below is reverse-engineered from the queries in the controllers.

---

## 3. Core Business Concepts (as implemented)

### Org type: Temple vs Book Store
Stored as a single boolean, `is_bookstore`, on a one-row `client_settings` table managed
through the **Settings** screen. When true:
- The sidebar shows an "Author / Publisher Master" menu item (both masters live in one
  combined component, `bookmaster`, not two separate screens).
- The **Order** flow requires author/publisher on a line item, but only for products that
  actually have authors/publishers configured — avoiding unsaveable orders for non-book
  products.

*Gap*: this restriction is enforced in the UI and in Order validation only. There is no
server-side guard stopping a Temple-type org from calling `/api/author` or
`/api/publishers` directly.

### Department selection after login
Handled by `StoreContextService` (signal-based, persists the chosen department id to
`localStorage`):
- 0 or 1 active department → auto-selected, **no popup shown**.
- More than 1 active department, no valid saved selection → the layout shell opens a
  `DepartmentSelectDialogComponent` (non-dismissable) after login.
- If the previously saved department was deleted/deactivated, the saved value is cleared
  and the user is re-prompted.
- The selected department is shown in the **Header** (badge) and used functionally by
  **Sales** and **Stock Transfer**. It is *not* meaningfully used by **Purchase**, because
  purchases always land in the Main Store regardless of which department is selected (see
  next section) — this appears to be intentional design rather than an oversight, but is
  worth confirming.

### Stock workflow
```
Supplier → Purchase → Main Store (Godown) → Department Transfer → Department Stock → Sale
                                                                                     ↘ Damage (not built)
```
- **Purchase, Opening Stock, Direct Entry** all increase stock at `location_type='MAIN_STORE'`.
- **Stock Transfer** moves quantity from Main Store to a specific department, using row
  locking (`SELECT ... FOR UPDATE`) to avoid race conditions, and logs an audit row to a
  `stock_transfer` table.
- **Sales** decreases department stock, row-locked the same way, and is the **only**
  transaction type that also writes to a unified `stock_ledger` audit table.
- **Single-department auto-mirror**: when an org has exactly one active department,
  every Main Store stock change from a Purchase is automatically mirrored into that
  department's stock in the same DB transaction (`utils/stockSync.util.js`), so
  single-store temples never need an explicit transfer step. This is a deliberate,
  documented shim implementing the charter's "single department → skip" rule at the data
  layer.
- **Damage**: **not implemented at all.** No route, controller, or UI exists. A
  `damaged_qty` column exists on the `stock` table and is referenced in the dashboard's
  stock-total formula (`qty + free_qty - damaged_qty`), but nothing ever writes a non-zero
  value into it — the schema anticipated this feature but it was never built.

### Stock history / ledger — inconsistency to be aware of
The charter requires *"never mutate stock quantities directly without recording a
transaction row."* In practice:
- **Sales** fully complies (decrements `stock` and writes a `stock_ledger` row).
- **Purchase, Opening Stock, Direct Entry, Stock Transfer** each mutate `stock` directly
  and keep their *own* separate audit table (`purchase_items`, `opening_stock`,
  `stock_transfer`) but do **not** write to `stock_ledger`. There is currently no single
  place to see a unified stock history — it requires joining several different tables.
- The "All Stock" report reads from a table called **`stock_main`**, while every
  transactional controller writes to a table called **`stock`**. These appear to be two
  different tables — likely a bug or leftover from a schema migration, and it means the
  All Stock report may be showing stale/incorrect figures.

---

## 4. Module Status

| Module | Status | Notes |
|---|---|---|
| Auth | Working | Login + change password. No refresh token, no forgot-password. |
| Dashboard | Working | KPI numbers (sales/purchase totals, today's figures, stock, profit, top 5 products). No charts. |
| Supplier Master | Complete CRUD | Uses shared dynamic-table/dynamic-form pattern. |
| Department Master | Complete CRUD | Soft delete via `is_active`; unique code/name enforced server-side. |
| Category Master | Complete CRUD | |
| Product Master | Most complete master | Includes author/publisher linkage, GST/HSN fields, bulk PDF/Excel export. |
| User Master | Complete CRUD | "Delete" is actually a soft status toggle, not a hard delete. |
| Settings | Working | Drives org type (`is_bookstore`), department count, logo, license/expiry status. |
| Opening Stock | Working | Writes to `opening_stock` + increments Main Store stock. |
| Direct Entry | Working | Increases Main Store stock without a supplier/purchase link. |
| Purchase | Most mature transaction module | Invoice numbering, cancel-with-reason workflow, links to Orders, auto-mirrors to sole department. |
| Order | Working | Supplier requisition; author/publisher required only for Book Store orgs where applicable; doesn't touch stock directly. |
| Stock Transfer | Working | Main Store → Department, row-locked; hidden from menu for single-department orgs; some dead/commented-out code present. |
| **Damage Entry** | **Not built** | No route, controller, or UI. Only a placeholder column exists. |
| Reports | **Largely a stub** | Only 4 of the 9 required reports exist (Purchase product-wise, Purchase supplier-wise, Stock, Stock Transfer). None support pagination, sorting, search, department/supplier/category filters, print, or Excel/PDF export as the charter requires. **The entire Reports menu section is commented out in the sidebar**, so these pages are only reachable by typing the URL directly. |
| Author Master / Publisher Master | Combined, not separate | Both live in one component (`bookmaster`) gated by `bookstoreOnly`; uses loosely-typed `any[]` rather than proper models. |

---

## 5. Database (inferred — no schema file exists in the repo)

| Table | Purpose |
|---|---|
| `users`, `roles` | Auth & role hierarchy |
| `client_settings` | Single-row org config: org type, department count, license dates, logo |
| `departments` | `dept_code`, `dept_name`, `dept_nameml` (bilingual), `is_active` |
| `suppliers`, `categories`, `products` | Master data; products carry category/author/publisher links, GST/HSN, pricing |
| `authors`, `publishers`, `product_authors`, `product_publishers` | Book Store-only linkage |
| `orders`, `order_items` | Supplier requisitions |
| `purchase_header`, `purchase_items` | Purchase transactions |
| `opening_stock` | Opening balance entries |
| `stock` | **Live stock table** — `product_id`, `location_type` (MAIN_STORE/DEPARTMENT), `location_id`, `qty`, `free_qty`, `damaged_qty` |
| `stock_main` | A second, apparently separate stock table used only by the All Stock report (see inconsistency above) |
| `stock_transfer` | Transfer audit rows |
| `stock_ledger` | Unified transaction ledger — currently populated only by Sales |
| `sales_header`, `sales_items` | Sales transactions |
| `invoice_sequence` | Shared invoice numbering across Sales/Purchase/Order |

**Recommendation**: export the current schema (`mysqldump --no-data`) and commit it to the
repo so the data model is documented and versioned rather than only inferable from code.

---

## 6. Auth & Security

- JWT access token only (`jsonwebtoken`, 1-day expiry, payload `{ id, role }`) — **no
  refresh token**.
- Passwords hashed with `bcryptjs`.
- Backend: `verifyAccessToken` middleware on nearly every route; `allowRoles(...)` for
  role-gated writes (e.g., only `ADMIN`/`SUPER_ADMIN` can mutate products). Role hierarchy
  is defined in two places (`config/role-permissions.js` and inline in
  `role.controller.js`) — minor duplication worth consolidating.
- SQL is parameterized throughout the spot-checked controllers — consistent with the
  charter's "no string-concatenated SQL" rule.
- Frontend: `authInterceptor` attaches the bearer token to requests; a `roleGuard` exists
  (`core/guards/role.guard.ts`) but **is not wired into any route** in `app.routes.ts`, and
  there is no auth guard either — so client-side navigation to any feature route is
  currently unprotected (server-side `allowRoles` checks are still the real enforcement,
  but a logged-out user isn't redirected away from app pages).

---

## 7. Shared/Reusable UI

- `dynamic-table` and `dynamic-form` (Angular Material-based, driven by `*-columns.ts` /
  `*.fields.ts` config objects) are used consistently across most Master screens
  (Supplier, Category, User).
- `department-select-dialog`, `purchase-list-dialog`, `cancel-reason-dialog` are shared
  dialogs used by the department-selection and Purchase flows.
- Not universally adopted: **Author/Publisher master and all Report screens build their
  own plain HTML tables** instead of reusing `dynamic-table` — a deviation from the
  charter's "prefer existing reusable components" guidance, and part of why Reports lacks
  pagination/sorting out of the box.

---

## 8. Known Gaps (prioritized)

1. **Damage Entry module is entirely missing** — no route, controller, or screen exists,
   despite being a required stage in the stock workflow and having a placeholder DB column.
2. **Reports module is a stub relative to the charter** — 4 of 9 reports exist, none have
   pagination/sort/search/filters/print/export, and the Reports menu is commented out of
   navigation entirely.
3. **`stock` vs `stock_main` mismatch** — the All Stock report likely reads incorrect/stale
   data because it queries a different table than every transactional controller writes to.
4. **No unified stock ledger** — only Sales writes to `stock_ledger`; Purchase, Opening
   Stock, Direct Entry, and Transfer keep separate per-module audit tables instead,
   making a single cross-module stock history hard to reconstruct today.
5. **No frontend route guards** — `roleGuard` exists but is unused; there's also no auth
   guard on feature routes.
6. **No DB schema file** in the repo — should be exported and committed.
7. **Author Master and Publisher Master are combined** into one screen/component rather
   than the two separate masters the charter names.
8. Minor cleanup items: stray `src.zip` backup and runtime log files committed in
   `backend/`; role hierarchy duplicated in two places; `Order` model duplicated between
   `masters/models` and `transactions/models`; some commented-out dead code in
   `stock-transfer.component.ts`.

---

## 9. Suggested Next Steps

- Decide whether Damage Entry or completing Reports is the higher priority, then build
  one module at a time per the project's working method.
- Investigate and resolve the `stock` vs `stock_main` discrepancy before trusting the All
  Stock report.
- Export and commit the current MySQL schema so it stops needing to be reverse-engineered.
- Wire up `roleGuard`/an auth guard on `app.routes.ts` so unauthenticated or under-privileged
  users are redirected client-side, not just blocked server-side.
- Decide whether to extend `stock_ledger` to cover Purchase/Opening Stock/Direct
  Entry/Transfer as well, for a true unified stock history.
