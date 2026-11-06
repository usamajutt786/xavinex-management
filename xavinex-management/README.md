# Xavinex Management

React financial CRM backed by Node.js/Express and MongoDB in the existing sibling `../backend` folder. Existing layouts, charts, reports and business features are retained.

For the separate frontend and backend projects on Vercel, follow [VERCEL_DEPLOYMENT.md](../VERCEL_DEPLOYMENT.md). The committed `vercel.json` forwards production `/api` requests to the backend production domain while local development retains its local proxy.

From the workspace root:

```powershell
npm run install:all
npm run dev
```

Open **http://localhost:3000**. The same `npm run dev` command here starts the whole system; `npm run dev:frontend` starts Vite directly with the API recovery described below. Vite forwards `/api` to the backend port configured in `../backend/.env`.

The development Vite server also checks its local API when it starts and after a failed proxy connection. If the API is stopped, it launches the backend manager and retries failed launches while the frontend remains open. The login form retries its connection check automatically without clearing your email or password. To deliberately manage the API yourself, set `DISABLE_BACKEND_AUTOSTART=true` before starting Vite; remote `API_PROXY_TARGET` addresses never launch a local backend. This development behavior does not run during production builds.

Choose **Sign up**, enter your email, password (12–128 characters), and company name. The application creates an isolated company workspace and signs you in as its administrator. Use your email and password for future logins. No setup key is required. Registered users are stored in the configured MongoDB database with hashed passwords. Read the [backend configuration, API reference and testing guide](../backend/README.md).

`npm run lint` checks TypeScript; `npm run build` produces assets served by Express in production. No browser API secret or Gemini key is required. Atlas credentials belong only in the ignored backend `.env`.

Legacy local-storage records are preserved. Administrators can export them under **Account & access** and import a reconciled backup through Settings. New records, users, sessions, balances, ledgers and settings are stored in MongoDB.

Client creation and editing include optional phone number, exact address, LinkedIn URL, live project URL and other profile details. These fields can be added, edited or cleared later and are included in client profiles and validated backups. Profile and project URLs must use HTTP or HTTPS.

On **Clients**, **Export Excel** downloads a single-sheet `.xlsx` workbook containing all saved clients in the current company, including every contact/profile field, linked account, status, notes, creation date and client ID. It fetches the latest saved data when clicked and includes all clients even when the visible list is filtered. Empty fields stay blank; phone prefixes, leading zeroes, Unicode and multiline addresses are retained as text. Excel generation loads only when requested. **Export CSV** remains available for the filtered financial client report and also includes the new optional fields.
