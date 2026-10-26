# Xavinex Management backend

Node.js/Express with MongoDB persistence, authenticated APIs and the existing React frontend. All backend source files remain directly in this folder. The current `.env` selects local MongoDB on port 27018. The former Atlas database is left untouched; its records are not implicitly copied into the local database. Credentials are never included in examples or source control.

## Start the application

Requires Node.js 22.15+ and dependencies installed in both folders. From the workspace root:

```powershell
npm run install:all
npm run dev
```

Open **http://localhost:3000**. This single command starts the API on port 4000 and the frontend on 3000, waiting for database/API readiness first. `npm run dev` in the frontend folder also starts the complete system. `npm run dev` in this backend folder starts the API only. `npm run dev:frontend` in the frontend folder is available when you deliberately manage the API separately.

The launcher reuses an existing Xavinex API or frontend listener instead of killing user processes. When it owns the API process, changes to backend source or `.env` restart it. The development proxy reads `PORT`/optional `API_PROXY_TARGET` from `backend/.env`. Use the configured origin (`localhost:3000` by default); development also accepts `127.0.0.1:3000`. Production only accepts the exact configured origin.

Choose **Sign up** and enter your email, password (12–128 characters), and company name. Signup creates an isolated company workspace, makes you its administrator, and signs you in. Later, sign in using your email and password. The server derives the display name from the email, normalizes email case/whitespace, hashes passwords using scrypt, and stores users in MongoDB. Duplicate emails return a conflict; invalid credentials return “Invalid email or password.” Signup and login are rate limited and sessions use HttpOnly cookies and CSRF protection.

Each public registration creates a new company, even when another company has the same name. To share a workspace, its administrator adds members through Account & access and assigns admin, operator or viewer roles. Public registration cannot choose a role, company ID or existing company membership. No setup key or token is required. The optional `npm run bootstrap` maintenance command provisions an initial administrator for an empty installation. See [AUTHENTICATION.md](AUTHENTICATION.md) for isolation, migration and session behavior.

## MongoDB configuration

Runtime configuration is in **backend/.env**, which is ignored by Git. `.env.example` is a template, not a file the server reads directly. For Atlas:

```dotenv
MONGODB_URI=mongodb+srv://DATABASE_USER:URL_ENCODED_PASSWORD@YOUR_CLUSTER/xavinex_management?retryWrites=true&w=majority
LOCAL_MONGO=false
APP_ORIGIN=http://localhost:3000
PORT=4000
```

The database user must have read/write access to `xavinex_management`; allow this computer's IP in Atlas Network Access. Percent-encode reserved characters in passwords. Never put this URI in frontend variables or commit it. Changing the URI chooses a different database; it does not migrate records automatically. Legacy browser JSON backups can be imported through Settings after validation. Any old SQLite files are left untouched and are no longer used.

Optional local development/testing uses the installed `mongod` executable on **127.0.0.1:27018**, with replica set **xavinex-local** and data under ignored `backend/.mongo-data`. This preserves the Windows MongoDB service, its configuration and its data on port 27017. Set:

```dotenv
MONGODB_URI=mongodb://127.0.0.1:27018/xavinex_management?replicaSet=xavinex-local
LOCAL_MONGO=true
```

The launcher discovers a standard MongoDB installation or uses `MONGOD_PATH`. `npm run mongo` starts/initializes only this dedicated instance. It remains running when the app stops so the data stays available. A standalone server is rejected because financial writes require multi-document transactions. Atlas already provides replica-set transaction support.

Collections: `accounts`, `clients`, `projects`, `payments`, `transfers`, `expenses`, `adjustments`, `transactions`, `settings`, `users`, `sessions`, `audit`, `idempotency`, `metadata`. Domain records are individual documents with indexes for associations, status, dates and ledger order. Sessions and idempotency keys expire via TTL indexes; expiry is also enforced in queries immediately. Internal storage fields never reach the frontend.

### Finding saved entries in MongoDB Compass

The application's local database is on **port 27018**. Connect Compass with:

```text
mongodb://127.0.0.1:27018/xavinex_management?replicaSet=xavinex-local
```

Refresh the database list, open **xavinex_management**, and select **accounts**, **clients**, **projects**, or the relevant collection. The Windows service on port 27017 and any previous Atlas connection are separate storage destinations.

Administrators can open **Settings → MongoDB Storage** to see the API's actual connected server, database and stored record counts, with a credential-free local Compass URI. **Refresh database status** reads counts from MongoDB. The command `npm run db:status` in `backend` provides the same diagnostic summary without printing passwords or business record contents. `/api/database/status` requires administrator access. The development launcher compares the configured database identity with the running API before reusing it, so an old API connected to another database is identified explicitly.

## Features and integrity

Business dates and default form dates use `Asia/Karachi`; audit timestamps remain UTC. See [verification results](VERIFICATION.md) for the checks run on this implementation.

