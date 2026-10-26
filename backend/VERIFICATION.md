# Authentication verification — October 25, 2026

The active application configuration uses local MongoDB at `127.0.0.1:27018`, database `xavinex_management`, replica set `xavinex-local`. Existing Atlas records were not changed or automatically migrated.

| Check | Result |
| --- | --- |
| Local MongoDB API integration tests | 12 passed |
| Chrome browser workflows using isolated local MongoDB | 5 passed |
| TypeScript | Passed |
| Production frontend build | Passed |

Registration accepts only email and password. Tests verify email normalization, duplicate registration (including simultaneous requests), password hashing without plaintext storage, rejection of injected roles/extra fields, automatic first-administrator assignment, least-privilege later accounts, session creation, registered-user login and incorrect/nonexistent credential errors. Browser tests verify the form has exactly two inputs, signup signs in successfully, logout and subsequent login work, and duplicate signup/incorrect login show clear errors.

The existing financial, Settings, reporting, balance correction, ledger export, persistence, authorization, session expiry, CSRF, backup/restore and API retry regression tests also pass. Test records are restricted to generated test databases and cleaned up.

The storage investigation directly confirmed 4 existing accounts, 1 client and 3 ledger transactions in the application database at 127.0.0.1:27018. Both the frontend proxy and direct API health checks identified the same database connection. User records were preserved.

Browser financial workflows now compare every account, client, project, payment, transfer, expense, adjustment, ledger entry and settings record against actual documents read through a fresh independent MongoDB client. These checks run after UI saves and after a page reload. An API test closes the backend and its database connection, reopens the same database, restarts the API and verifies that the complete state and authenticated session survive. Storage diagnostics tests cover collection counts, credentials redaction, administrator-only access and distinguishing database destinations.

Start with `npm run dev` from the workspace root and open `http://localhost:3000`. Choose Sign up, enter your email and a 12–128 character password, and submit. No name, setup key or token is required. The first registered user becomes administrator; later users start as viewers and can be promoted by an administrator.
