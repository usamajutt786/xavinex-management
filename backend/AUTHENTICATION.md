# Company authentication and isolation

Register with email, password (12–128 characters), and company name. Emails are globally unique so login needs only email and password. Every public signup creates a company and its administrator. Matching company names never grant membership. Administrators add colleagues using Account & access; the backend assigns them the administrator's company. Client-supplied membership fields are rejected.

| Role | Access within its own company |
| --- | --- |
| Admin | Business records, settings, backups/restore/reset, diagnostics, audit and member management |
| Operator | Read and create/update business records, payments, transfers and expenses; no administration |
| Viewer | Read business data and reports; no writes, member lists, backups or administration |

All users can change their own password and log out. Administrators cannot disable or demote themselves. Role changes and deactivation revoke the affected member's sessions.

## Database boundary

The configured MongoDB database is the control database for `companies`, `users`, `sessions` and company-tagged `audit`. Each new company receives a separate database with a deterministic 37-byte name (`xv_c_` plus a hash of the control database name and server-generated company UUID), compatible with Atlas deployments that limit names to 38 bytes. It contains its own accounts, clients, projects, payments, transfers, expenses, adjustments, transactions, settings, metadata and idempotency receipts. A shared MongoDB connection pool is used; company selection never accepts a request body, URL or header as authority. Middleware resolves the company from a validated server session and checks the server-owned database mapping and active company record on every protected request.

Legacy longer names continue to work where MongoDB supports them. On Atlas, an oversized mapping is repaired only after checking that the original database does not exist. Existing databases are never silently replaced with empty storage; those require explicit data migration.

List/detail/ledger reads, dashboards, reports, exports, restores, resets, diagnostics and financial mutations all operate on that selected database. Member management and audit reads filter the control collections by the session's company. Guessing a record ID, supplying another company ID, using an equal idempotency key, or restoring an equal document ID cannot select or alter another company's database. Company databases use independent workspace counters, indexes and atomic financial transactions. Authorization reads and session/member writes participate in those transactions so concurrent logout or role/password changes force a fresh authorization check.

The server MongoDB credential must be able to provision/index the company databases as well as access the control database. It stays on the server. End users do not receive MongoDB credentials. Production backup/recovery must include the control database and all company databases together; business JSON backups contain only the current company's business state and cannot assign user membership.

## Sessions and browser behavior

Passwords use salted scrypt hashes. Login issues a fresh random token stored only as a SHA-256 digest in MongoDB and an HttpOnly, SameSite=Strict cookie (Secure in production). Sessions carry company ID, user ID, authorization version and absolute expiration; the server checks expiration independently of TTL cleanup. Requests require CSRF tokens for writes, and allowed origins and login rate limits remain enforced. Logout deletes the session, preventing cookie replay. Password changes revoke every session for that user.

The frontend clears data on logout and signup/login, remounts views for a changed company, rejects responses from an earlier authentication generation, and pins protected requests to the logged-in company. If another tab switches the shared browser cookie to a different company, the old tab clears its workspace and asks for sign-in. Old local browser-backup export is offered only in the original legacy workspace, not newly registered companies.

## Existing installation migration

Startup assigns the original shared workspace to its earliest existing administrator (or earliest user if no administrator exists), without changing its financial records. Every additional user without existing company membership receives a separate empty company and administrator role within it. Existing company members are preserved. Old sessions lacking a company are invalidated; sign in again using the existing email and password. Company names for migrated users are derived from their saved display names. Migration is transactional and repeatable. The original administrator can add trusted colleagues to that company using new, unique member emails; existing memberships are never reassigned based on a name or registration input.

Tests create generated control databases and generated company databases, clean both, and never reset the real application database. `tenancy.test.js` covers physical database separation, foreign IDs and associations, members/roles, exports/restores/resets, idempotency, CSRF, session revocation and legacy migration. Browser tests cover company signup, data entry, login/logout, switching company, and stale tabs alongside the existing financial workflows.
