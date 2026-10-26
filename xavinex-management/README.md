# Xavinex Management

React financial CRM backed by Node.js/Express and MongoDB in the existing sibling `../backend` folder. Existing layouts, charts, reports and business features are retained.

From the workspace root:

```powershell
npm run install:all
npm run dev
```

Open **http://localhost:3000**. The same `npm run dev` command here starts the whole system; use `npm run dev:frontend` only when managing the API separately. Vite forwards `/api` to the backend port configured in `../backend/.env`.

Choose **Sign up**, enter only your email and password (12–128 characters), and the application signs you in automatically. Use those same credentials for future logins. No name or setup key is required. Registered users are stored in local MongoDB with hashed passwords. Read the [backend configuration, API reference and testing guide](../backend/README.md).

`npm run lint` checks TypeScript; `npm run build` produces assets served by Express in production. No browser API secret or Gemini key is required. Atlas credentials belong only in the ignored backend `.env`.

Legacy local-storage records are preserved. Administrators can export them under **Account & access** and import a reconciled backup through Settings. New records, users, sessions, balances, ledgers and settings are stored in MongoDB.