| Feature | Implementation |
| --- | --- |
| Account management | Create/update/delete with history guards, status, immutable type/currency, opening balances |
| Clients and profiles | Duplicate checks, linked Fiverr account, lifetime records; relinking affects future projects and preserves historical project attribution |
| Projects and pipeline | Bookings, completion dates, statuses, budget constraints, server-derived payment status |
| Client payments | Fiverr, direct Payoneer and direct bank routes; saved active receiving accounts, automatic bank currency conversion, gross/net amounts, derived fees, association checks, overpayment protection |
| Transfers | Two ledger entries, sufficient funds, route checks, same-currency deductions and cross-currency exchange ratios |
| Expenses | Bank/cash payments, category and currency validation, expense deletion with an immutable reversal |
| Adjustments and ledger | Required adjustment reasons, opening corrections, precise account-specific history and CSV export |
| Dashboard and reporting | USD reference-rate conversions, all existing chart views, 13 reports, filters, CSV and print |
| Settings | Atomic rate updates, category management, validated backup/restore, reset confirmation |
| Access management | Admin/operator/viewer roles, hashed passwords, secure sessions, first-admin setup, password changes and session revocation |

All financial changes, ledgers, related balances/statuses, audit events and idempotency receipts commit in one MongoDB transaction. A shared workspace version serializes conflicting writes across API instances, preventing write skew, duplicate payments and overdrafts. Transient conflicts are retried by the driver. Failed validation rolls back completely. Balance changes use integer-cent arithmetic; inputs reject fractional cents, NaN, infinity, bad dates, unknown fields and broken associations. Direct ledger/payment/transfer edits are not exposed.

New projects credit their full budget to the client's linked Fiverr account through a `project_booking` ledger entry, in the account's currency. Transfers debit the stored balance normally. These projects carry the server-owned `balanceRecognition: "booking"` field: a subsequent Fiverr payment deducts only its fee, while a direct Payoneer payment debits its gross value from Fiverr and credits its net value to Payoneer. Payment records and collection reports still use the actual payment date. Budget changes post the difference; cancellation reverses the unpaid portion; deletion reverses the credit for projects without payments. Reopening restores the unpaid portion. Changes that would overdraw the account fail atomically. Existing projects without this field retain their original payment-based balance rules; existing balances are never silently recredited. Backups preserve and reconcile both accounting modes. Account balances include booked project value and therefore are not a statement of cleared platform funds. The frontend applies the complete committed state after each write and refreshes other visible sessions every 15 seconds or on focus.

Allowed transfers: Fiverr → Payoneer; Payoneer → Payoneer/bank; bank → bank/petty cash; petty cash → bank. Accounts must be active. Fiverr and Payoneer payments use the project's and receiving account's common currency; bank payments and transfers support different currencies. Cross-currency amounts are not subtracted to invent a fee. Reporting uses current reference FX rates rather than historical valuations; cash-flow summaries retain the product's definition of gross collections minus expenses.

Bank is also available as a direct client payment method (`bank_direct`). Its dropdown includes all saved, active bank accounts regardless of currency. For different currencies, the server converts the entered project payment using the current Settings rate (destination rate divided by source rate), rounds to two decimal places, and credits the bank in its own currency. For example, USD 100 at a configured PKR rate of 280 credits PKR 28,000. The form previews the conversion and makes the converted amount read-only; submitting an outdated preview returns a conflict rather than silently posting a different amount. Cross-currency bank receipts have zero fee and store `receivingCurrency` and `exchangeRate` with the payment and rate on the receiving ledger entry. These historical values survive rate changes and backup restore. The rate comes from workspace Settings, not a live external FX feed. Same-currency receipts still allow gross/net fees. Gross collection and outstanding amounts remain in the project currency and use the actual payment date. For projects credited on booking, the gross amount is removed from Fiverr in the same transaction to prevent duplicate balances. Historical payment-based projects credit only the bank. Bank receipts appear separately in monthly collection reports and client history; backups validate both ledger entries when applicable.

## API reference

Paths have the `/api` prefix. Login returns `{user,csrfToken}` and an HttpOnly SameSite session cookie. Authenticated writes require that cookie and `X-CSRF-Token`. Business writes return `{success:true,data,state}`. They accept `Idempotency-Key` (8–200 characters); identical retries return the original data and a current state snapshot for 24 hours. Different payloads with the same key return 409. The frontend retains uncertain request keys when a network response fails, so retrying does not double-post.

| Method | Path | Access / purpose |
| --- | --- | --- |
| GET | `/health` | Public database readiness and deployment type |
| GET | `/auth/status` | Public `{registrationAvailable,firstUser}` |
| POST | `/auth/register` | Email/password signup: `{email,password}`; returns 201 with user, session cookie and CSRF token |
| POST | `/auth/login` | `{email,password}` |
| GET | `/auth/me` | User and CSRF token |
| POST | `/auth/logout` | Revoke session |
| POST | `/auth/password` | `{currentPassword,newPassword}`; revoke all own sessions |
| GET, POST | `/users` | Admin; list or create `{name,email,password,role}` |
| PATCH | `/users/:id` | Admin `{name?,role?,active?}`; revoke affected user's sessions |
| GET | `/state` | Consistent business snapshot |
| GET | `/accounts`, `/clients`, `/projects`, `/payments`, `/transfers`, `/expenses`, `/adjustments`, `/transactions` | Paginated reads |
| GET | `/<collection>/:id` | Single record |
| POST | `/accounts`, `/clients`, `/projects` | Admin/operator creation |
| PATCH, DELETE | `/accounts/:id`, `/clients/:id`, `/projects/:id` | Admin/operator update/delete with history guards |
| POST | `/accounts/:id/adjustments` | Admin/operator `{newBalance,reason,date}` |
| GET | `/accounts/:id/ledger` | This account's ledger |
| POST | `/payments`, `/transfers`, `/expenses` | Admin/operator posting |
| DELETE | `/expenses/:id` | Admin/operator expense reversal |
| GET, PATCH | `/settings` | Authenticated read, admin update |
| GET | `/reports`, `/analytics` | Date/account/client summaries and source data |
| GET | `/backup` | Admin complete business JSON download |
| POST | `/restore` | Admin complete snapshot; associations and running ledgers must reconcile |
| DELETE | `/data` | Admin `{ "confirm": "DELETE ALL BUSINESS DATA" }` |
| GET | `/audit` | Admin; paginated audit history |

Collection responses are `{items,total,offset,limit}` (default 100, maximum 1000); exact-match filters include `accountId`, `clientId`, `projectId`, `status`, `type` where applicable. Reports support `from`, `to`, `accountId`, `clientId`. Dates are real `YYYY-MM-DD` calendar dates. `validation.js` defines all request fields and limits.

Errors return `{error:{message,requestId}}`: 400 malformed requests, 401 missing/expired login, 403 access/CSRF/origin failure, 404 missing record, 409 conflict, 422 validation, 429 rate limit, 503 database/proxy unavailable. Unexpected 500 responses conceal internals. Logs include request IDs, methods, paths, status and latency without bodies, passwords or connection strings.

## Test commands

```powershell
# Workspace root: local MongoDB integration tests plus TypeScript
npm test
# Workspace root: build and Chrome browser workflows against isolated local MongoDB
npm run test:e2e
# Backend: same integration suite against the configured Atlas cluster
npm run test:atlas
# Backend: build, Atlas API tests, then Atlas Chrome workflows
npm run test:atlas:e2e
```

Tests use generated `xavinex_test_*`/`xavinex_e2e_*` control databases and their company databases, never `xavinex_management`, and clean both after completion. The test MongoDB credential needs create/drop permission for these generated databases. Browser tests use Google Chrome, port 4101, and test-only login credentials. Change the browser `channel` in `playwright.config.js` if necessary. Tests cover company isolation, signup/login/logout, stale tabs, session expiry/revocation, login limits, roles, migration, concurrency, rollback, persistence, all transfer/payment routes, currency conversion, financial workflows, Settings, backup/restore, all report/analytics tabs, edits, ledger CSV and API-unavailable retry.

## Deployment and practical limits

Build the frontend, then run `npm start` here. Express serves the frontend and API from the same origin. Production requires `NODE_ENV=production`, an HTTPS `APP_ORIGIN` and `MONGODB_URI`. Provide these as server environment variables. Use a TLS reverse proxy, set `TRUST_PROXY=1` only for exactly one trusted proxy, supervise the process and monitor logs. Email/password registration is available in production; roles are assigned by the backend. MongoDB backups provide full recovery including users; business JSON backups exclude authentication data. Restore/reset retain users and audit history.

The optional container builds from the workspace root: `docker build -f backend/Dockerfile -t xavinex .`. Pass Atlas configuration through runtime environment variables; `.env` is not copied into the image. No Docker deployment has been performed or verified here.

Companies have separate MongoDB databases; authentication, company mappings and company-scoped audit events are held in the control database. Collection lists use database pagination and indexes, while dashboards and mutations load a complete company snapshot; the snapshot aggregation is subject to MongoDB's 16 MB result-document limit. For large companies, replace whole-state reads/mutations with scoped repository queries and aggregate reporting. The company workspace version serializes business writes to protect financial invariants. Rate-limit counters are per process; use shared counters when horizontally scaling. Email delivery/password-reset infrastructure and external Fiverr/Payoneer bank connections are not implied: those screens record the company's entered transactions. Production infrastructure still needs deployment-specific validation.

MongoDB transaction behavior follows the [official Node.js driver transaction documentation](https://www.mongodb.com/docs/drivers/node/current/crud/transactions/).
